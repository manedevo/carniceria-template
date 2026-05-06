@echo off
setlocal

:: =====================================================================
::  Carniceria Artesanal — Windows VM Launcher (launch.bat)
::  VERSION: v1.1 (robust, admin-safe, unicode-safe)
:: =====================================================================

title Carniceria Artesanal — VM Setup

:: -------------------------------------------------------------
:: 1. Comprobar privilegios de administrador
:: -------------------------------------------------------------
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO]  Elevando privilegios de administrador...
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

:: -------------------------------------------------------------
:: 2. Ejecutar launch.ps1
:: -------------------------------------------------------------
if exist "%~dp0launch.ps1" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launch.ps1"
) else (
    echo [ERROR] No se encontro launch.ps1 en este directorio.
    echo         Asegurate de que launch.bat y launch.ps1 esten juntos.
    pause
    exit /b 1
)

echo.
echo Instalacion finalizada. Presiona una tecla para cerrar...
pause >nul

endlocal
