"""ETL runner — orquestra leitura dos CSVs e inserção no SQLite local.

Uso:
    python -m pija.etl.runner [--sample N] [--view VIEW]

Sem --view, processa as 5 views em sequência.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
from collections.abc import Iterator
from datetime import datetime, timezone
from typing import Callable

from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from pija.db import make_engine, make_sessionmaker
from pija.etl.mappers.base import FatoRow
from pija.etl.mappers.cirurgia import map_cirurgia_row
from pija.etl.mappers.consulta import map_consulta_row
from pija.etl.mappers.exame import map_exame_row
from pija.etl.mappers.internacao import map_internacao_row
from pija.etl.mappers.prontuario import map_pacientes_row
from pija.models.fato import EtlLog, FatoEvento
from pija.resources.factory import get_resource
from pija.settings import Settings

logger = logging.getLogger("pija.etl")

# Para EXAME precisamos passar row_index — wrapper de fechamento
def _make_exame_mapper() -> Callable[[dict[str, str]], FatoRow | None]:
    counter = {"i": 0}

    def _wrap(row: dict[str, str]) -> FatoRow | None:
        counter["i"] += 1
        return map_exame_row(row, row_index=counter["i"])

    return _wrap


def _build_views() -> list[tuple[str, Callable[[dict[str, str]], FatoRow | None | list[FatoRow]]]]:
    """Constrói a lista de (view_name, mapper) por execução.

    Mappers com estado (ex.: contador do exame) precisam ser instanciados a cada
    run_etl para preservar idempotência — caso contrário o contador acumula entre
    execuções e gera evento_ids diferentes para a mesma linha do CSV.
    """
    return [
        ("vw_pacientes", map_pacientes_row),
        ("vw_consultas", map_consulta_row),
        ("vw_exames", _make_exame_mapper()),
        ("vw_internacoes", map_internacao_row),
        ("vw_cirurgias", map_cirurgia_row),
    ]


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


async def _upsert_batch(session: AsyncSession, batch: list[FatoRow], dt_carga: str) -> int:
    """Upsert por evento_id (ON CONFLICT DO UPDATE).

    Normaliza cada dict para conter exatamente as colunas da tabela — necessário
    porque o INSERT multi-row do SQLAlchemy/SQLite exige que todas as linhas
    declarem o mesmo conjunto de colunas. Mappers diferentes (ex.: INTERNACAO vs
    ALTA) podem omitir colunas opcionais, então preenchemos com None aqui.
    """
    if not batch:
        return 0
    columns = [c.name for c in FatoEvento.__table__.columns]
    normalized: list[dict[str, object]] = []
    for r in batch:
        r["dt_carga"] = dt_carga
        normalized.append({c: r.get(c) for c in columns})
    stmt = sqlite_insert(FatoEvento).values(normalized)
    update_cols = {c: stmt.excluded[c] for c in columns if c != "evento_id"}
    stmt = stmt.on_conflict_do_update(index_elements=["evento_id"], set_=update_cols)
    await session.execute(stmt)
    return len(batch)


async def run_view(
    session: AsyncSession,
    view: str,
    mapper: Callable,
    *,
    sample: int | None = None,
    batch_size: int = 1000,
) -> tuple[int, int, int, str | None]:
    """Roda ETL de uma view e retorna (rows_read, rows_loaded, rows_rejected, errors)."""
    resource = get_resource()
    dt_carga = _now_iso()

    rows_read = 0
    rows_loaded = 0
    rows_rejected = 0
    errors: list[str] = []

    batch: list[FatoRow] = []
    rows_iter: Iterator[dict[str, str]] = resource.iter_rows(view, sample=sample)
    try:
        for row in rows_iter:
            rows_read += 1
            try:
                result = mapper(row)
            except Exception as exc:  # noqa: BLE001 — soft-fail per row
                rows_rejected += 1
                if len(errors) < 10:
                    errors.append(f"row {rows_read}: {exc!r}")
                continue
            if result is None:
                rows_rejected += 1
                continue
            if isinstance(result, list):
                batch.extend(result)
            else:
                batch.append(result)
            if len(batch) >= batch_size:
                rows_loaded += await _upsert_batch(session, batch, dt_carga)
                await session.commit()
                batch = []
        if batch:
            rows_loaded += await _upsert_batch(session, batch, dt_carga)
            await session.commit()
    except Exception as exc:  # noqa: BLE001 — view-level error
        errors.append(f"view {view} aborted: {exc!r}")

    return rows_read, rows_loaded, rows_rejected, (json.dumps(errors) if errors else None)


async def run_etl(*, sample: int | None = None, only_view: str | None = None) -> None:
    settings = Settings()
    engine = make_engine(f"sqlite+aiosqlite:///{settings.sqlite_path}")
    SessionLocal = make_sessionmaker(engine)

    views = _build_views()
    for view_name, mapper in views:
        if only_view and view_name != only_view:
            continue
        logger.info("Iniciando ETL: %s", view_name)
        started_at = _now_iso()
        async with SessionLocal() as session:
            rows_read, rows_loaded, rows_rejected, errors = await run_view(
                session, view_name, mapper, sample=sample
            )
            finished_at = _now_iso()
            log = EtlLog(
                view_name=view_name,
                started_at=started_at,
                finished_at=finished_at,
                rows_read=rows_read,
                rows_loaded=rows_loaded,
                rows_rejected=rows_rejected,
                errors=errors,
            )
            session.add(log)
            await session.commit()
        logger.info(
            "view=%s read=%d loaded=%d rejected=%d errors=%s",
            view_name, rows_read, rows_loaded, rows_rejected, "yes" if errors else "no",
        )

    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="ETL CSV → SQLite (PIJA)")
    parser.add_argument("--sample", type=int, default=None, help="Limita leitura a N linhas por view (dev)")
    parser.add_argument("--view", type=str, default=None, help="Roda apenas a view especificada")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    asyncio.run(run_etl(sample=args.sample, only_view=args.view))


if __name__ == "__main__":
    main()