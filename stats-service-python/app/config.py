"""Configuration lue dans les variables d'environnement (ou le fichier .env)."""
import os

from dotenv import load_dotenv

load_dotenv()

SERVICE_NAME = "stats-service"          # nom enregistré dans Eureka (lb://stats-service)
VERSION = "1.0.0"
PORT = int(os.getenv("PORT", "8088"))
HOST = os.getenv("HOST", "localhost")

DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://root:@localhost:3306/sportbook_stats")
EUREKA_SERVER = os.getenv("EUREKA_SERVER", "http://localhost:8761/eureka").rstrip("/")
RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")

TOURNAMENT_SERVICE = os.getenv("TOURNAMENT_SERVICE", "tournament-events-service")
TOURNAMENT_FALLBACK_URL = os.getenv("TOURNAMENT_FALLBACK_URL", "http://localhost:8086").rstrip("/")
