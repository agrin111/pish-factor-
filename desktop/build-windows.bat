@echo off
chcp 65001 >nul
title ساخت نسخه ویندوزی Aghrin PishFactor
cd /d "%~dp0.."

echo ============================================================
echo   ساخت نسخه ویندوزی Aghrin PishFactor
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [خطا] Node.js نصب نیست.
  echo برای «ساخت» برنامه یک بار Node.js 22 لازم است: https://nodejs.org
  echo نسخه نهایی روی سیستم کاربر به Node.js نیاز ندارد.
  echo.
  pause
  exit /b 1
)

set NEXT_TELEMETRY_DISABLED=1

set NEED_INSTALL=0
if not exist "node_modules\@embedded-postgres\windows-x64\" set NEED_INSTALL=1
if not exist "node_modules\lightningcss-win32-x64-msvc\" set NEED_INSTALL=1
if not exist "node_modules\electron-updater\" set NEED_INSTALL=1

if "%NEED_INSTALL%"=="1" (
  echo [1/3] نصب وابستگی‌ها برای ویندوز... این مرحله فقط یک بار و با اینترنت انجام می‌شود.
  if exist "package-lock.json" del /f /q "package-lock.json" >nul 2>nul
  call npm install --no-audit --no-fund
  if errorlevel 1 goto failed
) else (
  echo [1/3] وابستگی‌ها از قبل نصب شده‌اند.
)

echo.
echo [2/3] ساخت برنامه Next.js...
call npm run build
if errorlevel 1 goto failed

echo.
echo [3/3] ساخت نصب‌کننده و نسخه پرتابل ویندوز...
call npm run desktop:build
if errorlevel 1 goto failed

echo.
echo ============================================================
echo   ساخت با موفقیت انجام شد.
echo   پوشه release باز می‌شود:
echo     AghrinPishFactor-Setup-*.exe    ^<- نصب معمولی (با آپدیت خودکار)
echo     AghrinPishFactor-Portable-*.exe ^<- بدون نصب، فقط دوبار کلیک
echo ============================================================
start "" explorer "%~dp0..\release"
pause
exit /b 0

:failed
echo.
echo [خطا] ساخت کامل نشد. متن خطای بالا را بررسی کنید.
pause
exit /b 1
