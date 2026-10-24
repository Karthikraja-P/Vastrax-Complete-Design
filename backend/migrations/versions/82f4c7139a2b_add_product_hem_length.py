"""Add optional product hem-length guidance.

Revision ID: 82f4c7139a2b
Revises: 6aa22b1186d4
Create Date: 2026-10-24 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "82f4c7139a2b"
down_revision: Union[str, Sequence[str], None] = "6aa22b1186d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("products", sa.Column("hem_length", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("products", "hem_length")
