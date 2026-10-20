@echo off
setlocal
title Restore official app.asar
chcp 65001 >nul

rem Restore resources\app.asar to the official build (drops every local patch).
rem Requires a backup at resources\app.asar.orig (make one before your first build,
rem or copy the file out of the official release zip).

set "RES=%~dp0..\resources"

if not exist "%RES%\app.asar" (
  echo [ERROR] app.asar not found: %RES%
  goto :end
)

if not exist "%RES%\app.asar.orig" (
  echo [INFO] No backup found: %RES%\app.asar.orig
  echo.
  echo   To get the official build back, re-download the release zip:
  echo   https://github.com/Tomjiang678/Perfboard-AutoRoute-3D-Windows/releases/tag/v2.0.0
  echo   then replace resources\app.asar with the one from that zip.
  goto :end
)

echo This will replace app.asar with the OFFICIAL one
echo and drop every patch from this repository.
echo.
choice /c YN /m "Continue"
if errorlevel 2 goto :end

copy /y "%RES%\app.asar.orig" "%RES%\app.asar" >nul
if errorlevel 1 (
  echo [ERROR] Copy failed. Close ProtoRoute 3D first, then retry.
  goto :end
)

echo Done. Official app.asar restored.

:end
echo.
pause
