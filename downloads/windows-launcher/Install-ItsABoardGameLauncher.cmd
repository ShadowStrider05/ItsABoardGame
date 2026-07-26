@echo off
setlocal

echo Starting ItsABoardGame Launcher installer...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $u='https://raw.githubusercontent.com/ShadowStrider05/ItsABoardGame/main/downloads/windows-launcher/Install-ItsABoardGameLauncher.ps1'; $p=Join-Path $env:TEMP 'Install-ItsABoardGameLauncher.ps1'; Invoke-WebRequest -Uri $u -OutFile $p -UseBasicParsing; & $p"

if errorlevel 1 (
  echo.
  echo Installer failed. Please run PowerShell as normal user and try again.
  pause
  exit /b 1
)

echo.
echo Installer completed.
exit /b 0
