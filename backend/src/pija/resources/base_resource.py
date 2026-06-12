"""Contrato de origem de dados — usado por providers e ETL.

A escolha entre `CsvResource` (MVP) e `AghuResource` (Fase 5) é feita pelo
factory baseado em `RESOURCE_MODE`. Consumidores trabalham apenas com o
protocolo abaixo.
"""

from collections.abc import Iterator
from typing import Protocol


class BaseResource(Protocol):
    """Protocolo da camada Resource.

    `iter_rows(view, sample=None)` deve ser um iterador (preguiçoso/streaming)
    de dicts onde cada dict representa 1 linha bruta da view de origem,
    com chaves no formato exato do header do CSV / view AGHU.
    """

    def iter_rows(self, view: str, *, sample: int | None = None) -> Iterator[dict[str, str]]:
        """Itera linhas brutas de uma view, em chunks internamente."""
        ...

    def count(self, view: str) -> int:
        """Total estimado de linhas da view (excluindo header)."""
        ...