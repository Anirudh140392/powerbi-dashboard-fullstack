# ==============================================================================
# Script to register daily 9:00 AM and 1:00 AM Task Scheduler jobs on Windows
# ==============================================================================
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

# ------------------------------------------------------------------------------
# 1. 09:00 AM IST Email Report Task
# ------------------------------------------------------------------------------
$ReportTaskName = "Trailytics_API_Alert_Daily_Report"
$ReportBatchPath = Join-Path $ScriptDir "run_report.bat"

Write-Host "Registering Scheduled Task 1: $ReportTaskName" -ForegroundColor Cyan
Write-Host "  - Target: $ReportBatchPath" -ForegroundColor Gray
Write-Host "  - Schedule: Daily at 09:00 AM IST" -ForegroundColor Gray

try {
    $action1 = New-ScheduledTaskAction -Execute $ReportBatchPath -WorkingDirectory $ScriptDir
    $trigger1 = New-ScheduledTaskTrigger -Daily -At 9:00AM
    $settings1 = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
    Register-ScheduledTask -TaskName $ReportTaskName -Action $action1 -Trigger $trigger1 -Settings $settings1 -Description "Sends daily 9:00 AM IST API Alert monitoring report via Outlook" -Force | Out-Null
    Write-Host "  ✅ Registered successfully!" -ForegroundColor Green
} catch {
    schtasks /create /tn $ReportTaskName /tr "`"$ReportBatchPath`"" /sc daily /st 09:00 /f
}

# ------------------------------------------------------------------------------
# 2. 01:00 AM IST Day -1 Retention Cleanup Task
# ------------------------------------------------------------------------------
$CleanupTaskName = "Trailytics_API_Logs_Cleanup"
$CleanupBatchPath = Join-Path $ScriptDir "run_cleanup.bat"

Write-Host "`nRegistering Scheduled Task 2: $CleanupTaskName" -ForegroundColor Cyan
Write-Host "  - Target: $CleanupBatchPath" -ForegroundColor Gray
Write-Host "  - Schedule: Daily at 01:00 AM IST" -ForegroundColor Gray

try {
    $action2 = New-ScheduledTaskAction -Execute $CleanupBatchPath -WorkingDirectory $ScriptDir
    $trigger2 = New-ScheduledTaskTrigger -Daily -At 1:00AM
    $settings2 = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
    Register-ScheduledTask -TaskName $CleanupTaskName -Action $action2 -Trigger $trigger2 -Settings $settings2 -Description "Deletes expired day -1 data from admin_master.api_logs table at 1:00 AM IST" -Force | Out-Null
    Write-Host "  ✅ Registered successfully!" -ForegroundColor Green
} catch {
    schtasks /create /tn $CleanupTaskName /tr "`"$CleanupBatchPath`"" /sc daily /st 01:00 /f
}

Write-Host "`nBoth scheduled tasks are active and ready!" -ForegroundColor Green
Write-Host "To view tasks:   schtasks /query /tn `"Trailytics*`"" -ForegroundColor Yellow
Write-Host "To test 9AM now: schtasks /run /tn `"$ReportTaskName`"" -ForegroundColor Yellow
Write-Host "To test 1AM now: schtasks /run /tn `"$CleanupTaskName`"" -ForegroundColor Yellow
