# Windows Launcher Download (Split Archive)

GitHub blocks single files over 100MB in regular repositories, so the launcher zip is split into two parts.

## How to use
1. Download both `.part001` and `.part002` files into the same folder.
2. Run `rebuild-zip.bat` in that same folder.
3. Extract `ItsABoardGame-Launcher-Windows-Preview.zip`.
4. Run `ItsABoardGameLauncher.exe`.

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
