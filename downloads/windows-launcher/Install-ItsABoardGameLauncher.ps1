$ErrorActionPreference = "Stop"

$baseUrl = "https://raw.githubusercontent.com/ShadowStrider05/ItsABoardGame/main/downloads/windows-launcher"
$tempDir = Join-Path $env:TEMP "ItsABoardGameLauncherInstall"
$installDir = Join-Path $env:LOCALAPPDATA "ItsABoardGameLauncher"
$zipPath = Join-Path $tempDir "ItsABoardGame-Launcher-Windows-Preview.zip"
$part1Path = Join-Path $tempDir "ItsABoardGame-Launcher-Windows-Preview.zip.part001"
$part2Path = Join-Path $tempDir "ItsABoardGame-Launcher-Windows-Preview.zip.part002"

New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
New-Item -ItemType Directory -Force -Path $installDir | Out-Null

Write-Host "Downloading launcher package (part 1)..."
Invoke-WebRequest -Uri "$baseUrl/ItsABoardGame-Launcher-Windows-Preview.zip.part001" -OutFile $part1Path

Write-Host "Downloading launcher package (part 2)..."
Invoke-WebRequest -Uri "$baseUrl/ItsABoardGame-Launcher-Windows-Preview.zip.part002" -OutFile $part2Path

Write-Host "Combining package parts..."
$zipOut = [System.IO.File]::Create($zipPath)
try {
  foreach ($part in @($part1Path, $part2Path)) {
    $inStream = [System.IO.File]::OpenRead($part)
    try {
      $inStream.CopyTo($zipOut)
    }
    finally {
      $inStream.Dispose()
    }
  }
}
finally {
  $zipOut.Dispose()
}

Write-Host "Extracting launcher..."
Expand-Archive -Path $zipPath -DestinationPath $installDir -Force

$exePath = Join-Path $installDir "ItsABoardGameLauncher.exe"
if (!(Test-Path $exePath)) {
  $foundExe = Get-ChildItem -Path $installDir -Recurse -Filter "ItsABoardGameLauncher.exe" | Select-Object -First 1
  if ($null -eq $foundExe) {
    throw "Launcher executable not found after extraction."
  }
  $exePath = $foundExe.FullName
}

$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "ItsABoardGame Launcher.lnk"
$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $exePath
$shortcut.WorkingDirectory = (Split-Path $exePath)
$shortcut.Save()

Write-Host "Launching launcher..."
Start-Process -FilePath $exePath

Write-Host "Done. Use the desktop shortcut 'ItsABoardGame Launcher' next time."
