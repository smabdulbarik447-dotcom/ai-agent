@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Shob Paabo AI Agent

where node >nul 2>nul
if errorlevel 1 (
  echo [X] Node.js install kora nei. https://nodejs.org theke LTS version install korun.
  pause
  exit /b 1
)

if not exist .env copy .env.example .env >nul

if not exist node_modules (
  echo [1/3] Package install hocche... ^(prothom bar kichu shomoy lagbe^)
  call npm.cmd install
  if errorlevel 1 goto fail
)

echo [2/3] Build hocche...
call npm.cmd run build
if errorlevel 1 goto fail

echo [3/3] Server chalu hocche: http://localhost:3000
start "" http://localhost:3000
call npm.cmd run start
pause
exit /b 0

:fail
echo.
echo [X] Kono somossa hoyeche. Upore error ta dekhun.
pause
exit /b 1
