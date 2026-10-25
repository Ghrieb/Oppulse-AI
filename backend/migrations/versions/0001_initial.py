"""Create the initial Oppulse schema.

The declarative metadata is the source of truth for this first migration.
Future schema changes must use explicit Alembic revisions.
"""

from __future__ import annotations

from alembic import op

from app.db import models  # noqa: F401
from app.db.session import Base

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
