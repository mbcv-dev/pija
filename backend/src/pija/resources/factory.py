"""DI factory para o adapter Resource — escolhe CSV ou AGHU por env."""

from pija.resources.aghu_resource import AghuResource
from pija.resources.base_resource import BaseResource
from pija.resources.csv_resource import CsvResource
from pija.settings import Settings


def get_resource(settings: Settings | None = None) -> BaseResource:
    """Retorna a instância de Resource conforme settings.resource_mode.

    Pode ser injetado em endpoints FastAPI via `Depends(get_resource)`.
    """
    settings = settings or Settings()
    if settings.resource_mode == "csv":
        return CsvResource(csv_dir=settings.csv_dir)
    if settings.resource_mode == "aghu":
        return AghuResource(dsn=settings.aghu_dsn)
    raise ValueError(f"RESOURCE_MODE desconhecido: {settings.resource_mode}")