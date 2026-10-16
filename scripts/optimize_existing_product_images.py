"""Move legacy base64 product images into optimized static files.

Run in the backend environment. Defaults to reporting only; pass --apply to update rows.
Back up the SQLite database before applying.
"""
import argparse
from sqlalchemy import text
from app.db.database import engine
from app.services.product_image_storage import store_product_image

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="write optimized file URLs to the database")
    args = parser.parse_args()
    with engine.begin() as connection:
        rows = connection.execute(text("SELECT id, s3_url FROM product_images WHERE s3_url LIKE 'data:image/%'")).all()
        if not args.apply:
            total_chars = sum(len(row.s3_url) for row in rows)
            print(f"embedded_images={len(rows)} embedded_url_chars={total_chars}; dry run only")
            return
        converted = 0
        for row in rows:
            new_url = store_product_image(row.s3_url)
            connection.execute(text("UPDATE product_images SET s3_url = :url WHERE id = :id"), {"url": new_url, "id": row.id})
            converted += 1
        remaining = connection.execute(text("SELECT COUNT(*) FROM product_images WHERE s3_url LIKE 'data:image/%'")).scalar_one()
        print(f"converted={converted} remaining_embedded={remaining}")

if __name__ == "__main__":
    main()
