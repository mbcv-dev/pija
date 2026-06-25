"""Schemas para o endpoint /api/v1/eventos."""
from pydantic import BaseModel, Field


class EventoItem(BaseModel):
    evento_id: str = Field(description="Identificador único do evento. Prefixo indica o tipo: C- consulta, I- internação, A- alta, E- exame, CIR- cirurgia, P- prontuário.")
    paciente_id: str = Field(description="Número do prontuário do paciente (anonimizado — sem nome, CPF ou dados pessoais).")
    tipo_entidade: str = Field(description="Tipo do evento clínico.", examples=["CONSULTA", "INTERNACAO", "EXAME", "CIRURGIA", "ALTA", "PRONTUARIO"])
    timestamp_principal: str | None = Field(None, description="Data e hora principal do evento em formato ISO 8601.", examples=["2023-08-15T14:30:00"])
    grupo: str | None = Field(None, description="Grupo assistencial ao qual o evento pertence.", examples=["Ambulatorial", "Análises Clínicas", "Diagnóstico por Imagem", "Internação"])
    especialidade: str | None = Field(None, description="Especialidade médica relacionada ao evento.", examples=["CARDIOLOGIA CLÍNICA", "ONCOLOGIA CLÍNICA"])
    situacao: str | None = Field(None, description="Situação ou status do evento.", examples=["REALIZADO", "CANCELADO", "ALTA HOSPITALAR"])

    model_config = {
        "json_schema_extra": {
            "example": {
                "evento_id": "C-98712",
                "paciente_id": "345678",
                "tipo_entidade": "CONSULTA",
                "timestamp_principal": "2023-08-15T14:30:00",
                "grupo": "Ambulatorial",
                "especialidade": "CARDIOLOGIA CLÍNICA",
                "situacao": "REALIZADO",
            }
        }
    }


class EventosResponse(BaseModel):
    total: int = Field(description="Total de registros encontrados com os filtros aplicados (sem paginação).")
    limit: int = Field(description="Número máximo de itens retornados nesta página.")
    offset: int = Field(description="Posição inicial desta página no conjunto total de resultados.")
    items: list[EventoItem] = Field(description="Lista de eventos desta página.")

    model_config = {
        "json_schema_extra": {
            "example": {
                "total": 4820,
                "limit": 2,
                "offset": 0,
                "items": [
                    {
                        "evento_id": "C-98712",
                        "paciente_id": "345678",
                        "tipo_entidade": "CONSULTA",
                        "timestamp_principal": "2023-08-15T14:30:00",
                        "grupo": "Ambulatorial",
                        "especialidade": "CARDIOLOGIA CLÍNICA",
                        "situacao": "REALIZADO",
                    },
                    {
                        "evento_id": "I-11043",
                        "paciente_id": "345678",
                        "tipo_entidade": "INTERNACAO",
                        "timestamp_principal": "2023-09-02T08:00:00",
                        "grupo": "Ambulatorial",
                        "especialidade": "CARDIOLOGIA CLÍNICA",
                        "situacao": "ALTA HOSPITALAR",
                    },
                ],
            }
        }
    }
