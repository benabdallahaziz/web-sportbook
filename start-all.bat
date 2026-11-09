@echo off
title SportBook - Lancement de tous les services
color 0A

echo.
echo  =========================================
echo   SportBook - Demarrage de tous les services
echo  =========================================
echo.

echo [1/7] Verification MySQL (XAMPP)...
sc query MySQL80 >nul 2>&1
if %errorlevel% == 0 (
    echo  OK - MySQL tourne deja
) else (
    echo  Demarrage MySQL via XAMPP...
    start "" "C:\xampp\xampp-control.exe"
    echo  ATTENTION : Clique sur Start dans XAMPP pour MySQL puis appuie sur une touche...
    pause
)

echo.
echo [2/7] Lancement Eureka Server (port 8761)...
start "EUREKA SERVER" cmd /k "cd /d c:\Users\DELL\Documents\Microservice\web-sportbook\eureka-server && mvn spring-boot:run"

echo  Attente 15 secondes pour qu'Eureka demarre...
timeout /t 15 /nobreak >nul

echo.
echo [3/7] Lancement Identity Service (port 8081)...
start "IDENTITY SERVICE" cmd /k "cd /d c:\Users\DELL\Documents\Microservice\web-sportbook\identity-user-service && mvn spring-boot:run"

echo  Attente 10 secondes...
timeout /t 10 /nobreak >nul

echo.
echo [4/7] Lancement API Gateway (port 8085)...
start "API GATEWAY" cmd /k "cd /d c:\Users\DELL\Documents\Microservice\web-sportbook\api-gateway && mvn spring-boot:run"

echo.
echo [5/7] Lancement Tournament Service (port 8086)...
start "TOURNAMENT SERVICE" cmd /k "cd /d c:\Users\DELL\Documents\Microservice\web-sportbook\tournament-events-service && node server.js"

echo.
echo [6/7] Lancement Marketplace Service (port 8084)...
start "MARKETPLACE SERVICE" cmd /k "cd /d c:\Users\DELL\Documents\Microservice\web-sportbook\marketplace-service && uvicorn main:app --host 0.0.0.0 --port 8084 --reload"

echo  Attente 10 secondes pour que les services demarrent...
timeout /t 10 /nobreak >nul

echo.
echo [7/7] Lancement Frontend Angular (port 4200)...
start "FRONTEND ANGULAR" cmd /k "cd /d c:\Users\DELL\Documents\Microservice\web-sportbook\frontend && npm start"

echo.
echo  =========================================
echo   Tous les services sont en cours de demarrage !
echo.
echo   Eureka      : http://localhost:8761
echo   Frontend    : http://localhost:4200
echo   Gateway     : http://localhost:8085
echo   Marketplace : http://localhost:8084/docs
echo   Tournament  : http://localhost:8086
echo  =========================================
echo.
echo  Attends ~30 secondes puis ouvre http://localhost:4200
echo.
pause
