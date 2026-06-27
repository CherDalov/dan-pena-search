@echo off
title Dan Pena Search - Update
cd /d "%~dp0"

REM Double-click this file to refresh the search data and publish it to the
REM live site. It just runs refresh.ps1 - no commands to type.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0refresh.ps1"

echo.
echo ==============================================
echo  Finished. You can close this window now.
echo ==============================================
pause
