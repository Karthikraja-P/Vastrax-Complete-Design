# VastraX — Application End-to-End Test Scripts

This document details step-by-step procedures to test the full frontend UI, backend APIs, and AWS integrations of the VastraX platform.

---

## 1. Authentication & Session Loop Test
**Objective:** Verify register, login, logout, and the automatic JWT refresh token loops.

1. **User Registration:**
   - Open browser to `http://localhost:3000/register`.
   - Fill in details: `Full Name`, `Email` (e.g. `testuser@vastrax.com`), `Phone`, and `Password`.
   - Click **Create Account**.
   - **Verification:** User should be redirected to the Home page and logged in. Inspect browser localStorage `vx_token` and `vx_refresh_token` to confirm they exist.

2. **User Login:**
   - Logout from header.
   - Go to `http://localhost:3000/login`.
   - Enter credentials and sign in.
   - **Verification:** Login succeeds; user details restore from real API.

3. **Access Token Refresh (Automatic):**
   - Open DevTools Console.
   - In application LocalStorage, edit the `vx_token` value slightly (corrupting it) but leave `vx_refresh_token` valid.
   - Perform any authenticated action (e.g., go to Profile Page or toggle a wishlist item).
   - **Verification:** The frontend API interceptor detects the expired/invalid access token, calls `/api/v1/auth/refresh` behind the scenes, stores the new tokens, and completes your original request transparently without prompting for login.

---

## 2. Product Catalog & Image Upload Test
**Objective:** Verify garment inventory management and S3 pre-signed upload URLs.

1. **Admin Login:**
   - Go to `http://localhost:3000/admin/login` or click Admin Console at footer.
   - Login with `owner@vastrax.com` / `password123`.
   - **Verification:** Redirects to the Admin Dashboard.

2. **Add New Garment with Presigned Upload:**
   - Navigate to **Garments** (Inventory) → Click **Add Garment**.
   - Trigger the S3 pre-signed URL upload endpoint via a simulated `POST` call or by saving:
     - Endpoint: `POST /api/v1/products/{product_id}/images`
     - Payload: `{ "filename": "new_garment.jpg", "content_type": "image/jpeg" }`
     - Headers: `Authorization: Bearer <admin_token>`
   - **Verification:** The backend returns:
     ```json
     {
       "upload_url": "https://vastrax-assets.s3.ap-south-1.amazonaws.com/catalog/...",
       "s3_url": "https://vastrax-assets.s3.ap-south-1.amazonaws.com/catalog/...",
       "key": "catalog/..."
     }
     ```
   - Publish the garment with this S3 URL path.

---

## 3. Order Placement & PhonePe Payment Test
**Objective:** Verify order checkout, PhonePe payment initiation, simulation loop, webhook signature verification, and stock updates.

1. **Browse and Add to Cart:**
   - Go to the store frontend home/collections.
   - Select a garment (e.g. "Aditi Floral A-Line Frock" size `S`). Note the stock count before order.
   - Add to Cart and click **Checkout**.

2. **Initiate Simulated Payment:**
   - Choose shipping address, select **Online UPI/Card** payment, and click **Place Order**.
   - The app initiates payment via `POST /api/v1/payments/initiate`.
   - **Verification:** Since real credentials are not loaded, the app redirects to the **Simulation Payment Gateway** page at `http://localhost:3000/checkout/payment-simulation?txn_id=TXN-VX-...&amount=...`.

3. **Success Scenario (Webhook Verification):**
   - Click **Pay Successfully** on the simulation page.
   - This triggers the simulated callback to `POST /api/v1/payments/webhook`.
   - **Verification:** The backend verifies signature index (if configured), processes payment, sets transaction state to `success`, marks the order `confirmed` (payment_status: `paid`).
   - The user is redirected to the checkout success page showing order receipt details.
   - Verify product variant stock decreased by the ordered quantity.

4. **Failure Scenario (Cancellation & Stock Restoration):**
   - Add another item, proceed to checkout, and go to the simulation page.
   - Click **Fail Payment / Cancel**.
   - Webhook callback is processed.
   - **Verification:** Backend marks transaction `failed`, sets order status to `cancelled`, and automatically restores the inventory stock levels for the selected variant.

