import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { get as httpsGet } from "node:https";
import { get as httpGet } from "node:http";
import { URL, pathToFileURL } from "node:url";
import AdmZip from "adm-zip";

type LauncherState = {
  accountName: string;
  localVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  canPlay: boolean;
  multiplayerEnabled: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  statusMessage: string;
  executableRelativePath: string;
  launchEntryType: "exe" | "html";
};

type ManifestResponse = {
  version: string;
  downloadUrl?: string;
  executableRelativePath?: string;
};

let launcherWindow: BrowserWindow | null = null;

const DEFAULT_MANIFEST_URL =
  "https://raw.githubusercontent.com/ShadowStrider05/ItsABoardGame/main/downloads/windows-launcher/game-manifest.json";

const launcherState: LauncherState = {
  accountName: "",
  localVersion: "0.0.0",
  latestVersion: "0.0.0",
  updateAvailable: false,
  canPlay: false,
  multiplayerEnabled: false,
  isDownloading: false,
  downloadProgress: 0,
  statusMessage: "Ready.",
  executableRelativePath: "ItsABoardGame.exe",
  launchEntryType: "exe"
};

function getStoragePath(): string {
  return path.join(app.getPath("userData"), "launcher-profile.json");
}

function getVersionPath(): string {
  const gameDir = getInstallDir();
  if (!existsSync(gameDir)) {
    mkdirSync(gameDir, { recursive: true });
  }

  return path.join(gameDir, "version.json");
}

function getInstallDir(): string {
  return path.join(app.getPath("userData"), "itsaboardgame-install");
}

function getDownloadTempPath(): string {
  return path.join(getInstallDir(), "download.zip");
}

function findFirstExe(rootDir: string): string | null {
  const queue: string[] = [rootDir];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name.toLowerCase().endsWith(".exe")) {
        return fullPath;
      }
    }
  }

  return null;
}

function findFirstIndexHtml(rootDir: string): string | null {
  const queue: string[] = [rootDir];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name.toLowerCase() === "index.html") {
        return fullPath;
      }
    }
  }

  return null;
}

function loadLocalData(): void {
  const storagePath = getStoragePath();
  if (existsSync(storagePath)) {
    try {
      const raw = readFileSync(storagePath, "utf-8");
      const parsed = JSON.parse(raw) as { accountName?: string };
      launcherState.accountName = parsed.accountName ?? "";
    } catch {
      launcherState.accountName = "";
    }
  }

  const versionPath = getVersionPath();
  if (existsSync(versionPath)) {
    try {
      const raw = readFileSync(versionPath, "utf-8");
      const parsed = JSON.parse(raw) as {
        version?: string;
        executableRelativePath?: string;
        launchEntryType?: "exe" | "html";
      };
      launcherState.localVersion = parsed.version ?? "0.0.0";
      launcherState.executableRelativePath =
        parsed.executableRelativePath ?? launcherState.executableRelativePath;
      launcherState.launchEntryType = parsed.launchEntryType ?? launcherState.launchEntryType;
    } catch {
      launcherState.localVersion = "0.0.0";
    }
  }

  launcherState.canPlay = launcherState.localVersion !== "0.0.0";
}

function saveLocalData(): void {
  writeFileSync(
    getStoragePath(),
    JSON.stringify(
      {
        accountName: launcherState.accountName
      },
      null,
      2
    )
  );
}

function compareSemver(a: string, b: string): number {
  const left = a.split(".").map((part) => Number(part));
  const right = b.split(".").map((part) => Number(part));
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const l = left[index] ?? 0;
    const r = right[index] ?? 0;
    if (l > r) {
      return 1;
    }
    if (l < r) {
      return -1;
    }
  }

  return 0;
}

async function checkForUpdates(): Promise<LauncherState> {
  const manifestUrl = process.env.LAUNCHER_MANIFEST_URL ?? DEFAULT_MANIFEST_URL;
  if (!manifestUrl) {
    launcherState.latestVersion = launcherState.localVersion;
    launcherState.updateAvailable = false;
    launcherState.canPlay = launcherState.localVersion !== "0.0.0";
    return launcherState;
  }

  const response = await fetch(manifestUrl);
  if (!response.ok) {
    throw new Error(`Update check failed with status ${response.status}`);
  }

  const manifest = (await response.json()) as ManifestResponse;
  launcherState.latestVersion = manifest.version;
  if (manifest.executableRelativePath) {
    launcherState.executableRelativePath = manifest.executableRelativePath;
  }
  launcherState.updateAvailable = compareSemver(manifest.version, launcherState.localVersion) > 0;
  launcherState.canPlay = launcherState.localVersion !== "0.0.0";
  return launcherState;
}

