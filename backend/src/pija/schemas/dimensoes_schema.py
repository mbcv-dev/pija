"""Schema do endpoint /api/v1/dimensoes — valores reais para os filtros do frontend."""
from pydantic import BaseModel, Field


class UnidadeDim(BaseModel):
    """Unidade executora anotada com o grupo assistencial (para agrupar no filtro)."""

    valor: str = Field(description="Nome da unidade funcional.")
    grupo: str | None = Field(default=None, description="Grupo assistencial da unidade.")


class DimensoesResponse(BaseModel):
    grupos: list[str] = Field(description="Grupos de unidade distintos presentes na base.")
    unidades: list[UnidadeDim] = Field(description="Unidades funcionais distintas (exclui inativas), anotadas com o grupo.")
    especialidades: list[str] = Field(description="Especialidades médicas distintas presentes na base.")
