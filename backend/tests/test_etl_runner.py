import shutil
from pathlib import Path

import pytest
from sqlalchemy import func, select

from pija.db import Base, make_engine, make_sessionmaker
from pija.etl.runner import run_etl
from pija.models.fato import EtlLog, FatoEvento


@pytest.fixture
def test_csv_dir(tmp_path: Path, fixtures_dir: str) -> Path:
    """Copia os 5 sample CSVs para um diretório temporário com nomes esperados."""
    src = Path(fixtures_dir)
    dst = tmp_path / "csv"
    dst.mkdir()
    mapping = {
        "vw_pacientes_sample.csv": "vw_pacientes_anonimizado.csv",
        "vw_consultas_sample.csv": "vw_consultas_anonimizado.csv",
        "vw_exames_sample.csv": "vw_exames_anonimizado.csv",
        "vw_internacoes_sample.csv": "vw_internacoes_anonimizado.csv",
        "vw_cirurgias_sample.csv": "vw_cirurgias_anonimizado.csv",
    }
    for sample_name, target_name in mapping.items():
        shutil.copy(src / sample_name, dst / target_name)
    return dst


@pytest.fixture
async def db_engine(tmp_path: Path):
    db_path = tmp_path / "pija_test.db"
    engine = make_engine(f"sqlite+aiosqlite:///{db_path}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine, db_path
    await engine.dispose()


@pytest.mark.asyncio
async def test_etl_loads_all_views(monkeypatch, test_csv_dir: Path, db_engine):
    engine, db_path = db_engine
    monkeypatch.setenv("CSV_DIR", str(test_csv_dir))
    monkeypatch.setenv("SQLITE_PATH", str(db_path))
    monkeypatch.setenv("RESOURCE_MODE", "csv")
    monkeypatch.setenv("JWT_SECRET", "test-secret-not-for-production-min-32-chars")

    await run_etl(sample=None)

    SessionLocal = make_sessionmaker(engine)
    async with SessionLocal() as session:
        # 5 logs de ETL (um por view)
        logs = (await session.execute(select(EtlLog))).scalars().all()
        assert len(logs) == 5
        assert {l.view_name for l in logs} == {
            "vw_pacientes", "vw_consultas", "vw_exames",
            "vw_internacoes", "vw_cirurgias",
        }

        # Eventos por tipo_entidade
        by_tipo = dict(
            (await session.execute(
                select(FatoEvento.tipo_entidade, func.count())
                .group_by(FatoEvento.tipo_entidade)
            )).all()
        )
        # Fixture: 3 pacientes; 2 linhas válidas em consultas (1 tipo=PROCEDIMENTO,
        # 1 tipo=CONSULTA, 3a rejeitada); 3 exames; 2 internações (1a + ALTA);
        # 2 cirurgias válidas (ambas CIRURGIA — split PDT/CIRURGIA agora é só tipo_evento)
        assert by_tipo.get("PRONTUARIO") == 3
        assert by_tipo.get("CONSULTA") == 1       # fixture row 1 com tipo=CONSULTA
        assert by_tipo.get("PROCEDIMENTO") == 1   # fixture row 0 com tipo=PROCEDIMENTO
        assert by_tipo.get("EXAME") == 3
        assert by_tipo.get("INTERNACAO") == 2
        assert by_tipo.get("ALTA") == 1           # só a 1a internação tem alta
        assert by_tipo.get("CIRURGIA") == 2       # ambas linhas válidas (PDT vira CIRURGIA também)


@pytest.mark.asyncio
async def test_etl_is_idempotent(monkeypatch, test_csv_dir: Path, db_engine):
    """Rodar duas vezes não deve duplicar registros."""
    engine, db_path = db_engine
    monkeypatch.setenv("CSV_DIR", str(test_csv_dir))
    monkeypatch.setenv("SQLITE_PATH", str(db_path))
    monkeypatch.setenv("RESOURCE_MODE", "csv")
    monkeypatch.setenv("JWT_SECRET", "test-secret-not-for-production-min-32-chars")

    await run_etl()
    SessionLocal = make_sessionmaker(engine)
    async with SessionLocal() as session:
        first_count = (await session.execute(select(func.count(FatoEvento.evento_id)))).scalar()

    await run_etl()  # segunda execução
    async with SessionLocal() as session:
        second_count = (await session.execute(select(func.count(FatoEvento.evento_id)))).scalar()

    assert first_count == second_count, "ETL não é idempotente"

    # E o etl_log agora tem 10 registros (5 + 5)
    async with SessionLocal() as session:
        n_logs = (await session.execute(select(func.count(EtlLog.id)))).scalar()
        assert n_logs == 10


@pytest.mark.asyncio
async def test_etl_records_rejected_rows(monkeypatch, test_csv_dir: Path, db_engine):
    """Linhas inválidas (ex: sem prontuario) devem aparecer em etl_log.rows_rejected."""
    engine, db_path = db_engine
    monkeypatch.setenv("CSV_DIR", str(test_csv_dir))
    monkeypatch.setenv("SQLITE_PATH", str(db_path))
    monkeypatch.setenv("RESOURCE_MODE", "csv")
    monkeypatch.setenv("JWT_SECRET", "test-secret-not-for-production-min-32-chars")

    await run_etl()

    SessionLocal = make_sessionmaker(engine)
    async with SessionLocal() as session:
        log_consultas = (
            await session.execute(select(EtlLog).where(EtlLog.view_name == "vw_consultas"))
        ).scalars().first()
        # Fixture consultas: 3 linhas, 1 rejeitada (sem Prontuario)
        assert log_consultas.rows_read == 3
        assert log_consultas.rows_loaded == 2
        assert log_consultas.rows_rejected == 1

        log_cirurgias = (
            await session.execute(select(EtlLog).where(EtlLog.view_name == "vw_cirurgias"))
        ).scalars().first()
        # Fixture cirurgias: 3 linhas, 1 rejeitada (sem Prontuário)
        assert log_cirurgias.rows_read == 3
        assert log_cirurgias.rows_loaded == 2
        assert log_cirurgias.rows_rejected == 1