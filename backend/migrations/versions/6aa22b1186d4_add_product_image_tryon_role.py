"""Add optional try-on source role to product images.

Revision ID: 6aa22b1186d4
Revises: a1c2d3e4f501
Create Date: 2026-10-21 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "6aa22b1186d4"
down_revision: Union[str, Sequence[str], None] = "a1c2d3e4f501"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("product_images", sa.Column("tryon_role", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("product_images", "tryon_role")
