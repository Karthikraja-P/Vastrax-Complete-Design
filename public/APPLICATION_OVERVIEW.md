# VASTRAX — Complete Application Architecture & System Overview

VASTRAX is an enterprise-grade cyber-luxury e-commerce platform engineered for haute couture digital commerce. It integrates interactive 3D WebGL garment visualization, AI-powered virtual try-on, an intelligent GPT-4o stylist concierge, automated logistics, and a real-time admin management suite.

---

## 1. System Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                                CLIENT LAYER (BROWSER)                             |
|  - Cyber-Luxury Storefront (Dark/Light Mode, Glassmorphism, Micro-Animations)     |
|  - Three.js / WebGL 360° PBR 3D Garment Viewer & AR Fitting Room                  |
|  - AI Stylist Drawer (Conversational GPT-4o mini with Contextual Recommendations) |
|  - Real-Time Cart Manager (localStorage + Window Custom Events)                   |
|  - Multi-Step Checkout & Simulated / Live Razorpay Gateway Modal                  |
+------------------------------------------+----------------------------------------+
                                           |
                                           | HTTPS / Reverse Proxy (`/api/v1`)
                                           v
+-----------------------------------------------------------------------------------+
|                        APPLICATION LAYER (NEXT.JS 16)                             |
|  - App Router (`src/app/storefront/*`, `src/app/admin/*`, `src/app/products/*`)   |
|  - Server-Side Reverse Proxy (`next.config.ts` -> internal backend)               |
|  - NextAuth.js Authentication Handler & JWT Token Bridges                         |
+------------------------------------------+----------------------------------------+
                                           |
                                           | Internal REST API (`:8090/api/v1`)
                                           v
+-----------------------------------------------------------------------------------+
|                           API LAYER (FASTAPI BACKEND)                             |
|  - Router & Dependency Injection (`app/api/routes/*`)                             |
|  - Strict JWT Authentication & Role-Based Access Control (RBAC)                   |
|  - Business Services Layer (`app/services/*`)                                     |
|  - Database ORM Layer (`SQLAlchemy 2.0` Models & Alembic Migrations)              |
+-------------------+-------------------+-------------------+-----------------------+
                    |                   |                   |
                    v                   v                   v
