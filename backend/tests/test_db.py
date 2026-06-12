import pytest
from sqlalchemy import select

from pija.db import Base, make_engine, make_sessionmaker
from pija.models.fato import EtlLog, FatoEvento


@pytest.mark.asyncio
async def test_can_create_schema_and_insert(tmp_path):
    db_path = tmp_path / "test.db"
    engine = make_engine(f"sqlite+aiosqlite:///{db_path}")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    SessionLocal = make_sessionmaker(engine)
    async with SessionLocal() as session:
        evento = FatoEvento(
            evento_id="P-12345",
            paciente_id="12345",
            tipo_entidade="PRONTUARIO",
            entidade_id="12345",
            timestamp_principal="2025-01-01T00:00:00",
            dt_carga="2026-05-29T10:00:00",
        )
        session.add(evento)
        await session.commit()

        result = await session.execute(select(FatoEvento))
        eventos = result.scalars().all()
        assert len(eventos) == 1
        assert eventos[0].evento_id == "P-12345"

    await engine.dispose()


@pytest.mark.asyncio
async def test_etl_log_records(tmp_path):
    db_path = tmp_path / "log.db"
    engine = make_engine(f"sqlite+aiosqlite:///{db_path}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    SessionLocal = make_sessionmaker(engine)
    async with SessionLocal() as session:
        log = EtlLog(
            view_name="vw_pacientes",
            started_at="2026-05-29T10:00:00",
            finished_at="2026-05-29T10:05:00",
            rows_read=357346,
            rows_loaded=357340,
            rows_rejected=6,
            errors=None,
        )
        session.add(log)
        await session.commit()

    await engine.dispose()