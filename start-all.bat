@echo off
title SportBook - Lancement de tous les services
color 0A

set "ROOT_DIR=%~dp0"

echo.
echo  =========================================
echo   SportBook - Demarrage de tous les services
echo  =========================================
echo.

echo [1/8] Verification MySQL (XAMPP)...
sc query MySQL80 >nul 2>&1
if %errorlevel% == 0 (
    echo  OK - MySQL tourne deja
) else (
    echo  Demarrage MySQL via XAMPP...
    if exist "C:\xampp\xampp-control.exe" start "" "C:\xampp\xampp-control.exe"
    echo  ATTENTION : Verifie que MySQL est demarre dans XAMPP puis appuie sur une touche...
    pause
)

echo.
echo [2/8] Lancement Eureka Server (port 8761)...
start "EUREKA SERVER" cmd /k "cd /d %ROOT_DIR%eureka-server && mvn spring-boot:run"

echo  Attente 15 secondes pour qu'Eureka demarre...
timeout /t 15 /nobreak >nul

echo.
echo [3/8] Lancement Identity Service (port 8081)...
start "IDENTITY SERVICE" cmd /k "cd /d %ROOT_DIR%identity-user-service && mvn spring-boot:run"

echo  Attente 10 secondes...
timeout /t 10 /nobreak >nul

echo.
echo [4/8] Lancement API Gateway (port 8085)...
start "API GATEWAY" cmd /k "cd /d %ROOT_DIR%api-gateway && mvn spring-boot:run"

echo.
echo [5/8] Lancement Venue Management Service (port 8082)...
start "VENUE MANAGEMENT SERVICE" cmd /k "cd /d %ROOT_DIR%venue-management-service && .\venv\Scripts\python.exe run.py"

echo.
echo [6/8] Lancement Marketplace Service (port 8084)...
if exist "%ROOT_DIR%marketplace-service" (
    start "MARKETPLACE SERVICE" cmd /k "cd /d %ROOT_DIR%marketplace-service && python main.py"
)

echo.
echo [7/8] Lancement Tournament Service (port 8086)...
if exist "%ROOT_DIR%tournament-events-service" (
    start "TOURNAMENT SERVICE" cmd /k "cd /d %ROOT_DIR%tournament-events-service && node server.js"
)

echo  Attente 10 secondes pour que les services demarrent...
timeout /t 10 /nobreak >nul

echo.
echo [8/8] Lancement Frontend Angular (port 4200)...
start "FRONTEND ANGULAR" cmd /k "cd /d %ROOT_DIR%frontend && npm start"

echo.
echo  =========================================
echo   Tous les services sont en cours de demarrage !
echo.
echo   Eureka            : http://localhost:8761
echo   Frontend (Angular): http://localhost:4200
echo   API Gateway       : http://localhost:8085
echo   Venues (Swagger)  : http://localhost:8082/docs
echo   Marketplace       : http://localhost:8084/docs
echo  =========================================
echo.
echo  Ouvre http://localhost:4200 dans ton navigateur !
echo.
pause
