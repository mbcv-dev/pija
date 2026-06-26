"""Schemas para o endpoint /api/v1/eventos.

Contrato alinhado ao frontend (docs/GUIA-FRONTEND.md / spec F2):
campos string não-nulos — o SQL faz COALESCE de nulos para "".
"""
from pydantic import BaseModel, Field


class EventoItem(BaseModel):
    evento_id: str = Field(description="Identificador único do evento. Prefixo indica o tipo: C- consulta, I- internação, A- alta, E- exame, X- cirurgia, P- prontuário.")
    paciente_id: str = Field(description="Número do prontuário do paciente (anonimizado — sem nome, CPF ou dados pessoais).")
    tipo_entidade: str = Field(description="Tipo do evento clínico.", examples=["CONSULTA", "INTERNACAO", "EXAME", "CIRURGIA", "ALTA", "PRONTUARIO"])
    entidade_id: str = Field(description="Identificador da entidade de origem (num_consulta, id_internacao, etc.).")
    timestamp_principal: str = Field(description="Data e hora principal do evento em formato ISO 8601.", examples=["2026-03-01T10:00:00"])
    unidade: str = Field(description="Unidade funcional do hospital onde o evento ocorreu (vazio quando não se aplica).", examples=["AMBULATORIO X"])
    especialidade: str = Field(description="Especialidade médica relacionada ao evento (vazio quando não se aplica).", examples=["CARDIOLOGIA"])
    tipo_evento: str = Field(description="Subtipo/descrição do evento (vazio quando não se aplica).")
    situacao: str = Field(description="Situação ou status do evento (vazio quando não se aplica).", examples=["PACIENTE ATENDIDO", "ALTA HOSPITALAR"])

    model_config = {
        "json_schema_extra": {
            "example": {
                "evento_id": "C-98712",
                "paciente_id": "345678",
                "tipo_entidade": "CONSULTA",
                "entidade_id": "98712",
                "timestamp_principal": "2026-03-01T10:00:00",
                "unidade": "AMBULATORIO X",
                "especialidade": "CARDIOLOGIA",
                "tipo_evento": "Consulta de retorno",
                "situacao": "PACIENTE ATENDIDO",
            }
        }
    }


class EventosResponse(BaseModel):
    items: list[EventoItem] = Field(description="Lista de eventos desta página.")
    total: int = Field(description="Total de registros encontrados com os filtros aplicados (sem paginação).")
    limit: int = Field(description="Número máximo de itens retornados nesta página.")
    offset: int = Field(description="Posição inicial desta página no conjunto total de resultados.")
