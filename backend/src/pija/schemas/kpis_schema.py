"""Schemas para o endpoint /api/v1/kpis."""
from pydantic import BaseModel, Field


class KpiResult(BaseModel):
    codigo: str = Field(description="Código do KPI conforme especificação.", examples=["KPI-01", "KPI-03", "KPI-07"])
    descricao: str = Field(description="Descrição legível do que o KPI mede.")
    media_dias: float | None = Field(None, description="Tempo médio em dias calculado sobre a base filtrada. `null` quando o dado não está disponível.")
    n: int | None = Field(None, description="Número de pares de eventos usados no cálculo. Valores baixos indicam pouca representatividade estatística.")
    aviso: str | None = Field(None, description="Mensagem de aviso quando o KPI tem limitações conhecidas nos dados.")

    model_config = {
        "json_schema_extra": {
            "example": {
                "codigo": "KPI-01",
                "descricao": "Prontuário → 1º evento",
                "media_dias": 12.4,
                "n": 830,
                "aviso": None,
            }
        }
    }


class KpisResponse(BaseModel):
    filtros_aplicados: dict[str, str | None] = Field(description="Espelho dos filtros recebidos na requisição. Campos `null` indicam que nenhum filtro foi aplicado.")
    kpis: list[KpiResult] = Field(description="Lista com os 5 KPIs calculados.")

    model_config = {
        "json_schema_extra": {
            "example": {
                "filtros_aplicados": {
                    "grupo": None,
                    "especialidade": "CARDIOLOGIA CLÍNICA",
                    "data_inicio": "2023-01-01",
                    "data_fim": "2023-12-31",
                },
                "kpis": [
                    {"codigo": "KPI-01", "descricao": "Prontuário → 1º evento", "media_dias": 12.4, "n": 830, "aviso": None},
                    {"codigo": "KPI-03", "descricao": "Agendamento → realização (consulta)", "media_dias": 8.1, "n": 1200, "aviso": None},
                    {"codigo": "KPI-05", "descricao": "Solicitação → realização (exame)", "media_dias": None, "n": None, "aviso": "Aguardando confirmação HC sobre range temporal dos dados de exame"},
                    {"codigo": "KPI-06", "descricao": "Última consulta → internação subsequente", "media_dias": 45.3, "n": 210, "aviso": None},
                    {"codigo": "KPI-07", "descricao": "Tempo de permanência no leito", "media_dias": 3.2, "n": 540, "aviso": "Inclui período entre alta médica e liberação do leito (relevante em obstetrícia)"},
                ],
            }
        }
    }
