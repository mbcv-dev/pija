"""Stub do AghuResource para a Fase 5 (cutover contra o PostgreSQL do AGHU).

A implementação real usará `psycopg`/`asyncpg` com pool de conexão contra o
**PostgreSQL** do AGHU (schema `agh.*`), numa VM dentro da rede do HC-UFPE
(confirmado com o HC em 2026-07-24 — ver
docs/superpowers/plans/2026-07-24-aghu-integracao-referencia.md). Por ora,
mantemos a mesma interface levantando NotImplementedError para garantir que o
DI funcione e os consumidores tratem o caso.
"""

from collections.abc import Iterator


class AghuResource:
    """Stub — implementação real na Fase 5."""

    def __init__(self, dsn: str) -> None:
        self.dsn = dsn

    def iter_rows(self, view: str, *, sample: int | None = None) -> Iterator[dict[str, str]]:
        raise NotImplementedError(
            "AghuResource será implementado na Fase 5 (PostgreSQL do AGHU, VM na rede do HC-UFPE). "
            "Use RESOURCE_MODE=csv enquanto isso."
        )

    def count(self, view: str) -> int:
        raise NotImplementedError("Disponível na Fase 5.")