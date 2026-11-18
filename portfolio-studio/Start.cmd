@echo off
cd /d "%~dp0"
where node >nul 2>&1 || (echo Zainstaluj Node.js 24 LTS. & pause & exit /b 1)
echo Strona: http://127.0.0.1:4180
echo Panel: http://127.0.0.1:4180/admin
node server.mjs
pause
