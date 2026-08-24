# VastraX — Application End-to-End Test Scripts

This document details step-by-step procedures to test the full frontend UI, backend APIs, and third-party integrations of the VastraX platform. It reflects the app as actually implemented — there are no dedicated `/login`, `/register`, or `/admin/*` pages; authentication is a modal (`AuthModal`) triggered from the header or a checkout gate, and the admin console lives at the root routes (`/`, `/orders`, `/products`, `/users`, etc.), not under an `/admin` prefix.

---

## 1. Authentication Test
**Objective:** Verify sign-up, sign-in, and session persistence.

1. **User Registration:**
   - Open `http://localhost:3000/storefront/home`, click **Sign In** in the header (or trigger it via **Checkout** while signed out) to open the `AuthModal`.
   - Switch to **Create one**, fill in First/Last Name, Mobile Number, and Password, agree to Terms, and submit.
   - **Verification:** Modal closes, header reflects the signed-in state. `localStorage["vastrax_token"]` holds a JWT, and the NextAuth session cookie is set (the same token is available client-side as `session.accessToken`).

2. **User Login:**
   - Sign out from the header, reopen `AuthModal`, sign in with the same credentials.
   - **Verification:** Sign-in succeeds and the session restores from the real API (`POST /api/v1/auth/login`).

3. **Invalid credentials / unreachable backend:**
   - Attempt sign-in with a wrong password — **Verification:** an inline alert shows the backend's actual error message (`Invalid email or password`), not a generic failure.
   - Stop the backend and reload any page — **Verification:** the app shows the global "Connection Lost" fallback screen (`ServerDownScreen`) instead of any page rendering with empty/mock data, and recovers automatically once the backend is back (or via its **Retry Now** button).

---

## 2. Product Catalog & Image Upload Test
**Objective:** Verify garment inventory management and S3 pre-signed upload URLs.

1. **Admin Login:**
   - Sign in via `AuthModal` with `owner@vastrax.com` / `password123` (or your seeded admin account).
   - Go to `http://localhost:3000/` — **Verification:** the Admin Dashboard renders.

2. **Add New Garment with Presigned Upload:**
   - Navigate to **Products** → **Add Product** (`/products/create`).
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

## 3. Order Placement & Razorpay Payment Test
**Objective:** Verify order checkout, Razorpay order creation, the Checkout.js modal / simulation fallback, signature verification, and stock updates.

1. **Browse and Add to Cart:**
   - Go to the storefront home/collections page.
   - Select a garment, note the stock count before ordering, add to cart, and click **Checkout**.

2. **Initiate Payment:**
   - Choose shipping address, select **Card** or **Apple Pay**, and click **Place Order**.
   - The app initiates payment via `POST /api/v1/payments/initiate`.
   - **Verification:** With real Razorpay credentials configured, this opens the Razorpay Checkout.js modal. Without them (the default), the app shows the in-page **Simulated Payment Gateway** card with `txn_id=TXN-VX-...`.

3. **Success Scenario (Signature Verification):**
   - With real credentials: complete payment in the Razorpay modal — the `handler` callback POSTs the returned `razorpay_order_id`/`razorpay_payment_id`/`razorpay_signature` to `POST /api/v1/payments/verify`, which recomputes and checks the HMAC before accepting.
   - In simulation mode: click **Pay Successfully** on the Simulated Payment card, which POSTs to `POST /api/v1/payments/simulate` (only accepted when the backend has no live Razorpay credentials configured — rejected otherwise).
   - **Verification:** payment status flips to `success`, order `status` becomes `confirmed` / `payment_status` becomes `paid`, and a Shiprocket shipment is booked. The checkout page shows the order confirmation screen. Verify product variant stock decreased by the ordered quantity.

4. **Failure Scenario (Cancellation & Stock Restoration):**
   - Add another item, proceed to checkout.
   - Dismiss the Razorpay modal, or click **Cancel Payment** on the Simulated Payment card.
   - **Verification:** Backend marks transaction `failed`, sets order status to `cancelled`, and restores the inventory stock levels for the selected variant.
   - `POST /api/v1/payments/webhook` (verified against `X-Razorpay-Signature`, never skipped) is the durable server-to-server fallback for both outcomes, independent of whether the browser stays open.

