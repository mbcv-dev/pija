"""add (paciente_id, tipo_entidade, timestamp_realizacao) index for KPI-06

Revision ID: 004
Revises: 003
Create Date: 2026-06-26

A subconsulta correlacionada do KPI-06 filtra por paciente_id + tipo_entidade
+ timestamp_realizacao. Sem este índice o KPI-06 leva ~90s no DB real (2.26M
linhas); com ele, ~0,6s. O índice 002 (paciente_id, timestamp_principal) não
cobre esse predicado.
"""
from alembic import op

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_fato_kpi06",
        "fato_eventos_jornada",
        ["paciente_id", "tipo_entidade", "timestamp_realizacao"],
    )


def downgrade() -> None:
    op.drop_index("ix_fato_kpi06", "fato_eventos_jornada")
