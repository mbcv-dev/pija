from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configurações da aplicação carregadas do ambiente / .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Modo de fonte de dados
    resource_mode: Literal["csv", "aghu"] = "csv"

    # Banco local
    sqlite_path: str = "./backend/data/pija.db"

    # Auth
    jwt_secret: str = Field(..., min_length=32)
    jwt_access_ttl_seconds: int = 900       # 15 min
    jwt_refresh_ttl_seconds: int = 604800   # 7 dias
    users_yml_path: str = "./backend/users.yml"

    # Fonte CSV (MVP)
    csv_dir: str = "./CSV-aghu"

    # CORS (Fase 4) — origens permitidas, separadas por vírgula
    cors_origins: str = ""

    # Fonte AGHU (Fase 5)
    aghu_dsn: str = ""
    ldap_uri: str = ""

    def cors_origins_list(self) -> list[str]:
        """Lista de origens permitidas para CORS (ignora vazios e espaços)."""
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]