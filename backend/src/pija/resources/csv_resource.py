"""Implementação CsvResource para leitura streaming dos CSVs do HC.

Lê em chunks via pandas para evitar carregar arquivos grandes
(até ~290 MB) inteiramente em memória.

Cada CSV deve estar em `csv_dir/<view>.csv` (com sufixo
`_anonimizado` ou outro nome conforme entregue pelo HC). O constructor
aceita um mapa opcional de view → nome do arquivo.
"""

from collections.abc import Iterator
from pathlib import Path

import pandas as pd

# Mapeamento padrão view → nome do arquivo entregue pelo HC.
DEFAULT_FILE_MAP: dict[str, str] = {
    "vw_pacientes": "vw_pacientes_anonimizado.csv",
    "vw_consultas": "vw_consultas_anonimizado.csv",
    "vw_exames": "vw_exames_anonimizado.csv",
    "vw_internacoes": "vw_internacoes_anonimizado.csv",
    "vw_cirurgias": "vw_cirurgias_anonimizado.csv",
}


class CsvResource:
    """Lê CSVs do HC em streaming."""

    def __init__(
        self,
        csv_dir: str,
        chunksize: int = 50_000,
        file_map: dict[str, str] | None = None,
    ) -> None:
        self.csv_dir = Path(csv_dir)
        self.chunksize = chunksize
        self.file_map = file_map or {}

    def _resolve_path(self, view: str) -> Path:
        """Resolve o caminho do CSV correspondente à view."""
        candidates = [
            self.file_map.get(view),
            DEFAULT_FILE_MAP.get(view),
            f"{view}.csv",
        ]
        for cand in candidates:
            if not cand:
                continue
            p = self.csv_dir / cand
            if p.exists():
                return p
        raise FileNotFoundError(
            f"CSV não encontrado para view='{view}'. "
            f"Tentativas: {[c for c in candidates if c]} em {self.csv_dir}"
        )

    def iter_rows(
        self, view: str, *, sample: int | None = None
    ) -> Iterator[dict[str, str]]:
        path = self._resolve_path(view)
        produced = 0
        # dtype=str => preserva todos os campos como string; conversão fica para os mappers
        with pd.read_csv(
            path,
            chunksize=self.chunksize,
            dtype=str,
            keep_default_na=False,  # célula vazia vira "" não NaN
            encoding="utf-8",
        ) as reader:
            for chunk in reader:
                for row in chunk.to_dict(orient="records"):
                    yield row
                    produced += 1
                    if sample is not None and produced >= sample:
                        return

    def count(self, view: str) -> int:
        """Conta linhas (exclui header). Lê em chunks para não estourar memória."""
        path = self._resolve_path(view)
        total = 0
        with pd.read_csv(
            path,
            chunksize=self.chunksize,
            dtype=str,
            keep_default_na=False,
            encoding="utf-8",
            usecols=[0],  # só primeira coluna basta para contar
        ) as reader:
            for chunk in reader:
                total += len(chunk)
        return total