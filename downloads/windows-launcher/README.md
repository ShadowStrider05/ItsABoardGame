# Windows Launcher Download (Split Archive)

GitHub blocks single files over 100MB in regular repositories, so the launcher zip is split into two parts.

## How to use
1. Download both `.part001` and `.part002` files into the same folder.
2. Run `rebuild-zip.bat` in that same folder.
3. Extract `ItsABoardGame-Launcher-Windows-Preview.zip`.
4. Run `ItsABoardGameLauncher.exe`.

## One-link website install
If you want one link on your website, use this file:
- `Install-ItsABoardGameLauncher.cmd` (recommended)

Direct link:
- `https://raw.githubusercontent.com/ShadowStrider05/ItsABoardGame/main/downloads/windows-launcher/Install-ItsABoardGameLauncher.cmd`

PowerShell fallback link:
- `https://raw.githubusercontent.com/ShadowStrider05/ItsABoardGame/main/downloads/windows-launcher/Install-ItsABoardGameLauncher.ps1`

What it does:
1. Downloads both launcher zip parts.
2. Rebuilds the launcher zip automatically.
3. Extracts launcher into `%LOCALAPPDATA%\\ItsABoardGameLauncher`.
4. Creates a desktop shortcut.
5. Opens the launcher.

## Steam-like flow in this launcher
1. Open launcher.
2. Click `Install / Update Game`.
3. Launcher downloads the game package listed in `game-manifest.json`.
4. Click `Play` to launch the installed game.

The launcher uses this default manifest:
- `downloads/windows-launcher/game-manifest.json`

You can override URLs with environment variables:
- `LAUNCHER_MANIFEST_URL`
- `LAUNCHER_DOWNLOAD_URL`
- `LAUNCHER_GAME_EXECUTABLE_RELATIVE`
