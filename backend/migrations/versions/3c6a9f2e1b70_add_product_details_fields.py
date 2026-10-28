"""Add product details and styling advice fields.

Revision ID: 3c6a9f2e1b70
Revises: 9b7d2f6c1a40
Create Date: 2026-10-28 00:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "3c6a9f2e1b70"
down_revision: Union[str, Sequence[str], None] = "9b7d2f6c1a40"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("products", sa.Column("product_details", sa.Text(), nullable=True))
    op.add_column("products", sa.Column("how_to_style", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("products", "how_to_style")
    op.drop_column("products", "product_details")
