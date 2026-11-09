# ── Étape 1 : Image de base Python 3.11 ──────────────────────
FROM python:3.11-slim

# Métadonnées
LABEL maintainer="SportBook Team - Marketplace Service"
LABEL description="Microservice Marketplace SportBook (FastAPI + Eureka)"

# Variables d'environnement pour optimiser l'exécution Python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    SERVICE_PORT=8084

# Répertoire de travail dans le conteneur
WORKDIR /app

# Dépendances système minimales
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Installation des dépendances Python (avec cache optimisé)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copie de l'ensemble du code source
COPY . .

# Port d'écoute du microservice
EXPOSE 8084

# Healthcheck natif Docker
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8084/health || exit 1

# Commande d'exécution du serveur ASGI
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8084"]
