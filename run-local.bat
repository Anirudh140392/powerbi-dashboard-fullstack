@echo off
title Trailytics PowerBI Dashboard - Fullstack
echo ====================================================================
echo   Starting PowerBI Dashboard Fullstack (All Services)
echo ====================================================================
echo.
echo [1/2] Starting Backend Microservices (Ports 5000, 5001, 3001, 8000)...
start "Trailytics - Backends" cmd /k "cd backend && npm run dev"

echo [2/2] Starting Frontend Vite Server (Port 9500)...
start "Trailytics - Frontend" cmd /k "cd frontend && npx vite"

echo.
echo ====================================================================
echo   All services are launching!
echo   Open your browser at: http://localhost:9500
echo ====================================================================
timeout /t 5
start http://localhost:9500
