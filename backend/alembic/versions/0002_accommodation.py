"""add accommodation fields to trips

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-18
"""
from alembic import op
import sqlalchemy as sa


revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("trips", sa.Column("accommodation", sa.Text(), nullable=True))
    op.add_column("trips", sa.Column("accommodation_lat", sa.Float(), nullable=True))
    op.add_column("trips", sa.Column("accommodation_lon", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("trips", "accommodation_lon")
    op.drop_column("trips", "accommodation_lat")
    op.drop_column("trips", "accommodation")
