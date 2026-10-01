"""Remove QA/test data before launch (approved by owner). Dry-run unless --apply; backup is taken first."""
import argparse, os, secrets, shutil, sqlite3, sys, time

DB = "backend/vastrax.db"
TEST_EMAIL = ("testuser_%", "user_1%", "audit_%", "live_qa_%", "reg_%", "test_patron_%", "gpu_test_user@%", "customer@vastrax.com", "%@vastrax-test.internal")
TEST_CATEGORY = ("hautecouture-%", "qa-test-%")
ap = argparse.ArgumentParser(); ap.add_argument("--apply", action="store_true"); ap.add_argument("--admin-email", default="admin@vastrax.com")
a = ap.parse_args()
c = sqlite3.connect(DB)
q = lambda s, p=(): c.execute(s, p).fetchall()
ids = lambda rows: [r[0] for r in rows]
m = lambda xs: ",".join("?" * len(xs))
users = ids(q("select id from users where " + " or ".join(["email like ?"] * len(TEST_EMAIL)), TEST_EMAIL))
prods = ids(q("select id from products where name like 'QA %'"))
cats = ids(q("select id from categories where " + " or ".join(["slug like ?"] * len(TEST_CATEGORY)), TEST_CATEGORY))
orders = set(ids(q(f"select id from orders where user_id in ({m(users)})", users))) if users else set()
if prods: orders |= set(ids(q(f"select distinct order_id from order_items where product_id in ({m(prods)})", prods)))
orders = sorted(orders)
print(f"users={len(users)} products={len(prods)} categories={len(cats)} orders={len(orders)} (+ all OTPs)")
if not a.apply:
    sys.exit("dry run; pass --apply")
os.makedirs(os.path.expanduser("~/vastrax-backups"), exist_ok=True)
bak = os.path.expanduser(f"~/vastrax-backups/pre-cleanup-{int(time.time())}.db")
b = sqlite3.connect(bak); c.backup(b); b.close(); print("backup ->", bak)
def delete(t, col, vals):
    if vals: c.execute(f"delete from {t} where {col} in ({m(vals)})", vals)
delete("payments", "order_id", orders); delete("order_items", "order_id", orders); delete("orders", "id", orders)
for t in ("payments", "addresses", "chat_messages", "wishlists", "tryon_sessions", "stock_notifications", "product_reviews", "support_tickets"):
    if q("select 1 from pragma_table_info(?) where name='user_id'", (t,)): delete(t, "user_id", users)
for t in ("product_images", "product_variants", "wishlists", "tryon_sessions", "stock_notifications", "product_reviews", "order_items"):
    delete(t, "product_id", prods)
delete("products", "id", prods); delete("categories", "id", cats); delete("users", "id", users)
c.execute("delete from otps")
pw = secrets.token_urlsafe(18)
sys.path.insert(0, "backend"); os.environ.setdefault("JWT_SECRET_KEY", "x" * 40)
from app.core.security import hash_password
n = c.execute("update users set hashed_password=? where email=? and role='admin'", (hash_password(pw), a.admin_email)).rowcount
c.commit()
if n:
    p = os.path.expanduser("~/vastrax-admin-credentials.txt")
    with open(os.open(p, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), "w") as f: f.write(f"{a.admin_email}\n{pw}\n")
    print("admin password rotated ->", p)
used = {os.path.basename(r[0] or "") for r in q("select model_path from products")}
for f in os.listdir("public/models/3d"):
    if f.startswith(("vtx_3d_", "64a63aa0")) and f not in used:
        os.remove(os.path.join("public/models/3d", f)); print("removed model", f)
print("done")
