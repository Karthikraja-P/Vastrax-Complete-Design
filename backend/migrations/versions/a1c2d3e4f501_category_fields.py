"""category description, is_active, image_url

Revision ID: a1c2d3e4f501
Revises: 737db7f8326f
"""
import sqlalchemy as sa
from alembic import op

revision = "a1c2d3e4f501"
down_revision = "737db7f8326f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    have = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("categories")}
    with op.batch_alter_table("categories") as b:
        if "description" not in have:
            b.add_column(sa.Column("description", sa.Text(), nullable=True))
        if "is_active" not in have:
            b.add_column(sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"))
        if "image_url" not in have:
            b.add_column(sa.Column("image_url", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("categories") as b:
        for c in ("image_url", "is_active", "description"):
            b.drop_column(c)
