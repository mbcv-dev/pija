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


class DistBucket(BaseModel):
    de: float = Field(description="Limite inferior do balde (inclusivo), na unidade do KPI.")
    ate: float | None = Field(None, description="Limite superior (exclusivo). `null` = balde de cauda aberta (>= p95).")
    n: int = Field(description="Número de casos no balde.")


class KpiDistribuicao(BaseModel):
    """Histograma dos tempos de um KPI — mostra a cauda que a mediana esconde."""

    codigo: str = Field(description="Código do KPI.", examples=["KPI-07B"])
    unidade_tempo: str = Field(default="dias", description="Unidade dos valores (mesma do KPI).")
    p50: float | None = Field(None, description="Mediana. `null` sem dados.")
    p95: float | None = Field(None, description="Percentil 95 (teto dos baldes lineares). `null` sem dados.")
    n_total: int = Field(0, description="Total de casos no recorte.")
    buckets: list[DistBucket] = Field(default_factory=list, description="Baldes em ordem: lineares 0→p95 e por último a cauda (ate=null).")

    model_config = {
        "json_schema_extra": {
            "example": {
                "codigo": "KPI-03",
                "unidade_tempo": "dias",
                "p50": 12.4,
                "p95": 64.0,
                "n_total": 1200,
                "buckets": [
                    {"de": 0.0, "ate": 4.0, "n": 310},
                    {"de": 4.0, "ate": 8.0, "n": 280},
                    {"de": 64.0, "ate": None, "n": 60},
                ],
            }
        }
    }


class DistribuicoesResponse(BaseModel):
    distribuicoes: list[KpiDistribuicao] = Field(description="Uma distribuição por KPI solicitado.")
