import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "venue-management-service"
    PORT: int = 8082
    HOST: str = "0.0.0.0"

    # Database settings (MySQL / XAMPP)
    DB_HOST: str = "127.0.0.1"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    DB_PASSWORD: str = ""
    DB_NAME: str = "sportbook_venue"
    
    # Custom DATABASE_URL if provided, otherwise computed
    DATABASE_URL: str | None = None

    # Eureka Discovery Server
    EUREKA_SERVER: str = "http://localhost:8761/eureka"
    EUREKA_ENABLED: bool = True
    INSTANCE_HOST: str = "127.0.0.1"

    # RabbitMQ (Séance 8 - Communication Asynchrone)
    RABBITMQ_HOST: str = "localhost"
    RABBITMQ_PORT: int = 5672
    RABBITMQ_USER: str = "guest"
    RABBITMQ_PASSWORD: str = "guest"
    RABBITMQ_EXCHANGE: str = "sportbook.events"
    RABBITMQ_ENABLED: bool = False  # Enabled if RabbitMQ is running

    # Sécurité & Keycloak / JWT (Séance 9 - Sécurité Microservices)
    SECURITY_ENABLED: bool = False  # Set to True when Keycloak/JWT protection is enforced
    JWT_SECRET_KEY: str = "sportbook-secret-key-super-secure-change-in-prod"
    JWT_ALGORITHM: str = "HS256"
    KEYCLOAK_URL: str = "http://localhost:8080"
    KEYCLOAK_REALM: str = "sportbook"
    KEYCLOAK_CLIENT_ID: str = "venue-management-service"

    # Communication Synchrone Inter-Microservice (Séance 7 - OpenFeign / REST)
    IDENTITY_SERVICE_URL: str = "http://localhost:8081"
    GATEWAY_URL: str = "http://localhost:8085"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    def get_database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        # MySQL URL with pymysql driver
        pwd = f":{self.DB_PASSWORD}" if self.DB_PASSWORD else ""
        return f"mysql+pymysql://{self.DB_USER}{pwd}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset=utf8mb4"


settings = Settings()
