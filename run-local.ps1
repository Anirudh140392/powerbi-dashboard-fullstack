Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "  Starting PowerBI Dashboard Fullstack (All Services)" -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Cyan

Write-Host "`n[1/2] Starting Backend Microservices (Ports 5000, 5001, 3001, 8000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; npm run dev"

Write-Host "[2/2] Starting Frontend Vite Server (Port 9500)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npx vite"

Write-Host "`n====================================================================" -ForegroundColor Cyan
Write-Host "  All services launched in dedicated terminal windows!" -ForegroundColor Green
Write-Host "  Dashboard URL: http://localhost:9500" -ForegroundColor White
Write-Host "====================================================================" -ForegroundColor Cyan

Start-Sleep -Seconds 4
Start-Process "http://localhost:9500"
