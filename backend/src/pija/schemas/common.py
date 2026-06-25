"""Schemas e enums compartilhados entre endpoints."""
from enum import Enum


class TipoEntidadeEnum(str, Enum):
    """Tipos de entidades no fato_eventos_jornada.

    Conforme 04-modelo-dados.md §3 e docs/DADOS-ESTADO.md §4.
    """

    PRONTUARIO = "PRONTUARIO"
    CONSULTA = "CONSULTA"
    PROCEDIMENTO = "PROCEDIMENTO"
    EXAME = "EXAME"
    INTERNACAO = "INTERNACAO"
    ALTA = "ALTA"
    CIRURGIA = "CIRURGIA"
