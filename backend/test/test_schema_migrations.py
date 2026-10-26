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


def test_legacy_crm_activities_get_nullable_assignee_column():
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as conn:
        conn.execute(text("""CREATE TABLE crm_activities (
            id VARCHAR(36) PRIMARY KEY,
            customer_id VARCHAR(36),
            lead_id VARCHAR(36),
            activity_type VARCHAR(30),
            subject VARCHAR(255),
            created_by VARCHAR(36),
            created_at DATETIME
        )"""))
        conn.execute(text("INSERT INTO crm_activities (id, activity_type, subject) VALUES ('OLD', 'task', 'Existing follow-up')"))

    ensure_columns(engine)

    with engine.connect() as conn:
        columns = {row["name"] for row in conn.execute(text("PRAGMA table_info(crm_activities)")).mappings()}
        assert "assigned_to" in columns
        assert conn.execute(text("SELECT assigned_to FROM crm_activities WHERE id = 'OLD'")).scalar_one() is None
    engine.dispose()


def test_legacy_support_tickets_get_nullable_assignee_column():
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as conn:
        conn.execute(text("""CREATE TABLE support_tickets (
            id VARCHAR(36) PRIMARY KEY,
            user_id VARCHAR(36),
            subject VARCHAR(255),
            description TEXT,
            status VARCHAR(20),
            priority VARCHAR(20),
            created_at DATETIME,
            updated_at DATETIME
        )"""))
        conn.execute(text("INSERT INTO support_tickets (id, subject, description) VALUES ('OLD-TICKET', 'Existing ticket', 'Keep this row')"))

    ensure_columns(engine)

    with engine.connect() as conn:
        columns = {row["name"] for row in conn.execute(text("PRAGMA table_info(support_tickets)")).mappings()}
        assert "assigned_to" in columns
        assert conn.execute(text("SELECT assigned_to FROM support_tickets WHERE id = 'OLD-TICKET'")).scalar_one() is None
    engine.dispose()


def test_existing_two_piece_full_look_gallery_images_are_promoted_idempotently():
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as conn:
        conn.execute(text("""CREATE TABLE product_images (
            id VARCHAR(36) PRIMARY KEY,
            s3_url VARCHAR(1000) NOT NULL,
            tryon_role VARCHAR(20)
        )"""))
        conn.execute(text("""
            INSERT INTO product_images (id, s3_url, tryon_role) VALUES
            ('BEIGE-SET', '/user_uploads/products/fa1feea757faa71e0d27b3f0dd16b6dcabe198b201ff4ee475d5fd0346bacad0.webp', 'gallery'),
            ('PINK-SET', '/user_uploads/products/9ddc1d1cdb43267450bbbec003dceb0c4fc468de9221731eb1730ae4af6fbc87.webp', 'gallery'),
            ('BEIGE-TOP', '/user_uploads/products/9b483d39eebe78579e0cf5c6984a1a49a075cf88af62ec0349f4d3559571a546.webp', 'top')
        """))

    ensure_columns(engine)
    ensure_columns(engine)

    with engine.connect() as conn:
        roles = dict(conn.execute(text("SELECT id, tryon_role FROM product_images")).all())
        assert roles == {"BEIGE-SET": "set", "PINK-SET": "set", "BEIGE-TOP": "top"}
    engine.dispose()
