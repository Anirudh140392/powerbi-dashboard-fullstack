@echo off
REM ==============================================================================
REM Automated Daily API Alert Report Runner (Windows Task Scheduler)
REM ==============================================================================
setlocal
cd /d "%~dp0"

if not exist "logs" mkdir "logs"

echo [%DATE% %TIME%] Triggering JS API Alert Report... >> "logs\scheduler_output.log"
node ..\backend\src\scripts\sendApiAlertReport.js --now >> "logs\scheduler_output.log" 2>&1
echo [%DATE% %TIME%] Run completed with exit code %ERRORLEVEL%. >> "logs\scheduler_output.log"

endlocal
