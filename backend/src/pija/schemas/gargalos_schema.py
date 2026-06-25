"""Schemas para o endpoint /api/v1/gargalos."""
from pydantic import BaseModel, Field


class GargaloItem(BaseModel):
    tipo_entidade: str = Field(description="Tipo de evento clínico onde o gargalo foi identificado.", examples=["CONSULTA", "INTERNACAO", "EXAME"])
    grupo: str = Field(description="Grupo assistencial com maior tempo médio de espera.", examples=["Ambulatorial", "Diagnóstico por Imagem", "Internação"])
    especialidade: str = Field(description="Especialidade médica dentro do grupo.", examples=["ONCOLOGIA CLÍNICA", "NEUROLOGIA CLÍNICA"])
    media_espera_dias: float = Field(description="Tempo médio de espera em dias para este tipo de evento nesta unidade/especialidade.")
    n: int = Field(description="Número de ocorrências consideradas no cálculo. Interprete com cautela valores abaixo de 30.")

    model_config = {
        "json_schema_extra": {
            "example": {
                "tipo_entidade": "CONSULTA",
                "grupo": "ONCOLOGIA",
                "especialidade": "ONCOLOGIA CLÍNICA",
                "media_espera_dias": 32.7,
                "n": 145,
            }
        }
    }


class GargalosResponse(BaseModel):
    filtros_aplicados: dict[str, str | None] = Field(description="Espelho dos filtros recebidos na requisição.")
    ranking: list[GargaloItem] = Field(description="Ranking ordenado do maior para o menor tempo médio de espera. O primeiro item é o gargalo mais crítico.")

    model_config = {
        "json_schema_extra": {
            "example": {
                "filtros_aplicados": {"grupo": None, "especialidade": None, "tipo_entidade": None, "data_inicio": None, "data_fim": None},
                "ranking": [
                    {"tipo_entidade": "CONSULTA", "grupo": "ONCOLOGIA", "especialidade": "ONCOLOGIA CLÍNICA", "media_espera_dias": 32.7, "n": 145},
                    {"tipo_entidade": "CONSULTA", "grupo": "NEUROLOGIA", "especialidade": "NEUROLOGIA CLÍNICA", "media_espera_dias": 28.1, "n": 89},
                    {"tipo_entidade": "INTERNACAO", "grupo": "CARDIOLOGIA", "especialidade": "CARDIOLOGIA CLÍNICA", "media_espera_dias": 18.4, "n": 210},
                ],
            }
        }
    }
