from sqlalchemy import create_engine, text

from app.db.ensure_schema import ensure_columns


def test_legacy_supplier_expense_journal_links_are_backfilled():
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as conn:
        conn.execute(text("""CREATE TABLE erp_journal_entries (
            id VARCHAR(36) PRIMARY KEY,
            reference VARCHAR(100),
            description VARCHAR(255),
            source_key VARCHAR(120),
            created_at DATETIME
        )"""))
        conn.execute(text("""CREATE TABLE erp_operating_expenses (
            id VARCHAR(36) PRIMARY KEY,
            reference VARCHAR(100),
            description VARCHAR(255)
        )"""))
        conn.execute(text(
            "INSERT INTO erp_journal_entries (id, reference, description, source_key, created_at) "
            "VALUES ('JE-LEGACY', 'EXP-EXP-LEGACY', 'Expense: Legacy courier charge', NULL, '2026-10-01')"
        ))
        conn.execute(text(
            "INSERT INTO erp_operating_expenses (id, reference, description) "
            "VALUES ('EXP-LEGACY', NULL, 'Legacy courier charge')"
        ))

    ensure_columns(engine)

    with engine.connect() as conn:
        linked = conn.execute(text(
            "SELECT journal_entry_id FROM erp_operating_expenses WHERE id = 'EXP-LEGACY'"
        )).scalar_one()
        assert linked == "JE-LEGACY"
    engine.dispose()
