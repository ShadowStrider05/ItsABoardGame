import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

type LauncherState = {
  accountName: string;
  localVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  canPlay: boolean;
  multiplayerEnabled: boolean;
};

type ManifestResponse = {
  version: string;
  downloadUrl?: string;
};

let launcherWindow: BrowserWindow | null = null;

const launcherState: LauncherState = {
  accountName: "",
  localVersion: "0.0.0",
  latestVersion: "0.0.0",
  updateAvailable: false,
  canPlay: false,
  multiplayerEnabled: false
};

function getStoragePath(): string {
  return path.join(app.getPath("userData"), "launcher-profile.json");
}

function getVersionPath(): string {
  const gameDir = path.join(app.getPath("userData"), "itsaboardgame-install");
  if (!existsSync(gameDir)) {
    mkdirSync(gameDir, { recursive: true });
  }

  return path.join(gameDir, "version.json");
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
      const parsed = JSON.parse(raw) as { version?: string };
      launcherState.localVersion = parsed.version ?? "0.0.0";
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
  const manifestUrl = process.env.LAUNCHER_MANIFEST_URL;
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
  launcherState.updateAvailable = compareSemver(manifest.version, launcherState.localVersion) > 0;
  launcherState.canPlay = !launcherState.updateAvailable && launcherState.localVersion !== "0.0.0";
  return launcherState;
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
      <p class="muted">Custom launcher with account profile, patch checks, and play gating.</p>

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
          <button id="download-game" class="secondary">Download Game</button>
          <button id="play-game" class="primary">Play</button>
        </div>
        <p id="version-status" class="status"></p>
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
        versionStatus: document.getElementById("version-status")
      };

      async function refresh() {
        const state = await window.launcherApi.getState();
        el.accountName.value = state.accountName || "";
        el.playGame.disabled = !state.canPlay;
        el.versionStatus.textContent =
          "Installed: " + state.localVersion + " | Latest: " + state.latestVersion +
          (state.updateAvailable ? " | Update required" : " | Up to date");
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
        await window.launcherApi.openDownload();
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

  ipcMain.handle("launcher:openDownload", async () => {
    const downloadUrl = process.env.LAUNCHER_DOWNLOAD_URL;
    if (downloadUrl) {
      await shell.openExternal(downloadUrl);
      return { ok: true };
    }

    await dialog.showMessageBox({
      type: "info",
      title: "Download Link Missing",
      message: "Set LAUNCHER_DOWNLOAD_URL to enable download redirects."
    });
    return { ok: false };
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
      return { ok: false, message: "Game launch blocked. Run update check first." };
    }

    const gameExecutable = process.env.LAUNCHER_GAME_EXECUTABLE;
    if (gameExecutable && existsSync(gameExecutable)) {
      spawn(gameExecutable, [], { detached: true, stdio: "ignore" }).unref();
      launcherWindow?.minimize();
      return { ok: true, message: "Launching game executable." };
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
