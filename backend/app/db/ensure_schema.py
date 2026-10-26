"""Idempotent additive column sync (create_all never alters existing tables)."""
import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

log = logging.getLogger(__name__)

# table -> {column: DDL type + default}
ADDITIVE_COLUMNS = {
    "product_images": {
        "tryon_role": "VARCHAR(20)",
    },
    "products": {
        "hem_length": "VARCHAR(20)",
    },
    "categories": {
        "description": "TEXT",
        "is_active": "BOOLEAN NOT NULL DEFAULT 1",
        "image_url": "TEXT",
    },
    "crm_leads": {
        "converted_customer_id": "VARCHAR(36) REFERENCES users(id)",
    },
    "crm_activities": {
        "assigned_to": "VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL",
    },
    "support_tickets": {
        "assigned_to": "VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL",
    },
    "erp_journal_entries": {
        "source_key": "VARCHAR(120)",
    },
    "erp_operating_expenses": {
        "journal_entry_id": "VARCHAR(36) REFERENCES erp_journal_entries(id)",
    },
    "orders": {
        "payment_method": "VARCHAR(50)",
    },
    "erp_inventory_costing_config": {
        "cogs_active_from": "DATETIME",
    },
}

# Existing catalog photos showing the complete two-piece outfit were uploaded as
# generic gallery images. Promote those known full-look references so storefront
# try-on uses FASHN's single adaptive pass instead of a top-then-bottom overwrite.
FULL_LOOK_ROLE_BACKFILLS = {
    "/user_uploads/products/fa1feea757faa71e0d27b3f0dd16b6dcabe198b201ff4ee475d5fd0346bacad0.webp",
    "/user_uploads/products/9ddc1d1cdb43267450bbbec003dceb0c4fc468de9221731eb1730ae4af6fbc87.webp",
}


def ensure_columns(engine: Engine) -> None:
    insp = inspect(engine)
    added_expense_journal_link = False
    for table, cols in ADDITIVE_COLUMNS.items():
        if not insp.has_table(table):
            continue
        existing = {c["name"] for c in insp.get_columns(table)}
        for name, ddl in cols.items():
            if name not in existing:
                with engine.begin() as conn:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
                log.info("Added column %s.%s", table, name)
                if table == "erp_operating_expenses" and name == "journal_entry_id":
                    added_expense_journal_link = True
    if insp.has_table("product_images"):
        with engine.begin() as conn:
            for image_path in FULL_LOOK_ROLE_BACKFILLS:
                result = conn.execute(
                    text("""
                        UPDATE product_images
                        SET tryon_role = 'set'
                        WHERE s3_url = :image_path
                          AND (tryon_role IS NULL OR tryon_role = 'gallery')
                    """),
                    {"image_path": image_path},
                )
                if result.rowcount:
                    log.info("Promoted complete outfit image to Full Look reference: %s", image_path)
    if insp.has_table("erp_journal_entries"):
        with engine.begin() as conn:
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_erp_journal_source_key ON erp_journal_entries(source_key)"))
    if added_expense_journal_link:
        with engine.begin() as conn:
            conn.execute(text("""
                UPDATE erp_operating_expenses
                SET journal_entry_id = (
                    SELECT entry.id
                    FROM erp_journal_entries AS entry
                    WHERE entry.reference = COALESCE(erp_operating_expenses.reference, 'EXP-' || erp_operating_expenses.id)
                      AND entry.description = 'Expense: ' || erp_operating_expenses.description
                    ORDER BY entry.created_at DESC
                    LIMIT 1
                )
                WHERE journal_entry_id IS NULL
            """))
