"""Idempotent additive column sync (create_all never alters existing tables)."""
import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

log = logging.getLogger(__name__)

# table -> {column: DDL type + default}
ADDITIVE_COLUMNS = {
    "categories": {
        "description": "TEXT",
        "is_active": "BOOLEAN NOT NULL DEFAULT 1",
        "image_url": "TEXT",
    },
    "crm_leads": {
        "converted_customer_id": "VARCHAR(36) REFERENCES users(id)",
    },
    "erp_journal_entries": {
        "source_key": "VARCHAR(120)",
    },
}


def ensure_columns(engine: Engine) -> None:
    insp = inspect(engine)
    for table, cols in ADDITIVE_COLUMNS.items():
        if not insp.has_table(table):
            continue
        existing = {c["name"] for c in insp.get_columns(table)}
        for name, ddl in cols.items():
            if name not in existing:
                with engine.begin() as conn:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
                log.info("Added column %s.%s", table, name)
    if insp.has_table("erp_journal_entries"):
        with engine.begin() as conn:
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_erp_journal_source_key ON erp_journal_entries(source_key)"))
