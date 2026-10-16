"""Concurrent try-on + 3D load test against the live local stack using a throwaway user (deleted afterwards).
Usage: backend/.venv/bin/python scripts/loadtest_gpu.py [tryons=4] [with3d=1]"""
import glob, json, os, sqlite3, sys, threading, time, uuid
import httpx

BASE = "http://localhost:8090/api/v1"
DB = "backend/vastrax.db"
N = int(sys.argv[1]) if len(sys.argv) > 1 else 4
WITH_3D = (sys.argv[2] if len(sys.argv) > 2 else "1") == "1"
email = f"loadtest_{uuid.uuid4().hex[:8]}@example.com"
ip = {"X-Forwarded-For": "10.77.0.1"}

httpx.post(f"{BASE}/otp/send", json={"email": email}, headers=ip, timeout=30)  # mail delivery to example.com may fail; the code is read from the DB
db = sqlite3.connect(DB)
code = db.execute("select code from otps where identifier=? and is_used=0", (email,)).fetchone()[0]
tok = httpx.post(f"{BASE}/otp/verify", json={"email": email, "code": code}, headers=ip, timeout=30).json()["access_token"]
H = {"Authorization": f"Bearer {tok}", **ip}
person = sorted(glob.glob("backend/user_uploads/gpu_person_*.jpg"), key=os.path.getsize)[-1]
front = sorted(glob.glob("backend/user_uploads/vtx_3d_*_front.jpg"), key=os.path.getsize)[-1]
pid = db.execute("select id from products where name='TShirt'").fetchone()[0]
res, t0 = [], time.time()

def tryon(i):
    s = time.time()
    with open(person, "rb") as f:
        r = httpx.post(f"{BASE}/try-on", headers=H, files={"person_image": f}, data={"product_id": pid}, timeout=1500)
    res.append((f"tryon{i}", r.status_code, round(time.time() - s), r.text[:80].replace("\n", " ")))

def gen3d():
    s = time.time()
    with open(front, "rb") as f:
        r = httpx.post(f"{BASE}/3d/generate", headers=H, files={"front_image": f}, data={"product_name": "loadtest"}, timeout=1700)
    res.append(("3d", r.status_code, round(time.time() - s), r.text[:80].replace("\n", " ")))

th = [threading.Thread(target=tryon, args=(i,)) for i in range(N)] + ([threading.Thread(target=gen3d)] if WITH_3D else [])
for t in th: t.start(); time.sleep(0.5)
for t in th: t.join()
print(f"total {round(time.time()-t0)}s")
for r in sorted(res, key=lambda x: x[2]): print(*r)
uid = db.execute("select id from users where email=?", (email,)).fetchone()[0]
for t in ("tryon_sessions", "chat_messages", "addresses", "wishlists"):
    db.execute(f"delete from {t} where user_id=?", (uid,))
db.execute("delete from users where id=?", (uid,)); db.execute("delete from otps"); db.commit(); print("throwaway user removed")
