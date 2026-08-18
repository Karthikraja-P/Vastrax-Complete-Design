import os
import sys
import boto3
from decimal import Decimal

# Add backend directory to sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from dotenv import load_dotenv
load_dotenv(os.path.join(BASE_DIR, ".env"))

dynamodb = boto3.resource('dynamodb', region_name=os.getenv('AWS_DEFAULT_REGION', 'ap-south-1'))

def seed():
    print("Seeding DynamoDB tables...")
    
    # 1. Seed Users
    users_table = dynamodb.Table('vastrax_users')
    hashed_pwd = "$2b$12$PuD9o79DVvDzoL1AotsciONTCaWc2P.pA5EjLTZCRRVzquHoiSyLS" # bcrypt hash of password123
    
    users = [
        {
            "id": "aishwarya-rajesh-id",
            "full_name": "Aishwarya Rajesh",
            "email": "aishwarya.r@outlook.com",
            "phone": "+91 99622 88110",
            "password_hash": hashed_pwd,
            "role": "customer",
            "is_active": True,
            "created_at": "2026-06-12T11:47:00Z",
            "addresses": [
                {
                    "id": "addr-1",
                    "label": "Home (Default)",
                    "address_line1": "No. 24, Poes Garden",
                    "city": "Chennai",
                    "state": "Tamil Nadu",
                    "pincode": "600086",
                    "is_default": True
                },
                {
                    "id": "addr-2",
                    "label": "Office",
                    "address_line1": "Ascendas IT Park, Phase II, Taramani",
                    "city": "Chennai",
                    "state": "Tamil Nadu",
                    "pincode": "600113",
                    "is_default": False
                }
            ],
            "wishlist": []
        },
        {
            "id": "boutique-owner-id",
            "full_name": "Boutique Owner",
            "email": "owner@vastrax.com",
            "phone": "+91 99622 88111",
            "password_hash": hashed_pwd,
            "role": "admin",
            "is_active": True,
            "created_at": "2026-06-12T11:47:00Z",
            "addresses": [],
            "wishlist": []
        }
    ]
    
    for u in users:
        print(f"Adding user {u['email']}...")
        users_table.put_item(Item=u)
        
    # 2. Seed Categories
    categories_table = dynamodb.Table('vastrax_categories')
    categories = [
        {
            "slug": "dress",
            "name": "Frocks",
            "image_url": "/catalog/frock_floral.jpg"
        },
        {
            "slug": "pants",
            "name": "Pants",
            "image_url": "/catalog/pants_beige.jpg"
        },
        {
            "slug": "tops",
            "name": "Tops",
            "image_url": "/catalog/top_vneck.png"
        }
    ]
    
    for c in categories:
        print(f"Adding category {c['slug']}...")
        categories_table.put_item(Item=c)
        
    # 3. Seed Products
    products_table = dynamodb.Table('vastrax_products')
    products_data = [
        {
            "id": "vtx-frock-floral",
            "name": "Aditi Floral A-Line Frock",
            "category_slug": "dress",
            "fabric": "Pure Chiffon Crepe",
            "colour": "French Blue Floral",
            "price_mrp": Decimal("4999.00"),
            "price_selling": Decimal("2499.00"),
            "description": "An elegant and breezy French blue A-line dress featuring vibrant hand-painted floral motifs. Crafted from lightweight, high-grade chiffon crepe for unmatched comfort and premium aesthetics.",
            "images": [{"s3_url": "/catalog/frock_floral.jpg", "is_primary": True, "sort_order": 0}],
            "variants": [
                {"size": "S", "stock_qty": 8, "sku": "VTX-FROCK-FLORAL-S"},
                {"size": "M", "stock_qty": 12, "sku": "VTX-FROCK-FLORAL-M"},
                {"size": "L", "stock_qty": 10, "sku": "VTX-FROCK-FLORAL-L"},
                {"size": "XL", "stock_qty": 5, "sku": "VTX-FROCK-FLORAL-XL"}
            ],
            "is_featured": True,
            "is_published": True,
            "created_at": "2026-06-12T11:47:00Z",
            "occasion": ["party", "casual"],
            "style": ["elegant", "breezy", "a-line"],
            "body_type": ["petite", "hourglass"],
            "height": ["regular", "petite"],
            "fit": "regular",
            "pattern": "floral"
        },
        {
            "id": "vtx-frock-textured",
            "name": "Puff-Sleeve Textured Midi Frock",
            "category_slug": "dress",
            "fabric": "Embossed Jacquard Cotton",
            "colour": "Powder Blue",
            "price_mrp": Decimal("5499.00"),
            "price_selling": Decimal("2999.00"),
            "description": "A luxurious structured square-neck midi dress featuring puff sleeves and an exquisite embossed jacquard texture. Perfect for high-fashion daytime engagements or premium garden parties.",
            "images": [{"s3_url": "/catalog/frock_textured.jpg", "is_primary": True, "sort_order": 0}],
            "variants": [
                {"size": "S", "stock_qty": 6, "sku": "VTX-FROCK-TEXTURED-S"},
                {"size": "M", "stock_qty": 10, "sku": "VTX-FROCK-TEXTURED-M"},
                {"size": "L", "stock_qty": 8, "sku": "VTX-FROCK-TEXTURED-L"},
                {"size": "XL", "stock_qty": 4, "sku": "VTX-FROCK-TEXTURED-XL"}
            ],
            "is_featured": True,
            "is_published": True,
            "created_at": "2026-06-12T11:47:00Z",
            "occasion": ["party", "daytime"],
            "style": ["luxurious", "structured", "puff-sleeve"],
            "body_type": ["hourglass", "tall", "apple"],
            "height": ["tall", "regular"],
            "fit": "fitted",
            "pattern": "textured"
        },
        {
            "id": "vtx-pants-beige",
            "name": "Linen Striped Wide-Leg Trousers",
            "category_slug": "pants",
            "fabric": "Premium Linen Blend",
            "colour": "Oatmeal Beige",
            "price_mrp": Decimal("3999.00"),
            "price_selling": Decimal("1999.00"),
            "description": "Sophisticated, high-waisted trousers crafted from a premium organic linen blend. Features subtle vertical stripe patterns and double-pleated fronts for a modern, relaxed silhouette.",
            "images": [{"s3_url": "/catalog/pants_beige.jpg", "is_primary": True, "sort_order": 0}],
            "variants": [
                {"size": "S", "stock_qty": 10, "sku": "VTX-PANTS-BEIGE-S"},
                {"size": "M", "stock_qty": 15, "sku": "VTX-PANTS-BEIGE-M"},
                {"size": "L", "stock_qty": 12, "sku": "VTX-PANTS-BEIGE-L"},
                {"size": "XL", "stock_qty": 6, "sku": "VTX-PANTS-BEIGE-XL"}
            ],
            "is_featured": True,
            "is_published": True,
            "created_at": "2026-06-12T11:47:00Z",
            "occasion": ["casual", "office"],
            "style": ["sophisticated", "wide-leg", "striped"],
            "body_type": ["tall", "pear", "hourglass"],
            "height": ["tall", "regular"],
            "fit": "relaxed",
            "pattern": "striped"
        },
        {
            "id": "vtx-pants-flared",
            "name": "High-Waisted Flared Tailored Trousers",
            "category_slug": "pants",
            "fabric": "Tailored Ponte Knit",
            "colour": "Sand Beige",
            "price_mrp": Decimal("4499.00"),
            "price_selling": Decimal("2299.00"),
            "description": "Sleek and contouring high-waisted pants with a dramatic flared leg. Tailored from premium, dense ponte knit that holds its shape beautifully while offering ultimate sophistication.",
            "images": [{"s3_url": "/catalog/pants_flared.jpg", "is_primary": True, "sort_order": 0}],
            "variants": [
                {"size": "S", "stock_qty": 5, "sku": "VTX-PANTS-FLARED-S"},
                {"size": "M", "stock_qty": 8, "sku": "VTX-PANTS-FLARED-M"},
                {"size": "L", "stock_qty": 8, "sku": "VTX-PANTS-FLARED-L"},
                {"size": "XL", "stock_qty": 4, "sku": "VTX-PANTS-FLARED-XL"}
            ],
            "is_featured": True,
            "is_published": True,
            "created_at": "2026-06-12T11:47:00Z",
            "occasion": ["office", "party", "formal"],
            "style": ["sleek", "flared", "tailored"],
            "body_type": ["tall", "hourglass"],
            "height": ["tall", "regular"],
            "fit": "fitted",
            "pattern": "solid"
        },
        {
            "id": "vtx-top-vneck",
            "name": "V-Neck Collared Knit Top",
            "category_slug": "tops",
            "fabric": "Knit Rib Cotton",
            "colour": "Navy & Light Blue",
            "price_mrp": Decimal("2999.00"),
            "price_selling": Decimal("1499.00"),
            "description": "A preppy Navy Blue v-neck knit top featuring a smart light-blue striped collared layered insert. Crafted from high-density stretch knit rib cotton for a sophisticated, structured silhouette.",
            "images": [{"s3_url": "/catalog/top_vneck.png", "is_primary": True, "sort_order": 0}],
            "variants": [
                {"size": "S", "stock_qty": 10, "sku": "VTX-TOP-VNECK-S"},
                {"size": "M", "stock_qty": 15, "sku": "VTX-TOP-VNECK-M"},
                {"size": "L", "stock_qty": 12, "sku": "VTX-TOP-VNECK-L"},
                {"size": "XL", "stock_qty": 8, "sku": "VTX-TOP-VNECK-XL"}
            ],
            "is_featured": True,
            "is_published": True,
            "created_at": "2026-06-12T11:47:00Z",
            "occasion": ["casual", "office", "preppy"],
            "style": ["preppy", "knit", "striped-collar"],
            "body_type": ["apple", "hourglass", "regular"],
            "height": ["regular", "petite"],
            "fit": "fitted",
            "pattern": "striped"
        },
        {
            "id": "vtx-top-tieup",
            "name": "Tie-Up Neck Fitted Top",
            "category_slug": "tops",
            "fabric": "Crinkled Chiffon",
            "colour": "Lime Olive Green",
            "price_mrp": Decimal("2499.00"),
            "price_selling": Decimal("1299.00"),
            "description": "A vibrant summer-ready halter top with a stylish tie-up bow at the neck. Tailored in a beautiful crinkled texture with a gathered twist front that creates a flattering, fitted silhouette.",
            "images": [{"s3_url": "/catalog/top_tieup.jpg", "is_primary": True, "sort_order": 0}],
            "variants": [
                {"size": "S", "stock_qty": 8, "sku": "VTX-TOP-TIEUP-S"},
                {"size": "M", "stock_qty": 12, "sku": "VTX-TOP-TIEUP-M"},
                {"size": "L", "stock_qty": 10, "sku": "VTX-TOP-TIEUP-L"},
                {"size": "XL", "stock_qty": 5, "sku": "VTX-TOP-TIEUP-XL"}
            ],
            "is_featured": True,
            "is_published": True,
            "created_at": "2026-06-12T11:47:00Z",
            "occasion": ["casual", "party", "summer"],
            "style": ["halter", "tie-up", "vibrant"],
            "body_type": ["petite", "hourglass"],
            "height": ["regular", "petite"],
            "fit": "fitted",
            "pattern": "textured"
        },
        {
            "id": "vtx-top-checked",
            "name": "Checked Collared Button Top",
            "category_slug": "tops",
            "fabric": "Gingham Seersucker",
            "colour": "Caramel Brown Checked",
            "price_mrp": Decimal("2799.00"),
            "price_selling": Decimal("1399.00"),
            "description": "An adorable short-sleeve collared top featuring caramel brown seersucker gingham checks, puff sleeves, and a delicate ruffle trim border along the button placket.",
            "images": [{"s3_url": "/catalog/top_checked.jpg", "is_primary": True, "sort_order": 0}],
            "variants": [
                {"size": "S", "stock_qty": 6, "sku": "VTX-TOP-CHECKED-S"},
                {"size": "M", "stock_qty": 10, "sku": "VTX-TOP-CHECKED-M"},
                {"size": "L", "stock_qty": 8, "sku": "VTX-TOP-CHECKED-L"},
                {"size": "XL", "stock_qty": 4, "sku": "VTX-TOP-CHECKED-XL"}
            ],
            "is_featured": True,
            "is_published": True,
            "created_at": "2026-06-12T11:47:00Z",
            "occasion": ["casual", "daytime"],
            "style": ["checked", "puff-sleeve", "vintage"],
            "body_type": ["petite", "hourglass", "pear"],
            "height": ["regular", "petite"],
            "fit": "regular",
            "pattern": "checked"
        },
        {
            "id": "vtx-top-slimfit",
            "name": "Slim Fit Short Sleeved Top",
            "category_slug": "tops",
            "fabric": "Stretch Poplin Cotton",
            "colour": "Blush Pink",
            "price_mrp": Decimal("3299.00"),
            "price_selling": Decimal("1699.00"),
            "description": "A sharp and feminine blush pink short-sleeved top with exquisite pin-tuck details running down the front. Crafted from stretch poplin cotton for a contouring, slim fit.",
            "images": [{"s3_url": "/catalog/top_slimfit.png", "is_primary": True, "sort_order": 0}],
            "variants": [
                {"size": "S", "stock_qty": 12, "sku": "VTX-TOP-SLIMFIT-S"},
                {"size": "M", "stock_qty": 15, "sku": "VTX-TOP-SLIMFIT-M"},
                {"size": "L", "stock_qty": 12, "sku": "VTX-TOP-SLIMFIT-L"},
                {"size": "XL", "stock_qty": 6, "sku": "VTX-TOP-SLIMFIT-XL"}
            ],
            "is_featured": True,
            "is_published": True,
            "created_at": "2026-06-12T11:47:00Z",
            "occasion": ["office", "casual", "formal"],
            "style": ["feminine", "classic", "pin-tuck"],
            "body_type": ["petite", "hourglass"],
            "height": ["regular", "petite"],
            "fit": "fitted",
            "pattern": "solid"
        },
        {
            "id": "vtx-top-wrap",
            "name": "Wrap Style Top",
            "category_slug": "tops",
            "fabric": "Satin Crepe",
            "colour": "Sky Blue Stripe",
            "price_mrp": Decimal("3499.00"),
            "price_selling": Decimal("1799.00"),
            "description": "A luxurious long-sleeve wrap top featuring sky-blue stripes and elegant bishop-style cuffs. The surplice neckline and gathered tie waist create a premium, tailored silhouette.",
            "images": [{"s3_url": "/catalog/top_wrap.jpg", "is_primary": True, "sort_order": 0}],
            "variants": [
                {"size": "S", "stock_qty": 5, "sku": "VTX-TOP-WRAP-S"},
                {"size": "M", "stock_qty": 8, "sku": "VTX-TOP-WRAP-M"},
                {"size": "L", "stock_qty": 8, "sku": "VTX-TOP-WRAP-L"},
                {"size": "XL", "stock_qty": 4, "sku": "VTX-TOP-WRAP-XL"}
            ],
            "is_featured": True,
            "is_published": True,
            "created_at": "2026-06-12T11:47:00Z",
            "occasion": ["office", "party", "daytime"],
            "style": ["wrap", "bishop-sleeve", "elegant"],
            "body_type": ["hourglass", "pear", "tall"],
            "height": ["tall", "regular"],
            "fit": "fitted",
            "pattern": "striped"
        }
    ]
    
    for p in products_data:
        print(f"Adding product {p['id']}...")
        products_table.put_item(Item=p)
        
    print("DynamoDB seeding complete!")

if __name__ == '__main__':
    seed()
