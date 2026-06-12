"""Tipos e utilidades comuns aos mappers."""

from collections.abc import Iterable
from typing import TypedDict


class FatoRow(TypedDict, total=False):
    """Linha pronta para INSERT em fato_eventos_jornada."""

    evento_id: str
    paciente_id: str
    tipo_entidade: str
    entidade_id: str
    timestamp_principal: str
    timestamp_solicitacao: str | None
    timestamp_agendamento: str | None
    timestamp_realizacao: str | None
    timestamp_liberacao: str | None
    timestamp_alta_medica: str | None
    timestamp_alta_administrativa: str | None
    unidade: str | None
    especialidade: str | None
    tipo_evento: str | None
    situacao: str | None


def empty_to_none(value: str | None) -> str | None:
    """Converte string vazia ou só-espaços em None."""
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def first_nonempty(row: dict[str, str], *keys: str) -> str | None:
    """Retorna o primeiro valor não-vazio em row para a lista de keys.

    Útil para colunas que mudam de nome entre views (ex.: prontuario,
    Prontuario, Prontuário, paciente_prontuario).
    """
    for k in keys:
        v = row.get(k)
        if v is not None and v.strip():
            return v.strip()
    return None


def iter_mapped(
    rows: Iterable[dict[str, str]], mapper
) -> Iterable[FatoRow]:
    """Aplica um mapper e descarta None (linhas rejeitadas)."""
    for row in rows:
        result = mapper(row)
        if result is None:
            continue
        if isinstance(result, list):
            yield from result
        else:
            yield result