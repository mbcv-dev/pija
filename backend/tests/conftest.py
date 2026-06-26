import os

import pytest

# Garantir variáveis mínimas para Settings em testes
os.environ.setdefault("JWT_SECRET", "test-secret-not-for-production-min-32-chars")
os.environ.setdefault("SQLITE_PATH", ":memory:")
os.environ.setdefault("CSV_DIR", "./CSV-aghu")

from sqlalchemy.ext.asyncio import async_sessionmaker
from pija.db import Base, make_engine
from pija.models.fato import FatoEvento  # noqa: F401 — ensure tables registered


@pytest.fixture
def fixtures_dir() -> str:
    """Caminho para tests/fixtures."""
    return os.path.join(os.path.dirname(__file__), "fixtures")


@pytest.fixture
async def async_engine(tmp_path):
    """Engine SQLite in-memory para testes de integração."""
    db_path = tmp_path / "test_f2.db"
    engine = make_engine(f"sqlite+aiosqlite:///{db_path}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture
async def fixture_db_session(async_engine):
    """Session pré-populada com 17 eventos determinísticos para testes de KPI/endpoints.

    Contrato F2 alinhado ao frontend: a dimensão de agrupamento é `unidade`
    (preenchida abaixo; `grupo` também é mantido para não perder o dado do ETL).
    """
    factory = async_sessionmaker(async_engine, expire_on_commit=False)

    events = [
        # PRONTUARIOS (006 e 007 sem evento clínico → fora do KPI-01)
        FatoEvento(evento_id="P-001", paciente_id="001", tipo_entidade="PRONTUARIO", entidade_id="001", timestamp_principal="2024-01-01", dt_carga="2024-01-01"),
        FatoEvento(evento_id="P-002", paciente_id="002", tipo_entidade="PRONTUARIO", entidade_id="002", timestamp_principal="2024-01-01", dt_carga="2024-01-01"),
        FatoEvento(evento_id="P-003", paciente_id="003", tipo_entidade="PRONTUARIO", entidade_id="003", timestamp_principal="2024-01-01", dt_carga="2024-01-01"),
        FatoEvento(evento_id="P-004", paciente_id="004", tipo_entidade="PRONTUARIO", entidade_id="004", timestamp_principal="2024-01-01", dt_carga="2024-01-01"),
        FatoEvento(evento_id="P-005", paciente_id="005", tipo_entidade="PRONTUARIO", entidade_id="005", timestamp_principal="2024-01-01", dt_carga="2024-01-01"),
        FatoEvento(evento_id="P-006", paciente_id="006", tipo_entidade="PRONTUARIO", entidade_id="006", timestamp_principal="2024-01-01", dt_carga="2024-01-01"),
        FatoEvento(evento_id="P-007", paciente_id="007", tipo_entidade="PRONTUARIO", entidade_id="007", timestamp_principal="2024-01-01", dt_carga="2024-01-01"),
        # CONSULTAS
        FatoEvento(evento_id="C-001", paciente_id="001", tipo_entidade="CONSULTA", entidade_id="C001",
                   timestamp_principal="2024-01-10", timestamp_agendamento="2024-01-10",
                   timestamp_realizacao="2024-01-20", unidade="CARDIOLOGIA", grupo="CARDIOLOGIA", especialidade="CARDIOLOGIA",
                   situacao="PACIENTE ATENDIDO", dt_carga="2024-01-01"),
        FatoEvento(evento_id="C-002", paciente_id="002", tipo_entidade="CONSULTA", entidade_id="C002",
                   timestamp_principal="2024-01-15", timestamp_agendamento="2024-01-15",
                   timestamp_realizacao="2024-01-25", unidade="CARDIOLOGIA", grupo="CARDIOLOGIA", especialidade="CARDIOLOGIA",
                   situacao="PACIENTE ATENDIDO", dt_carga="2024-01-01"),
        FatoEvento(evento_id="C-003", paciente_id="003", tipo_entidade="CONSULTA", entidade_id="C003",
                   timestamp_principal="2024-01-21", timestamp_agendamento="2024-01-21",
                   timestamp_realizacao="2024-01-30", unidade="ORTOPEDIA", grupo="ORTOPEDIA", especialidade="ORTOPEDIA",
                   situacao="PACIENTE ATENDIDO", dt_carga="2024-01-01"),
        FatoEvento(evento_id="C-004", paciente_id="004", tipo_entidade="CONSULTA", entidade_id="C004",
                   timestamp_principal="2024-01-08", timestamp_agendamento="2024-01-08",
                   timestamp_realizacao="2024-01-15", unidade="ORTOPEDIA", grupo="ORTOPEDIA", especialidade="ORTOPEDIA",
                   situacao="PACIENTE ATENDIDO", dt_carga="2024-01-01"),
        FatoEvento(evento_id="C-005", paciente_id="005", tipo_entidade="CONSULTA", entidade_id="C005",
                   timestamp_principal="2024-01-11", timestamp_agendamento="2024-01-11",
                   timestamp_realizacao="2024-01-21", unidade="CARDIOLOGIA", grupo="CARDIOLOGIA", especialidade="CARDIOLOGIA",
                   situacao="PACIENTE ATENDIDO", dt_carga="2024-01-01"),
        # INTERNACOES
        FatoEvento(evento_id="I-001", paciente_id="001", tipo_entidade="INTERNACAO", entidade_id="I001",
                   timestamp_principal="2024-02-05", timestamp_alta_administrativa="2024-02-10",
                   unidade="CARDIOLOGIA", grupo="CARDIOLOGIA", especialidade="CARDIOLOGIA", dt_carga="2024-01-01"),
        FatoEvento(evento_id="I-002", paciente_id="002", tipo_entidade="INTERNACAO", entidade_id="I002",
                   timestamp_principal="2024-02-05", timestamp_alta_administrativa="2024-02-08",
                   unidade="CARDIOLOGIA", grupo="CARDIOLOGIA", especialidade="CARDIOLOGIA", dt_carga="2024-01-01"),
        FatoEvento(evento_id="I-003", paciente_id="003", tipo_entidade="INTERNACAO", entidade_id="I003",
                   timestamp_principal="2024-02-05", timestamp_alta_administrativa="2024-02-12",
                   unidade="ORTOPEDIA", grupo="ORTOPEDIA", especialidade="ORTOPEDIA", dt_carga="2024-01-01"),
        # EXAMES (KPI-05)
        FatoEvento(evento_id="E-001", paciente_id="001", tipo_entidade="EXAME", entidade_id="E001",
                   timestamp_principal="2024-03-01", timestamp_solicitacao="2024-03-01",
                   timestamp_realizacao="2024-03-05", unidade="CARDIOLOGIA", grupo="CARDIOLOGIA", especialidade="CARDIOLOGIA",
                   dt_carga="2024-01-01"),
        FatoEvento(evento_id="E-002", paciente_id="003", tipo_entidade="EXAME", entidade_id="E002",
                   timestamp_principal="2024-03-01", timestamp_solicitacao="2024-03-01",
                   timestamp_realizacao="2024-03-08", unidade="ORTOPEDIA", grupo="ORTOPEDIA", especialidade="ORTOPEDIA",
                   dt_carga="2024-01-01"),
    ]

    async with factory() as session:
        session.add_all(events)
        await session.commit()

    async with factory() as session:
        yield session