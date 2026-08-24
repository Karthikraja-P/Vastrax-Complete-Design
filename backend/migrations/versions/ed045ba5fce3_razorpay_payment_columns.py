"""Replace phonepe_txn_id with Razorpay payment columns

Revision ID: ed045ba5fce3
Revises: f05afcccfbff
Create Date: 2026-08-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ed045ba5fce3'
down_revision: Union[str, Sequence[str], None] = 'f05afcccfbff'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('payments') as batch_op:
        batch_op.drop_column('phonepe_txn_id')
        batch_op.add_column(sa.Column('razorpay_order_id', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('razorpay_payment_id', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('razorpay_signature', sa.String(length=255), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('payments') as batch_op:
        batch_op.drop_column('razorpay_signature')
        batch_op.drop_column('razorpay_payment_id')
        batch_op.drop_column('razorpay_order_id')
        batch_op.add_column(sa.Column('phonepe_txn_id', sa.String(length=100), nullable=True))
