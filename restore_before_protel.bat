@echo off
setlocal
title Restore state before Protel support

set "RES=%~dp0resources"

if not exist "%RES%\app.asar.before_protel" (
  echo.
  echo [ERROR] Backup not found: %RES%\app.asar.before_protel
  echo Nothing to restore.
  goto :end
)

echo.
echo This restores the app.asar from BEFORE the Protel / LCEDA
echo netlist support was added.
echo Other patches (EasyEDA missing libsource, Chinese UI) are kept.
echo.
choice /c YN /m "Continue"
if errorlevel 2 goto :end

copy /y "%RES%\app.asar.before_protel" "%RES%\app.asar" >nul
if errorlevel 1 (
  echo.
  echo [ERROR] Copy failed. Close ProtoRoute 3D first, then retry.
  goto :end
)

echo.
echo Done. Protel support removed.

:end
echo.
pause