function downloadFile(url: string, destination: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestImpl = urlObj.protocol === "https:" ? httpsGet : httpGet;

    requestImpl(urlObj, (response) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        response.destroy();
        downloadFile(response.headers.location, destination).then(resolve).catch(reject);
        return;
      }

      if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
        reject(new Error(`Download failed with status ${response.statusCode ?? "unknown"}.`));
        return;
      }

      const totalBytesHeader = response.headers["content-length"];
      const totalBytes = totalBytesHeader ? Number(totalBytesHeader) : 0;
      let downloadedBytes = 0;

      launcherState.downloadProgress = 0;

      const fileStream = createWriteStream(destination);
      response.on("data", (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        if (totalBytes > 0) {
          launcherState.downloadProgress = Math.min(100, Math.round((downloadedBytes / totalBytes) * 100));
          launcherState.statusMessage = `Downloading game files... ${launcherState.downloadProgress}%`;
        }
      });

      response.pipe(fileStream);

      fileStream.on("finish", () => {
        fileStream.close();
        launcherState.downloadProgress = 100;
        resolve();
      });

      fileStream.on("error", (error) => {
        fileStream.close();
        reject(error);
      });
    }).on("error", (error) => reject(error));
  });
}

async function installOrUpdateGame(): Promise<LauncherState> {
  if (launcherState.isDownloading) {
    return launcherState;
  }

  launcherState.isDownloading = true;
  launcherState.downloadProgress = 0;
  launcherState.statusMessage = "Preparing download...";

  try {
    const manifestUrl = process.env.LAUNCHER_MANIFEST_URL ?? DEFAULT_MANIFEST_URL;
    const fallbackDownloadUrl = process.env.LAUNCHER_DOWNLOAD_URL;

    let targetVersion = launcherState.latestVersion !== "0.0.0" ? launcherState.latestVersion : "0.1.0";
    let packageUrl = fallbackDownloadUrl;
    let executableRelativePath = launcherState.executableRelativePath;
    let launchEntryType: "exe" | "html" = "exe";

    if (manifestUrl) {
      const response = await fetch(manifestUrl);
      if (!response.ok) {
        throw new Error(`Manifest request failed with status ${response.status}`);
      }

      const manifest = (await response.json()) as ManifestResponse;
      targetVersion = manifest.version;
      packageUrl = manifest.downloadUrl ?? packageUrl;
      executableRelativePath = manifest.executableRelativePath ?? executableRelativePath;
    }

    if (!packageUrl) {
      throw new Error("No package URL configured. Set LAUNCHER_MANIFEST_URL or LAUNCHER_DOWNLOAD_URL.");
    }

    const installDir = getInstallDir();
    if (!existsSync(installDir)) {
      mkdirSync(installDir, { recursive: true });
    }

    const downloadPath = getDownloadTempPath();
    if (existsSync(downloadPath)) {
      unlinkSync(downloadPath);
    }

    await downloadFile(packageUrl, downloadPath);
    launcherState.statusMessage = "Installing game files...";

    for (const entry of readdirSync(installDir, { withFileTypes: true })) {
      if (entry.name === "version.json" || entry.name === "download.zip") {
        continue;
      }

      rmSync(path.join(installDir, entry.name), { recursive: true, force: true });
    }

    const archive = new AdmZip(downloadPath);
    archive.extractAllTo(installDir, true);

    const envRelative = process.env.LAUNCHER_GAME_EXECUTABLE_RELATIVE;
    if (envRelative) {
      executableRelativePath = envRelative;
    }

    const candidateExecutable = path.join(installDir, executableRelativePath);
    if (!existsSync(candidateExecutable)) {
      const discoveredExecutable = findFirstExe(installDir);
      if (discoveredExecutable) {
        executableRelativePath = path.relative(installDir, discoveredExecutable);
        launchEntryType = "exe";
      } else {
        const discoveredIndexHtml = findFirstIndexHtml(installDir);
        if (!discoveredIndexHtml) {
          throw new Error("Game installed, but no launchable .exe or index.html was found.");
        }
        executableRelativePath = path.relative(installDir, discoveredIndexHtml);
        launchEntryType = "html";
      }
    } else {
      launchEntryType = "exe";
    }

    launcherState.localVersion = targetVersion;
    launcherState.latestVersion = targetVersion;
    launcherState.executableRelativePath = executableRelativePath;
    launcherState.launchEntryType = launchEntryType;
    launcherState.updateAvailable = false;
    launcherState.canPlay = true;
    launcherState.statusMessage = `Installed version ${targetVersion}. Ready to play.`;

    writeFileSync(
      getVersionPath(),
      JSON.stringify(
        {
          version: launcherState.localVersion,
          executableRelativePath: launcherState.executableRelativePath,
          launchEntryType: launcherState.launchEntryType
        },
        null,
        2
      )
    );

    if (existsSync(downloadPath)) {
      unlinkSync(downloadPath);
    }

    return launcherState;
  } finally {
    launcherState.isDownloading = false;
  }
}

