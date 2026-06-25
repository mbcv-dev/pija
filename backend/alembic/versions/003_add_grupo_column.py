"""add grupo column to fato_eventos_jornada

Revision ID: 003
Revises: 002
Create Date: 2026-06-25

Adiciona coluna `grupo` que classifica cada unidade funcional no seu
grupo assistencial (ex.: "Análises Clínicas", "Ambulatorial").
Permite filtrar e agrupar eventos por grupo sem expor nomenclatura interna.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003"
down_revision: Union[str, Sequence[str], None] = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("fato_eventos_jornada") as batch_op:
        batch_op.add_column(sa.Column("grupo", sa.String(length=64), nullable=True))
        batch_op.create_index("ix_fato_eventos_jornada_grupo", ["grupo"])


def downgrade() -> None:
    with op.batch_alter_table("fato_eventos_jornada") as batch_op:
        batch_op.drop_index("ix_fato_eventos_jornada_grupo")
        batch_op.drop_column("grupo")
