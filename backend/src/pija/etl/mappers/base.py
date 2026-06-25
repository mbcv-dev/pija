"""Tipos e utilidades comuns aos mappers."""

from collections.abc import Callable, Iterable
from typing import Required, TypedDict


class FatoRow(TypedDict, total=False):
    """Linha pronta para INSERT em fato_eventos_jornada.

    Chaves marcadas Required são obrigatórias (conforme schema
    fato_eventos_jornada). As outras são opcionais por entidade.

    Convenção de prefixos em `evento_id`:
        P-{id}    → PRONTUARIO
        C-{id}    → CONSULTA
        PA-{id}   → PROCEDIMENTO (de vw_consultas com tipo=PROCEDIMENTO)
        E-{id}    → EXAME
        I-{id}    → INTERNACAO
        A-{id}    → ALTA (derivada de INTERNACAO)
        X-{id}    → CIRURGIA
    """

    evento_id: Required[str]
    paciente_id: Required[str]
    tipo_entidade: Required[str]
    entidade_id: Required[str]
    timestamp_principal: Required[str]
    timestamp_solicitacao: str | None
    timestamp_agendamento: str | None
    timestamp_realizacao: str | None
    timestamp_liberacao: str | None
    timestamp_alta_medica: str | None
    timestamp_alta_administrativa: str | None
    unidade: str | None
    grupo: str | None
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


# Mappers can return None (rejected), a single FatoRow, or a list of FatoRows
# (e.g., INTERNACAO emits both INTERNACAO and derived ALTA — Task 13).
Mapper = Callable[[dict[str, str]], FatoRow | list[FatoRow] | None]


def iter_mapped(
    rows: Iterable[dict[str, str]], mapper: Mapper
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