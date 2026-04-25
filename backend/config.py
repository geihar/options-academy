from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    polygon_api_key: Optional[str] = None
    cache_ttl: int = 900  # 15 minutes
    risk_free_rate: float = 0.05
    database_url: str = "sqlite:///./options_academy.db"
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
