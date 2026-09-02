import asyncio
import os
import sys

from sqlalchemy.orm import Session

# Add the backend dir to path so we can import app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.database import SessionLocal
from app.models.category import Category
from app.models.product import Product
from app.models.product_image import ProductImage
from app.models.product_variant import ProductVariant
from app.models.user import User


def seed_database():
    db = SessionLocal()
    try:
        # Seed dummy users
        from app.core.security import hash_password
        admin_email = "admin@vastrax.com"
        customer_email = "customer@vastrax.com"

        admin_user = db.query(User).filter(User.email == admin_email).first()
        if not admin_user:
            db.add(User(email=admin_email, phone_number="+919962288111", full_name="Admin User", hashed_password=hash_password("admin123"), role="admin", is_active=True))
        else:
            admin_user.hashed_password = hash_password("admin123")
            admin_user.phone_number = "+919962288111"
        
        customer_user = db.query(User).filter(User.email == customer_email).first()
        if not customer_user:
            db.add(User(email=customer_email, phone_number="+919962288110", full_name="Demo Customer", hashed_password=hash_password("customer123"), role="customer", is_active=True))
        else:
            customer_user.hashed_password = hash_password("customer123")
            customer_user.phone_number = "+919962288110"
        
        db.commit()


        # Seed Categories
        categories_data = [
            {"slug": "t-shirts", "name": "T-Shirts"},
            {"slug": "hoodies", "name": "Hoodies & Sweatshirts"},
            {"slug": "jackets", "name": "Jackets & Outerwear"},
            {"slug": "pants", "name": "Pants & Trousers"},
            {"slug": "shirts", "name": "Shirts"},
            {"slug": "shoes", "name": "Shoes & Sneakers"},
            {"slug": "hats", "name": "Hats"},
        ]

        category_map = {}
        for c in categories_data:
            cat = db.query(Category).filter(Category.slug == c["slug"]).first()
            if not cat:
                cat = Category(slug=c["slug"], name=c["name"])
                db.add(cat)
                db.commit()
                db.refresh(cat)
            category_map[c["slug"]] = cat


        # Seed Mock Products
        products_data = [
            {
                "name": "CREAM PULLOVER HOODIE",
                "slug": "hoodies",
                "price": 65.00,
                "image": "https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=800&auto=format&fit=crop"
            },
            {
                "name": "OLIVE PUFFER JACKET",
                "slug": "jackets",
                "price": 120.00,
                "image": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=800&auto=format&fit=crop"
            },
            {
                "name": "CARGO PANTS",
                "slug": "pants",
                "price": 75.00,
                "image": "https://images.unsplash.com/photo-1542272604-787c3835535d?q=80&w=800&auto=format&fit=crop"
            },
            {
                "name": "FLANNEL SHIRT",
                "slug": "shirts",
                "price": 55.00,
                "image": "https://images.unsplash.com/photo-1596755094514-f87e32f85e2c?q=80&w=800&auto=format&fit=crop"
            },
            {
                "name": "BROWN LOAFERS",
                "slug": "shoes",
                "price": 140.00,
                "image": "https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&w=800&auto=format&fit=crop"
            },
            {
                "name": "MUSTARD BUCKET HAT",
                "slug": "hats",
                "price": 25.00,
                "image": "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?q=80&w=800&auto=format&fit=crop"
            },
        ]

        for p_data in products_data:
            existing = db.query(Product).filter(Product.name == p_data["name"]).first()
            if not existing:
                cat = category_map[p_data["slug"]]
                new_prod = Product(
                    category_id=cat.id,
                    name=p_data["name"],
                    price_mrp=p_data["price"] * 1.2, # Fake MRP
                    price_selling=p_data["price"],
                    is_featured=True,
                    is_published=True
                )
                db.add(new_prod)
                db.commit()
                db.refresh(new_prod)

                # Add image
                db.add(ProductImage(product_id=new_prod.id, s3_url=p_data["image"], display_order=1))
                
                import uuid
                db.add(ProductVariant(product_id=new_prod.id, sku=f"SKU-{uuid.uuid4().hex[:6]}", size="M", stock_qty=10))
                db.add(ProductVariant(product_id=new_prod.id, sku=f"SKU-{uuid.uuid4().hex[:6]}", size="L", stock_qty=5))
                
                db.commit()

        print("Successfully seeded the database!")
    
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