function createLauncherHtml(): string {
  return `
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ItsABoardGame Launcher</title>
    <style>
      body {
        margin: 0;
        font-family: Trebuchet MS, Segoe UI, sans-serif;
        background: radial-gradient(circle at top, #3a5146 0%, #1a2721 45%, #0c120f 100%);
        color: #f4ecda;
      }
      .shell { padding: 20px; max-width: 960px; margin: 0 auto; }
      .card {
        border: 1px solid rgba(255,255,255,0.2);
        background: rgba(0,0,0,0.3);
        border-radius: 12px;
        padding: 14px;
        margin-top: 12px;
      }
      h1 { margin: 0 0 8px; }
      .row { display: flex; gap: 8px; flex-wrap: wrap; }
      input, button {
        height: 38px;
        border-radius: 20px;
        border: 1px solid rgba(255,255,255,0.24);
      }
      input {
        padding: 0 12px;
        background: rgba(0,0,0,0.28);
        color: #f4ecda;
      }
      button {
        padding: 0 14px;
        cursor: pointer;
        font-weight: 700;
      }
      button.primary { background: #d9c07e; color: #1d261a; }
      button.secondary { background: rgba(255,255,255,0.12); color: #f4ecda; }
      .muted { opacity: 0.84; }
      .status { margin-top: 8px; }
      .warn { color: #ffcf8f; }
      .ok { color: #b7f1b5; }
    </style>
  </head>
  <body>
    <main class="shell">
      <h1>ItsABoardGame Launcher</h1>
      <p class="muted">Install the game in this launcher, then click Play when ready.</p>

      <section class="card">
        <h2>Authentication Hub</h2>
        <div class="row">
          <input id="account-name" placeholder="Display name" maxlength="24" />
          <button id="save-account" class="secondary">Save Profile</button>
        </div>
      </section>

      <section class="card">
        <h2>Version and Update</h2>
        <div class="row">
          <button id="check-updates" class="secondary">Check Updates</button>
          <button id="download-game" class="secondary">Install / Update Game</button>
          <button id="play-game" class="primary">Play</button>
        </div>
        <p id="version-status" class="status"></p>
        <p id="install-status" class="status muted"></p>
      </section>

      <section class="card">
        <h2>News and Patch Notes</h2>
        <p class="muted">Set LAUNCHER_PATCH_NOTES_URL to point this button at live notes.</p>
        <button id="open-patch-notes" class="secondary">Open Patch Notes</button>
      </section>

      <section class="card">
        <h2>Mode Availability</h2>
        <p>Pass and Play: <span class="ok">Available</span></p>
        <p>Online Multiplayer Ranked: <span class="warn">Unavailable in this build</span></p>
        <p>Play With Friends: <span class="warn">Unavailable in this build</span></p>
      </section>
    </main>

    <script>
      const el = {
        accountName: document.getElementById("account-name"),
        saveAccount: document.getElementById("save-account"),
        checkUpdates: document.getElementById("check-updates"),
        downloadGame: document.getElementById("download-game"),
        playGame: document.getElementById("play-game"),
        openPatchNotes: document.getElementById("open-patch-notes"),
        versionStatus: document.getElementById("version-status"),
        installStatus: document.getElementById("install-status")
      };

      async function refresh() {
        const state = await window.launcherApi.getState();
        el.accountName.value = state.accountName || "";
        el.playGame.disabled = !state.canPlay || state.isDownloading;
        el.downloadGame.disabled = state.isDownloading;
        el.checkUpdates.disabled = state.isDownloading;
        el.versionStatus.textContent =
          "Installed: " + state.localVersion + " | Latest: " + state.latestVersion +
          (state.updateAvailable ? " | Update required" : " | Up to date");
        el.installStatus.textContent = state.statusMessage || "";
      }

      el.saveAccount.addEventListener("click", async () => {
        await window.launcherApi.saveAccount(el.accountName.value || "");
        await refresh();
      });

      el.checkUpdates.addEventListener("click", async () => {
        await window.launcherApi.checkUpdates();
        await refresh();
      });

      el.downloadGame.addEventListener("click", async () => {
        await window.launcherApi.installGame();
        await refresh();
      });

      el.playGame.addEventListener("click", async () => {
        const result = await window.launcherApi.launchGame();
        if (!result.ok) {
          alert(result.message);
        }
      });

      el.openPatchNotes.addEventListener("click", async () => {
        await window.launcherApi.openPatchNotes();
      });

      refresh();
    </script>
  </body>
</html>
  `;
}