5. **COD path:**
   - Repeat with **Cash / POS** selected — **Verification:** no payment gateway is invoked; the order is created `confirmed`/`pending` immediately and the confirmation screen shows right away.

---

## 4. Virtual Try-On (FASHN AI) Test
**Objective:** Verify garment try-on from a product page.

1. **Submit Try-On:**
   - Go to a product detail page and open its Virtual Try-On page (`/storefront/product/{id}/tryon`).
   - Upload a portrait photo, optionally pick a top to pair (for bottoms), and start the try-on.
   - **Verification:** the page calls `POST /api/v1/try-on` (or `/try-on/combo` for a top+bottom pairing) with the photo and garment reference — this now requires the caller to be signed in (401 if not). The response is synchronous; the composited result renders directly, no polling involved.

2. **Usage is recorded:**
   - As an admin, check `GET /api/v1/analytics/usage` (or the Users page's per-user stat card) — **Verification:** `tryon.total_sessions` incremented, and the signed-in user's card shows an updated try-on count, whether the attempt succeeded or failed.

---

## 5. Customer Account Test
**Objective:** Verify the account portal's order history, wishlist, and profile tabs.

1. Go to `/storefront/account` while signed in.
2. **Orders tab:** confirms past orders and their status appear.
3. **Favorites tab:** confirms wishlisted items (toggled via the heart icon on collections/product pages) appear; toggling syncs to `POST /api/v1/users/me/wishlist/{product_id}` when signed in, or to `localStorage["vastrax_favorites"]` as a guest.
4. **Profile tab:** update name/phone and confirm it persists after a refresh.

---

## 6. Admin Management & Operations Test
**Objective:** Verify administrative control panels, order processing, and the payments ledger.

1. **Orders Dashboard & Status Lifecycle:**
   - Log in as admin, go to **Orders** (`/orders`).
   - Select a `confirmed` order and progress it through **Packed** → **Shipped** → **Delivered**.
   - **Verification:** the customer's account page reflects the status change.

2. **Inventory Stock Adjustments:**
   - Go to **Products** → **Edit** on any item, modify a variant's stock, save.
   - **Verification:** the new stock level reflects on the storefront product page.

3. **Payment Ledger & Administrative Refund:**
   - `GET /api/v1/payments/admin` (admin-only) returns the full transaction ledger.
   - `POST /api/v1/payments/admin/refund` with `{ "txn_id": "...", "amount": ... }` — **Verification:** payment status becomes `refunded`, and the linked order's `payment_status` becomes `refunded`. There is currently no dedicated admin UI page for this — it's API-only.

4. **Per-user usage stat card:**
   - Go to **Users** (`/users`), open **View Profile** on any customer.
   - **Verification:** the slideover shows **Try-Ons** and **AI Chats** counts sourced from `tryon_sessions`/`chat_messages`, scoped correctly to that user (a different user shows different counts, never leaking another customer's activity).

---

## 7. Vastra AI Style Advisor Chat Test
**Objective:** Verify conversational AI response generation.

1. Open the **Vastra AI Advisor** drawer (storefront) or the dedicated `/ai-assistant` page (admin).
2. Enter a query, e.g. `"Recommend a top to pair with beige pants."`
3. **Verification:** `POST /api/v1/chat` responds with styling guidance grounded in real catalog products; both the user's and the assistant's messages are persisted to `chat_messages` (visible via the usage counters above).

---

## 8. Security Regression Checks
**Objective:** Confirm the auth/authorization fixes hold. Run without any `Authorization` header unless noted.

1. `GET /api/v1/users/me` with no token → **401**, not a silently-authenticated admin session.
2. A signed-in **non-admin** customer calling any `/admin/*`-suffixed route (e.g. `GET /api/v1/users/admin/admins`, `GET /api/v1/payments/admin`) → **403**.
3. `POST /api/v1/auth/forgot-password` → response never includes the reset token (delivered by email only).
4. `POST /api/v1/try-on` / `/try-on/combo` with no token → **401**; a `garment_path` containing `../` or an absolute filesystem path is rejected, not read.
5. `POST /api/v1/payments/webhook` with a forged `X-Razorpay-Signature` → **403**, in every configuration (no mock-mode bypass).
6. `POST /api/v1/shipping/cancel` / `/pickup` / `/label` / `/return` with no token → **401**; with a token but no ownership of the order → **403**/**404**.
