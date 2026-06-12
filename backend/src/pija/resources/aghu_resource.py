"""Stub do AghuResource para a Fase 5 (cutover via VPN HC).

A implementação real usará `python-oracledb` com pool de conexão. Por
ora, mantemos a mesma interface levantando NotImplementedError para
garantir que o DI funcione e os consumidores tratem o caso.
"""

from collections.abc import Iterator


class AghuResource:
    """Stub — implementação real na Fase 5."""

    def __init__(self, dsn: str) -> None:
        self.dsn = dsn

    def iter_rows(self, view: str, *, sample: int | None = None) -> Iterator[dict[str, str]]:
        raise NotImplementedError(
            "AghuResource será implementado na Fase 5 (cutover via VPN HC-UFPE). "
            "Use RESOURCE_MODE=csv enquanto isso."
        )

    def count(self, view: str) -> int:
        raise NotImplementedError("Disponível na Fase 5.")