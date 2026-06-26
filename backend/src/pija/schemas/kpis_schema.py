"""Schemas para o endpoint /api/v1/kpis.

Contrato alinhado ao frontend (docs/GUIA-FRONTEND.md / spec F2):
cada KPI traz a média global e um breakdown por dimensão (group_by).
"""
from pydantic import BaseModel, Field


class KpiBreakdownItem(BaseModel):
    dimensao: str = Field(description="Valor da dimensão do breakdown (unidade ou especialidade).")
    media: float = Field(description="Tempo médio em dias para esta dimensão.")
    n: int = Field(description="Número de casos considerados nesta dimensão.")


class KpiResult(BaseModel):
    codigo: str = Field(description="Código do KPI conforme especificação.", examples=["KPI-01", "KPI-03", "KPI-07"])
    descricao: str = Field(description="Descrição legível do que o KPI mede.")
    unidade_tempo: str = Field(default="dias", description="Unidade de tempo das médias.")
    media_global: float | None = Field(None, description="Tempo médio em dias sobre todo o recorte. `null` quando não há dados.")
    n_global: int = Field(0, description="Número total de casos considerados no cálculo global.")
    breakdown: list[KpiBreakdownItem] = Field(default_factory=list, description="Quebra por dimensão, já ordenada do maior para o menor tempo.")

    model_config = {
        "json_schema_extra": {
            "example": {
                "codigo": "KPI-03",
                "descricao": "Agendamento → realização (consulta)",
                "unidade_tempo": "dias",
                "media_global": 12.4,
                "n_global": 1200,
                "breakdown": [
                    {"dimensao": "AMBULATORIO X", "media": 15.1, "n": 420},
                    {"dimensao": "AMBULATORIO Y", "media": 9.8, "n": 310},
                ],
            }
        }
    }


class KpisResponse(BaseModel):
    kpis: list[KpiResult] = Field(description="Lista com os KPIs calculados.")
