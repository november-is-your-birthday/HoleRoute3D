@echo off
setlocal
title Restore original ProtoRoute 3D

set "RES=%~dp0resources"

if not exist "%RES%\app.asar.orig" (
  echo.
  echo [ERROR] Backup not found: %RES%\app.asar.orig
  echo Nothing to restore.
  goto :end
)

echo.
echo This will restore the ORIGINAL app.asar and remove the
echo LiChuang / EasyEDA netlist support patch.
echo.
choice /c YN /m "Continue"
if errorlevel 2 goto :end

copy /y "%RES%\app.asar.orig" "%RES%\app.asar" >nul
if errorlevel 1 (
  echo.
  echo [ERROR] Copy failed. Close ProtoRoute 3D first, then retry.
  goto :end
)

echo.
echo Done. Original version restored.

:end
echo.
pause
