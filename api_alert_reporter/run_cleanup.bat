@echo off
REM ==============================================================================
REM Automated 1:00 AM API Logs Cleanup Runner (Windows Task Scheduler)
REM ==============================================================================
setlocal
cd /d "%~dp0"

if not exist "logs" mkdir "logs"

echo [%DATE% %TIME%] Triggering JS 1:00 AM API Logs Retention Cleanup... >> "logs\scheduler_output.log"
node ..\backend\src\scripts\cleanupApiLogs.js >> "logs\scheduler_output.log" 2>&1
echo [%DATE% %TIME%] Cleanup completed with exit code %ERRORLEVEL%. >> "logs\scheduler_output.log"

endlocal
