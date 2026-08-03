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
    ate: float | None = Field(None, description="Limite superior (exclusivo). `null` = balde de cauda aberta (todos os casos >= `de`).")
    n: int = Field(description="Número de casos no balde.")


class KpiDistribuicao(BaseModel):
    """Histograma dos tempos de um KPI — mostra a cauda que a mediana esconde."""

    codigo: str = Field(description="Código do KPI.", examples=["KPI-07B"])
    unidade_tempo: str = Field(default="dias", description="Unidade dos valores (mesma do KPI).")
    p50: float | None = Field(None, description="Mediana. `null` sem dados.")
    p95: float | None = Field(None, description="Percentil 95 dos valores. `null` sem dados. Costuma ser igual ao `teto`, mas quem define o eixo é o `teto`.")
    teto: float | None = Field(None, description="Teto dos baldes lineares — é este o limite do eixo do gráfico, e é sempre igual a `buckets[-1].de`. Normalmente é o p95; quando p95 = 0 (>= 95% dos casos zerados, situação do KPI-07B) cai no valor MÁXIMO, senão a cauda, que é o objeto do histograma, sumiria. `null` sem dados.")
    n_total: int = Field(0, description="Total de casos no recorte.")
    buckets: list[DistBucket] = Field(default_factory=list, description="Baldes em ordem: os lineares de 0 até o teto e, por último, a cauda aberta (`ate=null`). O teto é o p95, ou o máximo quando p95 = 0 (>= 95% dos casos zerados), para a cauda não desaparecer. Se todos os casos forem 0, sai um único balde aberto em 0. Vazio quando não há casos.")

    model_config = {
        "json_schema_extra": {
            "example": {
                "codigo": "KPI-03",
                "unidade_tempo": "dias",
                "p50": 12.4,
                "p95": 64.0,
                "teto": 64.0,
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
