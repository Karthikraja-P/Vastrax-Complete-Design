"""Make tryon_sessions.product_id nullable

Revision ID: f05afcccfbff
Revises: b364cd5c314c
Create Date: 2026-08-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f05afcccfbff'
down_revision: Union[str, Sequence[str], None] = 'b364cd5c314c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('tryon_sessions') as batch_op:
        batch_op.alter_column('product_id', existing_type=sa.String(length=36), nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('tryon_sessions') as batch_op:
        batch_op.alter_column('product_id', existing_type=sa.String(length=36), nullable=False)
