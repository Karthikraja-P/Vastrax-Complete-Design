"""Add per-product storefront display background color.

Revision ID: 9b7d2f6c1a40
Revises: 82f4c7139a2b
Create Date: 2026-10-28 00:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "9b7d2f6c1a40"
down_revision: Union[str, Sequence[str], None] = "82f4c7139a2b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("products", sa.Column("display_background", sa.String(length=7), nullable=True))


def downgrade() -> None:
    op.drop_column("products", "display_background")
