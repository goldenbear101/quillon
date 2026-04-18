@echo off
echo Quillon — Build Installer
echo.

:: Clear broken cache
set CACHE=%LOCALAPPDATA%\electron-builder\Cache\winCodeSign
if exist "%CACHE%" (
    echo Clearing electron-builder cache...
    rmdir /s /q "%CACHE%"
    echo Cache cleared.
)

:: Disable code signing via environment variable
set CSC_IDENTITY_AUTO_DISCOVERY=false
set WIN_CSC_LINK=
set CSC_LINK=

echo Building Quillon installer...
cd /d C:\projects\Quillon
call npm run electron:build

echo.
echo Done! Check C:\projects\Quillon\release\ for the installer.
pause
