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

product_images_map = {
    'vtx-frock-floral': 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?q=80&w=800&auto=format&fit=crop',
    'vtx-frock-textured': 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?q=80&w=800&auto=format&fit=crop',
    'vtx-pants-beige': 'https://images.unsplash.com/photo-1542272604-787c3835535d?q=80&w=800&auto=format&fit=crop',
    'vtx-pants-flared': 'https://images.unsplash.com/photo-1509551388413-e18d0ac5d495?q=80&w=800&auto=format&fit=crop',
    'vtx-top-vneck': 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?q=80&w=800&auto=format&fit=crop',
    'vtx-top-checked': 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?q=80&w=800&auto=format&fit=crop',
    'vtx-top-wrap': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=800&auto=format&fit=crop',
    'vtx-top-tieup': 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=800&auto=format&fit=crop',
    'vtx-top-slimfit': 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?q=80&w=800&auto=format&fit=crop',
}

for p in products:
    existing = db.query(Product).filter(Product.id == p[0]).first()
    if not existing:
        prod = Product(
            id=p[0], category_id=p[1], name=p[2], fabric=p[3], colour=p[4], 
            price_mrp=p[5], price_selling=p[6], occasion=p[7]
        )
        db.add(prod)
        db.commit()
        
    img_url = product_images_map.get(p[0], "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?q=80&w=800&auto=format&fit=crop")
    existing_img = db.query(ProductImage).filter(ProductImage.product_id == p[0]).first()
    if existing_img:
        existing_img.s3_url = img_url
    else:
        img = ProductImage(
            id=uuid.uuid4().hex, product_id=p[0], 
            s3_url=img_url, 
            display_order=0
        )
        db.add(img)
    db.commit()

print("Mock products seeded using ORM!")
