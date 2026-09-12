"""add device auths

Revision ID: a1c7e4b93f20
Revises: 0e06d91a20c2
Create Date: 2026-09-12 09:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1c7e4b93f20'
down_revision: Union[str, Sequence[str], None] = '0e06d91a20c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'device_auths',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_code', sa.Text(), nullable=False),
        sa.Column('device_code_hash', sa.Text(), nullable=False),
        sa.Column('client_name', sa.Text(), nullable=False),
        sa.Column('approved_user_id', sa.Integer(), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('denied_at', sa.DateTime(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['approved_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_code', name='uq_device_auths_user_code'),
        sa.UniqueConstraint('device_code_hash', name='uq_device_auths_device_code_hash'),
    )
    op.create_index(op.f('ix_device_auths_user_code'), 'device_auths', ['user_code'], unique=False)
    op.create_index(
        op.f('ix_device_auths_device_code_hash'), 'device_auths', ['device_code_hash'], unique=False
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_device_auths_device_code_hash'), table_name='device_auths')
    op.drop_index(op.f('ix_device_auths_user_code'), table_name='device_auths')
    op.drop_table('device_auths')
