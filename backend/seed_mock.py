import sqlite3
import uuid

conn = sqlite3.connect('backend/vastrax.db')

# Ensure categories exist
conn.execute("INSERT OR IGNORE INTO categories (id, name, slug) VALUES ('cat-dresses', 'Dresses', 'dresses');")
conn.execute("INSERT OR IGNORE INTO categories (id, name, slug) VALUES ('cat-pants', 'Pants', 'pants');")
conn.execute("INSERT OR IGNORE INTO categories (id, name, slug) VALUES ('cat-tops', 'Tops', 'tops');")

products = [
    ('vtx-frock-floral', 'cat-dresses', 'Aditi Floral A-Line Frock', 'Pure Chiffon Crepe', 'French Blue Floral', 2499, 2499, 'Wedding / Festive'),
    ('vtx-frock-textured', 'cat-dresses', 'Puff-Sleeve Textured Midi Frock', 'Embossed Jacquard Cotton', 'Powder Blue', 2999, 2999, 'Wedding / Festive'),
    ('vtx-pants-beige', 'cat-pants', 'Linen Striped Wide-Leg Trousers', 'Premium Linen', 'Oatmeal Beige', 1999, 1999, 'Casual / Everyday'),
    ('vtx-pants-flared', 'cat-pants', 'High-Waisted Flared Tailored Trousers', 'Tailored Suiting Wool Blend', 'Midnight Navy', 2299, 2299, 'Office / Work'),
    ('vtx-top-vneck', 'cat-tops', 'Navy V-Neck Knit Collared Top', 'Ribbed Viscose Knit', 'Deep Navy', 1499, 1499, 'Office / Work'),
    ('vtx-top-checked', 'cat-tops', 'Caramel Checked Collared Top', 'Cotton Blend', 'Caramel & Cream Check', 1699, 1699, 'Office / Work'),
    ('vtx-top-wrap', 'cat-tops', 'Sky Blue Striped Wrap Style Top', 'Cotton Poplin', 'Sky Blue Stripe', 1799, 1799, 'Casual / Everyday'),
    ('vtx-top-tieup', 'cat-tops', 'Olive Green Tie-Up Halter Top', 'Satin Silk Blend', 'Olive Green', 1599, 1599, 'Casual / Everyday'),
    ('vtx-top-slimfit', 'cat-tops', 'Blush Pink Slim-Fit Ribbed Top', 'Cotton Elastane', 'Blush Pink', 1299, 1299, 'Casual / Everyday')
]

for p in products:
    try:
        conn.execute("""
            INSERT OR IGNORE INTO products (id, category_id, name, fabric, colour, price_mrp, price_selling, occasion, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        """, p)
        # Add a dummy image for each
        img_id = uuid.uuid4().hex
        conn.execute("INSERT OR IGNORE INTO product_images (id, product_id, s3_url, display_order) VALUES (?, ?, ?, 0)", 
                    (img_id, p[0], "https://images.unsplash.com/photo-1515347619362-67fd13c6e4db?w=400&q=80"))
    except Exception as e:
        print(f"Error on {p[0]}: {e}")

conn.commit()
print("Mock products seeded!")
