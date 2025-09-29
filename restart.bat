@echo off
echo Starting Abai Springs Web App...
echo.

echo Starting Backend Server...
start "Backend Server" cmd /k "cd backend && node server.js"

echo.
echo Waiting 3 seconds for backend to start...
timeout /t 3 /nobreak > nul

echo.
echo Starting Frontend Server...
start "Frontend Server" cmd /k "npx http-server . -p 5500 -o"

echo.
echo Opening browser...
timeout /t 2 /nobreak > nul
start http://localhost:5500

echo.
echo ✅ Abai Springs Web App is starting!
echo Backend: http://localhost:5001
echo Frontend: http://localhost:5500
echo.
pause 