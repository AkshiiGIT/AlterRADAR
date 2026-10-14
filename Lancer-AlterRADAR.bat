@echo off
setlocal
cd /d "%~dp0"
echo.
echo AlterRADAR - Demarrage local
where node >nul 2>nul
if errorlevel 1 goto :missing
where npm >nul 2>nul
if errorlevel 1 goto :missing
if not exist "node_modules\electron" (
  echo Premiere ouverture : installation des dependances...
  call npm install
  if errorlevel 1 goto :error
)
call npm start
pause
exit /b %errorlevel%
:missing
echo Node.js LTS doit etre installe depuis https://nodejs.org
pause
exit /b 1
:error
echo Erreur d'installation.
pause
exit /b 1
