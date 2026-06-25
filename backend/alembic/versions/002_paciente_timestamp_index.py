"""add paciente_timestamp composite index for KPI-06

Revision ID: 002
Revises: 001
Create Date: 2026-06-17
"""
from alembic import op

revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_index(
        'ix_fato_paciente_timestamp',
        'fato_eventos_jornada',
        ['paciente_id', 'timestamp_principal'],
    )

def downgrade() -> None:
    op.drop_index('ix_fato_paciente_timestamp', 'fato_eventos_jornada')
