"""Schemas para o endpoint /api/v1/gargalos.

Contrato alinhado ao frontend (docs/GUIA-FRONTEND.md / spec F2):
ranking combinado dimensão × transição, ordenado do pior para o melhor.
"""
from pydantic import BaseModel, Field


class GargaloItem(BaseModel):
    dimensao_tipo: str = Field(description="Tipo da dimensão ranqueada: `unidade` ou `especialidade`.")
    dimensao: str = Field(description="Valor da dimensão (ex.: nome da unidade ou da especialidade).")
    transicao: str = Field(description="Código do KPI/transição onde o gargalo foi medido.", examples=["KPI-03", "KPI-05"])
    media: float = Field(description="Tempo médio de espera em dias para esta dimensão/transição.")
    n: int = Field(description="Número de ocorrências consideradas. Interprete com cautela valores baixos.")

    model_config = {
        "json_schema_extra": {
            "example": {
                "dimensao_tipo": "unidade",
                "dimensao": "AMBULATORIO X",
                "transicao": "KPI-05",
                "media": 30.2,
                "n": 1200,
            }
        }
    }


class GargalosResponse(BaseModel):
    items: list[GargaloItem] = Field(description="Ranking ordenado do maior para o menor tempo médio. O primeiro item é o gargalo mais crítico.")