function createWindow(): void {
  launcherWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, "preload.js")
    }
  });

  launcherWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(createLauncherHtml())}`);
}

function registerIpcHandlers(): void {
  ipcMain.handle("launcher:getState", async () => {
    return launcherState;
  });

  ipcMain.handle("launcher:saveAccount", async (_event, accountName: string) => {
    launcherState.accountName = accountName.trim();
    saveLocalData();
    return launcherState;
  });

  ipcMain.handle("launcher:checkUpdates", async () => {
    try {
      return await checkForUpdates();
    } catch (error) {
      await dialog.showMessageBox({
        type: "warning",
        title: "Update Check Failed",
        message: error instanceof Error ? error.message : "Unable to check updates."
      });
      return launcherState;
    }
  });

  ipcMain.handle("launcher:installGame", async () => {
    try {
      return await installOrUpdateGame();
    } catch (error) {
      launcherState.statusMessage =
        error instanceof Error ? `Install failed: ${error.message}` : "Install failed.";
      await dialog.showMessageBox({
        type: "error",
        title: "Install Failed",
        message: launcherState.statusMessage
      });
      return launcherState;
    }
  });

  ipcMain.handle("launcher:openPatchNotes", async () => {
    const patchNotesUrl = process.env.LAUNCHER_PATCH_NOTES_URL;
    if (patchNotesUrl) {
      await shell.openExternal(patchNotesUrl);
      return { ok: true };
    }

    await dialog.showMessageBox({
      type: "info",
      title: "Patch Notes URL Missing",
      message: "Set LAUNCHER_PATCH_NOTES_URL to open external patch notes."
    });
    return { ok: false };
  });

  ipcMain.handle("launcher:launchGame", async () => {
    if (!launcherState.canPlay) {
      return { ok: false, message: "Game launch blocked. Install the game first." };
    }

    const gameExecutable = process.env.LAUNCHER_GAME_EXECUTABLE;
    if (gameExecutable && existsSync(gameExecutable)) {
      spawn(gameExecutable, [], { detached: true, stdio: "ignore" }).unref();
      launcherWindow?.minimize();
      return { ok: true, message: "Launching game executable." };
    }

    const installedEntry = path.join(getInstallDir(), launcherState.executableRelativePath);
    if (existsSync(installedEntry)) {
      if (launcherState.launchEntryType === "exe") {
        spawn(installedEntry, [], { detached: true, stdio: "ignore", cwd: path.dirname(installedEntry) }).unref();
        launcherWindow?.minimize();
        return { ok: true, message: "Launching installed game executable." };
      }

      await shell.openExternal(pathToFileURL(installedEntry).toString());
      launcherWindow?.minimize();
      return { ok: true, message: "Launching installed offline build." };
    }

    const fallbackUrl = process.env.LAUNCHER_GAME_URL ?? "http://localhost:5173";
    await shell.openExternal(fallbackUrl);
    launcherWindow?.minimize();
    return { ok: true, message: "Launching fallback game URL." };
  });
}

app.whenReady().then(() => {
  loadLocalData();
  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
