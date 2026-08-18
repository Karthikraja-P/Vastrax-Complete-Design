import requests
import uuid
import sys
import json
import base64
import hashlib

BASE_URL = "http://127.0.0.1:8088/api/v1"

def test_api():
    print("🚀 Starting End-to-End API Integration Tests...")
    
    unique_suffix = uuid.uuid4().hex[:6]
    test_email = f"test_{unique_suffix}@vastrax.com"
    test_password = "password123"
    
    # ── 1. Register User ──
    print("\n[1] Registering test user...")
    register_payload = {
        "full_name": "Test User",
        "email": test_email,
        "phone": "+91 99999 88888",
        "password": test_password
    }
    r = requests.post(f"{BASE_URL}/auth/register", json=register_payload)
    if r.status_code != 201:
        print(f"❌ Registration failed: {r.status_code} - {r.text}")
        sys.exit(1)
    
    reg_data = r.json()
    token = reg_data["access_token"]
    refresh_token = reg_data["refresh_token"]
    user_id = reg_data["user"]["id"]
    print(f"✅ User registered successfully. ID: {user_id}")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # ── 2. Login User ──
    print("\n[2] Logging in...")
    login_payload = {
        "email": test_email,
        "password": test_password
    }
    r = requests.post(f"{BASE_URL}/auth/login", json=login_payload)
    if r.status_code != 200:
        print(f"❌ Login failed: {r.status_code} - {r.text}")
        sys.exit(1)
    login_data = r.json()
    token = login_data["access_token"]
    refresh_token = login_data["refresh_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("✅ Login successful.")

    
    # ── 3. Token Refresh Loop ──
    print("\n[3] Refreshing access token...")
    refresh_payload = {
        "refresh_token": refresh_token
    }
    r = requests.post(f"{BASE_URL}/auth/refresh", json=refresh_payload)
    if r.status_code != 200:
        print(f"❌ Token refresh failed: {r.status_code} - {r.text}")
        sys.exit(1)
    
    refresh_data = r.json()
    new_token = refresh_data["access_token"]
    headers = {"Authorization": f"Bearer {new_token}"}
    print("✅ Access token refreshed successfully.")
    
    # ── 4. Retrieve Catalog & Categories ──
    print("\n[4] Fetching products and categories...")
    r = requests.get(f"{BASE_URL}/products")
    print(f"Products response: {r.status_code} - {r.text}")
    if r.status_code != 200:
        print(f"❌ Failed to fetch products: {r.status_code}")
        sys.exit(1)
    products = r.json()
    if not products:
        print("⚠️ Warning: No products in catalog. Did you run seed_db.py?")
        sys.exit(1)
    
    product_id = products[0]["id"]
    size = products[0]["variants"][0]["size"]
    variant_id = products[0]["variants"][0]["sku"]
    unit_price = products[0]["price_selling"]
    print(f"✅ Products fetched. Using product '{product_id}', size '{size}' for test order.")
    
    # ── 5. Place Order ──
    print("\n[5] Placing order...")
    # Add dummy address first
    address_payload = {
        "label": "Home",
        "address_line1": "123 Main St",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "pincode": "600001",
        "is_default": True
    }
    r = requests.post(f"{BASE_URL}/customers/me/addresses", json=address_payload, headers=headers)
    if r.status_code != 201:
        print(f"❌ Failed to add address: {r.status_code} - {r.text}")
        sys.exit(1)
    address = r.json()
    address_id = address["id"]
    
    order_payload = {
        "address_id": address_id,
        "items": [
            {
                "product_id": product_id,
                "variant_id": variant_id,
                "quantity": 1,
                "unit_price": unit_price
            }
        ],
        "total_amount": unit_price,
        "payment_method": "UPI"
    }
    
    r = requests.post(f"{BASE_URL}/orders", json=order_payload, headers=headers)
    if r.status_code != 201:
        print(f"❌ Failed to place order: {r.status_code} - {r.text}")
        sys.exit(1)
    
    order = r.json()
    order_id = order["id"]
    print(f"✅ Order placed successfully. Order ID: {order_id}")
    
    # ── 6. Initiate Payment ──
    print("\n[6] Initiating payment...")
    payment_payload = {
        "order_id": order_id,
        "amount": unit_price,
        "payment_method": "UPI"
    }
    r = requests.post(f"{BASE_URL}/payments/initiate", json=payment_payload, headers=headers)
    if r.status_code != 200:
        print(f"❌ Payment initiation failed: {r.status_code} - {r.text}")
        sys.exit(1)
        
    payment_data = r.json()
    txn_id = payment_data["txn_id"]
    print(f"✅ Payment initiated. Transaction ID: {txn_id}, Mode: {payment_data['mode']}")
    
    # ── 7. Verify Webhook (Simulated Callback) ──
    print("\n[7] Simulating PhonePe webhook callback...")
    response_payload = {
        "success": True,
        "code": "PAYMENT_SUCCESS",
        "message": "Payment completed successfully",
        "data": {
            "merchantId": "MERCHANT_ID_MOCK",
            "merchantTransactionId": txn_id,
            "transactionId": f"MOCK-PROVIDER-{txn_id}",
            "amount": int(unit_price * 100),
            "state": "COMPLETED",
            "responseCode": "SUCCESS"
        }
    }
    
    response_json = json.dumps(response_payload)
    response_b64 = base64.b64encode(response_json.encode()).decode()
    webhook_body = {
        "response": response_b64
    }
    
    # Verification headers. In mock mode, checksum validation is bypassed.
    webhook_headers = {
        "X-VERIFY": "MOCK-X-VERIFY-HEADER",
        "Content-Type": "application/json"
    }
    
    r = requests.post(f"{BASE_URL}/payments/webhook", json=webhook_body, headers=webhook_headers)
    if r.status_code != 200:
        print(f"❌ Webhook simulation failed: {r.status_code} - {r.text}")
        sys.exit(1)
    print("✅ Webhook simulation processed successfully.")
    
    # ── 8. Check Payment Status ──
    print("\n[8] Checking payment status...")
    r = requests.get(f"{BASE_URL}/payments/status/{txn_id}", headers=headers)
    if r.status_code != 200:
        print(f"❌ Failed to fetch payment status: {r.status_code} - {r.text}")
        sys.exit(1)
        
    payment_status = r.json()
    if payment_status["status"] != "success":
        print(f"❌ Payment status is {payment_status['status']}, expected 'success'")
        sys.exit(1)
    print(f"✅ Payment transaction completed successfully (status: {payment_status['status']}).")
    
    # ── 9. Check Order payment status update ──
    print("\n[9] Checking order payment status...")
    r = requests.get(f"{BASE_URL}/orders/my/{order_id}", headers=headers)
    if r.status_code != 200:
        print(f"❌ Failed to check order status: {r.status_code} - {r.text}")
        sys.exit(1)
        
    order_status = r.json()
    if order_status["payment_status"] != "paid" or order_status["status"] != "confirmed":
        print(f"❌ Order status mismatch: payment_status={order_status['payment_status']}, status={order_status['status']}")
        sys.exit(1)
    print("✅ Order status is confirmed and paid.")
    
    # ── 10. Admin Authentication ──
    print("\n[10] Authenticating as Admin...")
    admin_login_payload = {
        "email": "owner@vastrax.com",
        "password": test_password
    }
    r = requests.post(f"{BASE_URL}/auth/login", json=admin_login_payload)
    if r.status_code != 200:
        print(f"❌ Admin login failed: {r.status_code} - {r.text}")
        sys.exit(1)
        
    admin_token = r.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("✅ Admin authenticated.")
    
    # ── 11. Admin Payments Ledger Check ──
    print("\n[11] Checking admin payments ledger...")
    r = requests.get(f"{BASE_URL}/payments/admin", headers=admin_headers)
    if r.status_code != 200:
        print(f"❌ Admin payments list failed: {r.status_code} - {r.text}")
        sys.exit(1)
        
    payments_list = r.json()
    txn_found = any(p["id"] == txn_id for p in payments_list)
    if not txn_found:
        print(f"❌ Transaction {txn_id} not found in admin payments ledger.")
        sys.exit(1)
    print("✅ Transaction found in admin ledger.")
    
    # ── 12. Admin Refund Check ──
    print("\n[12] Initiating admin refund...")
    refund_payload = {
        "txn_id": txn_id,
        "amount": unit_price
    }
    r = requests.post(f"{BASE_URL}/payments/admin/refund", json=refund_payload, headers=admin_headers)
    if r.status_code != 200:
        print(f"❌ Admin refund failed: {r.status_code} - {r.text}")
        sys.exit(1)
    print("✅ Refund processed successfully.")
    
    # ── 13. Verify Refund Status ──
    print("\n[13] Verifying refund on payment & order...")
    r = requests.get(f"{BASE_URL}/payments/status/{txn_id}", headers=headers)
    if r.json()["status"] != "refunded":
        print(f"❌ Payment status is {r.json()['status']}, expected 'refunded'")
        sys.exit(1)
        
    r = requests.get(f"{BASE_URL}/orders/my/{order_id}", headers=headers)
    if r.json()["payment_status"] != "refunded":
        print(f"❌ Order payment status is {r.json()['payment_status']}, expected 'refunded'")
        sys.exit(1)
    print("✅ Refund status verified successfully.")

    # ── 14. Admin Product Image Pre-signed URL generation ──
    print("\n[14] Testing S3 presigned URL generation for product...")
    img_payload = {
        "filename": "test_garment.png",
        "content_type": "image/png"
    }
    r = requests.post(f"{BASE_URL}/products/{product_id}/images", json=img_payload, headers=admin_headers)
    if r.status_code != 200:
        print(f"❌ Admin image presign failed: {r.status_code} - {r.text}")
        sys.exit(1)
        
    presign_data = r.json()
    if "upload_url" not in presign_data or "s3_url" not in presign_data:
        print(f"❌ Presigned response missing fields: {presign_data}")
        sys.exit(1)
    print("✅ S3 pre-signed URL generation successful.")

    print("\n🎉 All integration tests passed successfully without errors!")

if __name__ == "__main__":
    test_api()
