@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================
echo   TL-Organizer  -  deploy to MIDAS
echo ============================================
echo.

where curl.exe >nul 2>&1
if errorlevel 1 (
  echo [FEHLER] curl.exe not found. Windows 10/11 has it built in.
  pause
  exit /b 1
)
where tar.exe >nul 2>&1
if errorlevel 1 (
  echo [FEHLER] tar.exe not found. Windows 10/11 has it built in.
  pause
  exit /b 1
)

set "ARCHIVE=%TEMP%\tl-organizer.tgz"
if exist "%ARCHIVE%" del "%ARCHIVE%"

rem Platzhalter statt echter Supabase-Keys: bis Etappe 3 importieren die Seiten
rem noch den Supabase-Client und der Build braucht die Variablen.
if not exist ".env.local" (
  > .env.production echo NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
  >> .env.production echo NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key-not-a-real-credential
  echo [1/3] .env.production: placeholders ^(no real keys in the image^)
) else (
  findstr /b "NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY=" .env.local > .env.production
  echo [1/3] .env.production: taken from .env.local
)

echo [2/3] Packing...
tar -czf "%ARCHIVE%" --exclude=./.git --exclude=./.github --exclude=./.claude --exclude=./node_modules --exclude=./.next --exclude=./e2e --exclude=./design --exclude=./docs --exclude=./playwright-report --exclude=./test-results --exclude=./.env.local --exclude=./deploy-midas.cmd .
if errorlevel 1 (
  echo [FEHLER] packing failed.
  del .env.production 2>nul
  pause
  exit /b 1
)
del .env.production 2>nul
for %%A in ("%ARCHIVE%") do echo       archive: %%~zA bytes

echo.
set "MIDAS_TOKEN="
set /p "MIDAS_TOKEN=Paste your token from midas.mifcom.dev/account and press Enter: "
if "!MIDAS_TOKEN!"=="" (
  echo [FEHLER] no token.
  pause
  exit /b 1
)

echo.
echo [3/3] Uploading to MIDAS, this takes 1-2 minutes...
echo.
curl -X POST https://midas.mifcom.dev/api/v1/deploy -H "Authorization: Bearer !MIDAS_TOKEN!" -F "name=tl-organizer" -F "tarball=@%ARCHIVE%" -F "visibility=unlisted" -F "description=Internal task and time dashboard for the MIFCOM PC assembly team: who is working on what, where, and how long it actually took."

echo.
echo.
echo ============================================
echo   Done. Copy the answer above into the chat.
echo ============================================
pause
