@echo off
echo ============================================
echo   SportBook - Marketplace Service
echo   Port 8084 - Eureka: marketplace-service
echo ============================================

REM Creer le venv si pas encore fait
if not exist venv (
    echo [1/3] Creation du virtual environment...
    python -m venv venv
)

REM Activer le venv
echo [2/3] Activation du venv...
call venv\Scripts\activate.bat

REM Installer les dependances
echo [3/3] Installation des dependances...
pip install -r requirements.txt --quiet

REM Demarrer le service
echo.
echo Demarrage sur http://localhost:8084
echo Swagger UI : http://localhost:8084/docs
echo.
uvicorn main:app --host 0.0.0.0 --port 8084 --reload
