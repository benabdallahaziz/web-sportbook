@echo off
REM Lance le service avec son propre environnement Python.
REM Les dependances sont (re)installees tant que venv\.installed n existe pas.
cd /d "%~dp0"
if not exist "venv\Scripts\python.exe" (
    echo Creation de l environnement virtuel...
    python -m venv venv
)
if not exist "venv\.installed" (
    echo Installation des dependances...
    venv\Scripts\python.exe -m pip install --upgrade pip
    venv\Scripts\python.exe -m pip install -r requirements.txt
    if errorlevel 1 (
        echo ERREUR : installation des dependances echouee. Relance ce script.
        pause
        exit /b 1
    )
    echo ok> venv\.installed
)
venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 8090
