import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.db.database import SessionLocal
from app.models.category import Category
from app.models.product import Product
from app.models.product_image import ProductImage
import uuid

db = SessionLocal()

cats = [
    Category(id='cat-dresses', name='Dresses', slug='dresses'),
    Category(id='cat-pants', name='Pants', slug='pants'),
    Category(id='cat-tops', name='Tops', slug='tops')
]

for c in cats:
    existing = db.query(Category).filter(Category.id == c.id).first()
    if not existing:
        db.add(c)
db.commit()

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
    existing = db.query(Product).filter(Product.id == p[0]).first()
    if not existing:
        prod = Product(
            id=p[0], category_id=p[1], name=p[2], fabric=p[3], colour=p[4], 
            price_mrp=p[5], price_selling=p[6], occasion=p[7]
        )
        db.add(prod)
        db.commit()
        
        img = ProductImage(
            id=uuid.uuid4().hex, product_id=p[0], 
            s3_url="https://images.unsplash.com/photo-1515347619362-67fd13c6e4db?w=400&q=80", 
            display_order=0
        )
        db.add(img)
        db.commit()

print("Mock products seeded using ORM!")
