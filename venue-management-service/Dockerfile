# Image de base Python optimisée et légère
FROM python:3.10-slim

# Configuration des variables d'environnement
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8082

WORKDIR /app

# Installation des dépendances système nécessaires
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copie et installation des dépendances Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copie du code source du microservice
COPY . .

# Exposition du port du microservice
EXPOSE 8082

# Healthcheck Docker basé sur l'endpoint Actuator
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8082/actuator/health || exit 1

# Commande de démarrage avec Uvicorn
CMD ["python", "run.py"]
