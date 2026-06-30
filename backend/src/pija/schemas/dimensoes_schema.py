"""Schema do endpoint /api/v1/dimensoes — valores reais para os filtros do frontend."""
from pydantic import BaseModel, Field


class DimensoesResponse(BaseModel):
    grupos: list[str] = Field(description="Grupos de unidade distintos presentes na base.")
    unidades: list[str] = Field(description="Unidades funcionais distintas (exclui inativas).")
    especialidades: list[str] = Field(description="Especialidades médicas distintas presentes na base.")