---

## 4. Virtual Try-On (FASHN AI) Test
**Objective:** Verify user portrait uploads, inference pipeline, status tracking, and history logging.

1. **Submit Try-On Job:**
   - Go to any product details page and click the **Virtual Try-On** floating banner or button.
   - Upload a portrait photo (e.g., standard front-facing model picture).
   - Click **Generate Try-On**.
   - **Verification:** Triggers `POST /api/v1/tryon/start`, uploads photo, generates unique session ID, and kicks off inference.

2. **Status Polling:**
   - The frontend polls status via `GET /api/v1/tryon/status/{job_id}`.
   - **Verification:** Poller receives `processing` state, followed by `done` when inference completes. The final output is rendered on the screen with a slider comparing "Before" (your portrait) and "After" (the garment fit).

3. **Inference History:**
   - Go to **Account** → **Try-On History**.
   - **Verification:** Previous try-on sessions are fetched from `vastrax_tryon_sessions` and listed in chronological order.

---

## 5. Customer Profile, Address CRUD & Wishlist Test
**Objective:** Verify customer profile adjustments, address book entries, and wishlist toggling.

1. **Profile Details Modification:**
   - Go to **Account** → **Profile Settings** (`http://localhost:3000/profile`).
   - Change the `Full Name` and `Phone Number`. Click **Save Changes**.
   - **Verification:** Refresh the page to confirm changes remain. Query `vastrax_users` DB to verify updates persisted.

2. **Address Book CRUD Operations:**
   - Go to **Account** → **Addresses** (`http://localhost:3000/addresses`).
   - **Create:** Click **Add New Address**, fill form (Label: `Office`, Line 1: `IT Park`, City: `Chennai`, Pincode: `600113`, Default: `False`), and save.
   - **Read:** Confirm the new address shows in the address card grid.
   - **Update:** Click **Edit** on the address card, change Pincode to `600114`, and save. Confirm display updates.
   - **Delete:** Click **Delete** on the address card. Confirm card is removed.

3. **Wishlist Syncing:**
   - Browse the catalog. Hover over a product and click the **Heart Icon** (wishlist toggle).
   - Go to **Account** → **Wishlist** (`http://localhost:3000/wishlist`).
   - **Verification:** The wishlisted garment appears in the list. Click the Heart Icon again to remove it and verify it disappears.

---

## 6. Admin Management & Operations Test
**Objective:** Verify administrative control panels, order processing, and transaction ledger.

1. **Orders Dashboard & Status Lifecycle:**
   - Log in as admin and go to **Orders** (`http://localhost:3000/admin/orders`).
   - Select a `confirmed` order.
   - Click **Mark as Packed** (Transitions to `packed`).
   - Click **Mark as Shipped** (Transitions to `shipped`).
   - Click **Mark as Delivered** (Transitions to `delivered`).
   - **Verification:** Check client account page to confirm order status reflects status changes in real-time.

2. **Inventory Stock Adjustments:**
   - Go to **Garments** → Click **Edit** on any item.
   - Modify the stock levels for variant sizes (e.g. change size `M` stock from `12` to `15`). Save changes.
   - **Verification:** Verify new stock levels reflect when customer selects the product sizes.

3. **Payment Ledger & Administrative Refund:**
   - Go to **Payments** (`http://localhost:3000/admin/payments`).
   - **Verification:** The transaction ledger displays transaction entries with Reference IDs, order numbers, customer names, methods, and transaction status (`Success` / `COD Pending`).
   - Select a transaction and click **Initiate Refund**.
   - **Verification:** Payment status displays as `Refunded` on the ledger, and the linked order payment status changes to `refunded`.

---

## 7. Vastra AI Style Advisor Chat Test
**Objective:** Verify conversational AI response generation.

1. **Style Advisory Chatbot Interaction:**
   - Click the **Vastra AI Advisor** widget or floating icon on the page.
   - Enter a query: `"Recommend a top to pair with beige pants."`
   - **Verification:** Chat service responds with custom styling guidance based on catalog products.

