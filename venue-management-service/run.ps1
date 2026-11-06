Set-Location -Path $PSScriptRoot

if (-not (Test-Path -Path "venv")) {
    Write-Host "Création de l'environnement virtuel venv..." -ForegroundColor Cyan
    python -m venv venv
    & ".\venv\Scripts\python.exe" -m pip install -r requirements.txt
}

Write-Host "Démarrage du microservice Venue Management sur le port 8082..." -ForegroundColor Green
& ".\venv\Scripts\python.exe" run.py
