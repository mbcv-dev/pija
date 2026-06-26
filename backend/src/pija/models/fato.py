from sqlalchemy import Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from pija.db import Base


class FatoEvento(Base):
    """Tabela fato: 1 linha por evento de jornada assistencial.

    Conforme 04-modelo-dados.md §3 e DADOS-ESTADO.md §4.
    Todos os timestamps são armazenados como string ISO 8601
    (formato SQLite TEXT) para portabilidade.
    """

    __tablename__ = "fato_eventos_jornada"

    evento_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    paciente_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    tipo_entidade: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    entidade_id: Mapped[str] = mapped_column(String(64), nullable=False)
    timestamp_principal: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    timestamp_solicitacao: Mapped[str | None] = mapped_column(String(32), nullable=True)
    timestamp_agendamento: Mapped[str | None] = mapped_column(String(32), nullable=True)
    timestamp_realizacao: Mapped[str | None] = mapped_column(String(32), nullable=True)
    timestamp_liberacao: Mapped[str | None] = mapped_column(String(32), nullable=True)
    timestamp_alta_medica: Mapped[str | None] = mapped_column(String(32), nullable=True)
    timestamp_alta_administrativa: Mapped[str | None] = mapped_column(String(32), nullable=True)
    unidade: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    grupo: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    especialidade: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    tipo_evento: Mapped[str | None] = mapped_column(String(128), nullable=True)
    situacao: Mapped[str | None] = mapped_column(String(64), nullable=True)
    dt_carga: Mapped[str] = mapped_column(String(32), nullable=False)
    deleted_at: Mapped[str | None] = mapped_column(String(32), nullable=True)


# Índices compostos comuns para queries analíticas
Index(
    "ix_fato_filtros",
    FatoEvento.tipo_entidade,
    FatoEvento.unidade,
    FatoEvento.especialidade,
    FatoEvento.timestamp_principal,
)

# Índice para a subconsulta correlacionada do KPI-06 (última consulta
# realizada antes da internação). Sem ele, a query leva ~90s no DB real;
# com ele, ~0,6s. Cobre o predicado (paciente_id, tipo_entidade, realizacao).
Index(
    "ix_fato_kpi06",
    FatoEvento.paciente_id,
    FatoEvento.tipo_entidade,
    FatoEvento.timestamp_realizacao,
)


class EtlLog(Base):
    """Log estruturado de cada execução do ETL por view."""

    __tablename__ = "etl_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    view_name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    started_at: Mapped[str] = mapped_column(String(32), nullable=False)
    finished_at: Mapped[str | None] = mapped_column(String(32), nullable=True)
    rows_read: Mapped[int] = mapped_column(Integer, default=0)
    rows_loaded: Mapped[int] = mapped_column(Integer, default=0)
    rows_rejected: Mapped[int] = mapped_column(Integer, default=0)
    errors: Mapped[str | None] = mapped_column(Text, nullable=True)