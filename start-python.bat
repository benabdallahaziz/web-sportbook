@echo off
title SportBook - Services Python
color 0B

set "ROOT_DIR=%~dp0"

echo.
echo  =========================================
echo   SportBook - Demarrage des services Python
echo  =========================================
echo.
echo  Chaque service a son propre environnement (venv), cree et installe
echo  automatiquement au premier lancement (quelques minutes la 1re fois).
echo.

REM ---- Verifications ----
where python >nul 2>&1
if errorlevel 1 (
    echo  ERREUR : Python introuvable. Installe Python 3.11+ et coche "Add to PATH".
    pause
    exit /b 1
)

curl -s -o nul --max-time 3 http://localhost:8761/
if errorlevel 1 (
    echo  ATTENTION : Eureka ^(8761^) ne repond pas.
    echo  Les services vont demarrer, mais la Gateway ne pourra pas les trouver.
    echo  Lance start-all.bat pour tout demarrer, ou Eureka + Gateway a la main.
    echo.
)

REM ---- Lancement ----
echo [1/4] Venue Management Service (port 8082)...
start "VENUE MANAGEMENT SERVICE" cmd /k "cd /d %ROOT_DIR%venue-management-service && call "%ROOT_DIR%venue-management-service\run.bat""

echo [2/4] Marketplace Service (port 8084)...
start "MARKETPLACE SERVICE" cmd /k "cd /d %ROOT_DIR%marketplace-service && call "%ROOT_DIR%marketplace-service\start.bat""

echo [3/4] Recommendation Service (port 8090)...
start "RECOMMENDATION SERVICE" cmd /k "cd /d %ROOT_DIR%recommendation-service && call "%ROOT_DIR%recommendation-service\run.bat""

echo [4/4] Stats Service - classement Elo (port 8088)...
start "STATS SERVICE (PYTHON)" cmd /k "cd /d %ROOT_DIR%stats-service-python && call "%ROOT_DIR%stats-service-python\run.bat""

echo.
echo  =========================================
echo   Services Python en cours de demarrage
echo.
echo   Venue          : http://localhost:8082/docs
echo   Marketplace    : http://localhost:8084/docs
echo   Recommandation : http://localhost:8090/docs
echo   Stats          : http://localhost:8088/api-docs
echo  =========================================
echo.
pause
