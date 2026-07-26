$ErrorActionPreference = "Stop"

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Invoke-DownloadWithRetry {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][string]$OutFile
  )

  for ($attempt = 1; $attempt -le 3; $attempt += 1) {
    try {
      Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing
      return
    }
    catch {
      if ($attempt -eq 3) {
        throw
      }
      Start-Sleep -Seconds 1
    }
  }
}

function Assert-MinFileSize {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][long]$MinBytes,
    [Parameter(Mandatory = $true)][string]$Label
  )

  if (!(Test-Path $Path)) {
    throw "$Label download failed: file is missing."
  }

  $length = (Get-Item $Path).Length
  if ($length -lt $MinBytes) {
    throw "$Label download failed: file is too small ($length bytes)."
  }
}

try {
  $baseUrl = "https://raw.githubusercontent.com/ShadowStrider05/ItsABoardGame/main/downloads/windows-launcher"
  $tempDir = Join-Path $env:TEMP "ItsABoardGameLauncherInstall"
  $installDir = Join-Path $env:LOCALAPPDATA "ItsABoardGameLauncher"
  $zipPath = Join-Path $tempDir "ItsABoardGame-Launcher-Windows-Preview.zip"
  $part1Path = Join-Path $tempDir "ItsABoardGame-Launcher-Windows-Preview.zip.part001"
  $part2Path = Join-Path $tempDir "ItsABoardGame-Launcher-Windows-Preview.zip.part002"

  New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
  New-Item -ItemType Directory -Force -Path $installDir | Out-Null

  Write-Host "Downloading launcher package (part 1)..."
  Invoke-DownloadWithRetry -Url "$baseUrl/ItsABoardGame-Launcher-Windows-Preview.zip.part001" -OutFile $part1Path
  Assert-MinFileSize -Path $part1Path -MinBytes 1000000 -Label "Part 1"

  Write-Host "Downloading launcher package (part 2)..."
  Invoke-DownloadWithRetry -Url "$baseUrl/ItsABoardGame-Launcher-Windows-Preview.zip.part002" -OutFile $part2Path
  Assert-MinFileSize -Path $part2Path -MinBytes 100000 -Label "Part 2"

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

  Assert-MinFileSize -Path $zipPath -MinBytes 1000000 -Label "Combined archive"

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
}
catch {
  Write-Error "Installer failed: $($_.Exception.Message)"
  throw
}
