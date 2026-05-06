@echo off
setlocal

:: ============================================================
::  Carniceria Artesanal — Windows VM Launcher
::  Double-click this file to set up the test VM automatically.
::  Everything will be installed without manual steps.
:: ============================================================

title Carniceria Artesanal — VM Setup

:: ── Request administrator privileges ────────────────────────
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO]  Requesting administrator privileges...
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

:: ── Launch the PowerShell setup script ──────────────────────
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launch.ps1"

echo.
echo Press any key to close this window...
pause >nul
endlocal
