from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Base de données
    db_host: str = "localhost"
    db_port: int = 3306
    db_user: str = "root"
    db_password: str = ""
    db_name: str = "sportbook_marketplace"

    # Service
    service_name: str = "marketplace-service"
    service_port: int = 8084
    service_host: str = "localhost"

    # Eureka
    eureka_url: str = "http://localhost:8761/eureka"

    @property
    def database_url(self) -> str:
        return (
            f"mysql+pymysql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
            f"?charset=utf8mb4"
        )

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