+-----------------------+ +-----------------------+ +-------------------------------+
|    DATABASE LAYER     | |    AI & 3D ENGINES    | |     EXTERNAL SERVICES         |
| - SQLite (Local Dev)  | | - Fashn VTON 1.5      | | - Razorpay (Payments & HMAC)  |
| - PostgreSQL (Prod)   | | - Hunyuan3D-2.1 Mesh  | | - Shiprocket (Auto Manifest)  |
| - Transaction Logs    | | - OpenAI GPT-4o Mini  | | - Resend (Transactional Email)|
+-----------------------+ +-----------------------+ +-------------------------------+
```

---

## 2. Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Web App** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons, Framer Motion, NextAuth.js |
| **Backend API** | FastAPI, Python 3.12, Uvicorn, SQLAlchemy 2.0, Pydantic v2, Alembic |
| **Database** | SQLite (development) / PostgreSQL (production), SQLite Vector/JSON extensions |
| **3D & Visual Computing**| WebGL, Three.js, Hunyuan3D-2.1 (Shape reconstruction & AI texture painting) |
| **AI Subsystems** | OpenAI GPT-4o mini (Stylist Concierge), FASHN Virtual Try-On 1.5 engine |
| **Payment Gateway** | Razorpay SDK + HMAC-SHA256 signature verification + In-app payment simulation fallback |
| **Logistics & Courier** | Shiprocket REST APIs (Serviceability, AWB generation, automated dispatch manifesting) |
| **Email Infrastructure**| Resend API (HTML receipts, order confirmations, 6-digit registration OTP codes) |

---

## 3. Core Modules & Codebase Map

### 🛍️ A. Storefront & Customer Experience (`/src/app/storefront/`)
- **[Home (`home/page.tsx`)](file:///home/pkr/Vastrax-Complete-Design/src/app/storefront/home/page.tsx)**: Hero video loops, curated categories, trending collections, live cart badge counter.
- **[Collections (`collections/page.tsx`)](file:///home/pkr/Vastrax-Complete-Design/src/app/storefront/collections/page.tsx)**: Dynamic filtering by category, price, and attributes, banner carousels, quick size selector modals, and 3D preview launchers.
- **[Product Details (`product/page.tsx`)](file:///home/pkr/Vastrax-Complete-Design/src/app/storefront/product/page.tsx)**: Interactive 2D/3D gallery switch, real-time size & quantity selectors, trust badges, instant "Buy Now" and "Add to Cart" hooks.
- **[Fitting Room (`product/[id]/tryon/page.tsx`)](file:///home/pkr/Vastrax-Complete-Design/src/app/storefront/product/%5Bid%5D/tryon/page.tsx)**: User photo upload, garment drape processing, pose guidance alerts, and direct bag addition.
- **[Checkout (`checkout/page.tsx`)](file:///home/pkr/Vastrax-Complete-Design/src/app/storefront/checkout/page.tsx)**: Address manager, shipping method selection, promo code discounts, Razorpay / simulated card payment, double-submit protection, and auto-manifesting.
- **[Favorites (`favorites/page.tsx`)](file:///home/pkr/Vastrax-Complete-Design/src/app/storefront/favorites/page.tsx)**: Persistent customer wishlist with optimistic UI updates and instant bag migration.
- **[Account Portal (`account/page.tsx`)](file:///home/pkr/Vastrax-Complete-Design/src/app/storefront/account/page.tsx)**: Order timeline tracker, tracking number lookup, saved addresses, and profile management.

### 🛒 B. State Management & Feedback Utilities (`/src/lib/` & `/src/components/`)
- **[Cart Manager (`src/lib/cart.ts`)](file:///home/pkr/Vastrax-Complete-Design/src/lib/cart.ts)**: Single source of truth managing `vastrax_cart` with atomic methods: `getCart`, `addToCart`, `updateCartQuantity`, `removeFromCart`, `clearCart`, `getCartCount`, `getCartSubtotal`.
- **[Toast Dispatcher (`src/lib/toast.ts`)](file:///home/pkr/Vastrax-Complete-Design/src/lib/toast.ts) & [Toast Component (`src/components/ui/Toast.tsx`)](file:///home/pkr/Vastrax-Complete-Design/src/components/ui/Toast.tsx)**: Global glassmorphic feedback notification system.
- **[API Client (`src/lib/api.ts`)](file:///home/pkr/Vastrax-Complete-Design/src/lib/api.ts)**: Unified typed client routing queries through `/api/v1` with token injection and zero mock data fallbacks.
- **[Backend Status Gate (`src/lib/backendStatus.ts`)](file:///home/pkr/Vastrax-Complete-Design/src/lib/backendStatus.ts)**: Shared pub/sub monitoring backend health.

### 🛡️ C. Admin Management Suite (`/src/app/`)
- **[Dashboard Overview (`src/app/page.tsx`)](file:///home/pkr/Vastrax-Complete-Design/src/app/page.tsx)**: Real-time revenue charts, active order counts, product metrics, and AI business insights.
- **[AI Business Assistant (`src/app/ai-assistant/page.tsx`)](file:///home/pkr/Vastrax-Complete-Design/src/app/ai-assistant/page.tsx)**: Conversational analytics interface for store performance, inventory queries, and catalog assistance.
- **[Orders Console (`src/app/orders/page.tsx`)](file:///home/pkr/Vastrax-Complete-Design/src/app/orders/page.tsx)**: Real-time order fulfillment pipeline (Pending → Confirmed → Packed → Shipped → Delivered / Cancelled).
- **[Products Management (`src/app/products/`)](file:///home/pkr/Vastrax-Complete-Design/src/app/products/page.tsx)**: Product CRUD, image uploads, variant sizing, and Hunyuan 3D asset generation triggers.
- **[Users Directory (`src/app/users/page.tsx`)](file:///home/pkr/Vastrax-Complete-Design/src/app/users/page.tsx)**: User administration, customer verification toggles, and soft-delete archive.

---

## 4. Backend Service Architecture (`/backend/app/`)

### Routes & Services Breakdown
1. **Authentication (`app/services/auth_service.py` & `app/api/routes/auth.py`)**:
   - `POST /auth/register`: Dual email + mobile input. Sends 6-digit verification code to customer's email via Resend.
   - `POST /auth/verify-registration`: Validates OTP code, activates user (`is_active=True`), and issues JWT access token.
   - `POST /auth/login`: Direct login with either email or mobile number + password (no SMS OTP prompt).
2. **Order Lifecycle (`app/services/order_service.py` & `app/api/routes/orders.py`)**:
   - Dynamic variant resolution by ID or `(product_id, size)`.
   - Atomic inventory decrements on order placement.
   - Automatic stock restoration upon order cancellation or payment decline.
   - Dispatches branded HTML confirmation email upon order placement.
3. **Payments & Gateways (`app/services/payment_service.py` & `app/api/routes/payments.py`)**:
   - Razorpay order creation and HMAC-SHA256 signature verification.
   - Webhook processing for `payment.captured` and `payment.failed`.
   - In-app payment simulation fallback for local development.
4. **Logistics & Couriers (`app/services/shiprocket_service.py` & `app/api/routes/shipping.py`)**:
   - Token caching, serviceability estimation, AWB generation, and automated shipment booking on order confirmation.
5. **AI Stylist (`app/services/chat_service.py` & `app/api/routes/chat.py`)**:
   - OpenAI GPT-4o mini conversational agent with persistent database chat sessions, live catalog context injection, and suggested product chips.

---

## 5. Security & Data Integrity

- **Role-Based Access Control**: Strict JWT middleware (`app/middleware/auth.py`). Anonymous access to protected endpoints is rejected.
- **SQL Injection Prevention**: All SQLAlchemy queries and raw SQL statements use parameterized bindings.
- **Path Traversal Protection**: File uploads use randomized UUID naming (`person_{uuid}.jpg`), preventing malicious directory traversal.
- **Payment Verification**: Mandatory server-side cryptographic signature validation on all Razorpay transactions.

---

## 6. Local Accounts & Credentials

| Role | Email | Mobile | Password |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@vastrax.com` | `+919962288111` | `admin123` |
| **Customer** | `customer@vastrax.com` | `+919962288110` | `customer123` |
| **Test Customer** | `testuser_1788272502@vastrax.luxury` | `+919888272502` | `Password123!` |

---

## 7. Execution & Running Commands

```bash
# Frontend (Next.js 16)
npm run dev                 # Runs on http://localhost:3000

# Backend (FastAPI)
cd backend
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8090 --reload

# Public HTTPS Tunnel (Cloudflare)
cloudflared tunnel --url http://localhost:3000
```
