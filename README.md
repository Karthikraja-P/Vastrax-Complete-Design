# VASTRAX E-Commerce & Admin Dashboard

This is a complete Next.js 16 + FastAPI PostgreSQL project integrating a modern, dark-luxury e-commerce storefront and a high-end "cyber-luxury" admin dashboard.

## Codebase Architecture & Map

- `/src/app/page.tsx` - The main Admin Dashboard overview (Bento grid, charts, metrics).
- `/src/app/products/` - Admin Products Management (List, Add, Create, Edit).
- `/src/app/categories/` - Admin Categories Management & Deleted Archive.
- `/src/app/orders/` - Admin Orders Tracking & Table.
- `/src/app/users/` - Admin User Directory & Deleted Archive.
- `/src/app/settings/page.tsx` - Settings panel (Profile, Security, and App & Storefront Configuration).
- `/src/app/storefront/` - The user-facing e-commerce storefront.
  - `/home/page.tsx` - Storefront landing page.
  - `/collections/page.tsx` - Category/Collections page with filters and banner carousel.
  - `/product/page.tsx` - Product Details Page (PDP) with Virtual Try-On.
  - `/checkout/page.tsx` - Luxury Multi-step Checkout & Order Confirmation.
  - `/account/page.tsx` - Customer Account Portal (Order timeline tracker, saved addresses, wishlist, profile).
- `/src/components/layout/` - Global layout wrappers.
  - `Header.tsx` - Top navigation bar (storefront/dashboard routing, theme toggle, customer account link).
  - `Sidebar.tsx` - Collapsible admin sidebar.
  - `MainLayout.tsx` - Layout wrapper managing the sidebar state and grid layout.
  - `CartDrawer.tsx` - Glassmorphic slide-over shopping bag drawer with promo validation and live checkout link.
- `/src/components/stylist/` - AI Haute Couture Stylist.
  - `StylistDrawer.tsx` - Conversational concierge powered by Claude chat endpoint with outfit recommendations & instant try-on.
- `/src/components/products/` - Product management and interactive modules.
  - `ProductTable.tsx` - Products listing wired to `productsApi`.
  - `VirtualTryOnModal.tsx` - AI Virtual Try-on dialog wired to `tryonApi.submit`.
- `/src/components/admin/` - Admin specific components (`NotchedCard.tsx`).
- `/src/components/auth/` - Storefront authentication modals (`AuthModal.tsx`).
- `/src/lib/api.ts` - Unified typed API client with offline graceful fallback for all frontend components.
- `/backend/` - FastAPI backend application (PostgreSQL + SQLAlchemy 2.0 + Alembic).
  - `app/main.py` - FastAPI entrypoint.
  - `app/api/routes/` - REST endpoints: `auth`, `products`, `categories`, `orders`, `payments`, `shipping`, `tryon`, `chat`, `analytics`, `settings`.
  - `app/models/` - SQLAlchemy models.
  - `app/services/` - Business logic services (PhonePe, Fashn VTON, Shiprocket, Anthropic Stylist).
- `BACKEND_API_SPECIFICATION.md` - Complete backend REST/Server Action endpoints specification, ER diagrams, data models, and suggested stack.

## Production Ready Status
- [x] Next.js 16 (Turbopack) production build passing with 0 errors across all 18 routes.
- [x] Full customer shopping journey complete: Home -> Collections -> PDP with VTON -> Shopping Bag with Promo Codes -> Checkout -> Client Portal.
- [x] Personal AI Stylist Concierge integrated across all storefront views.
- [x] Admin dashboard and CRUD modules (Products, Categories, Orders, App Settings) wired to backend API client.

## Pending APIs to Build / Expand
1. **User Authentication & Session Management (`/api/v1/auth`)**:
   - [ ] Implement JWT refresh token rotation endpoint (`POST /auth/refresh`).
   - [ ] Add OAuth2 social sign-in endpoints (Google, Apple).
   - [ ] Storefront Customer profile update & address book endpoint (`GET/PUT /users/me/addresses`).
2. **Payment Webhook Verification (`/api/v1/payments`)**:
   - [ ] Implement PhonePe/Stripe server-to-server webhook handler (`POST /payments/webhook`) for async order confirmation.
   - [ ] Refund initiation & reconciliation endpoint (`POST /payments/refund`).
3. **Shipping & Courier Live Tracking (`/api/v1/shipping`)**:
   - [ ] Live Shiprocket tracking endpoint (`GET /shipping/track/{tracking_number}`).
   - [ ] Courier serviceability & estimated delivery date check (`POST /shipping/check-serviceability`).
4. **Virtual Try-On Asynchronous Polling (`/api/v1/tryon`)**:
   - [ ] Background job status polling endpoint (`GET /tryon/jobs/{job_id}`) for heavy GPU workloads.
   - [ ] User Try-on history and save-to-closet endpoint (`GET /tryon/history`).
5. **AI Fashion Stylist Chat Stream (`/api/v1/chat`)**:
   - [ ] WebSocket / SSE streaming endpoint (`GET /chat/stream`) for low-latency conversational styling with Anthropic Claude.
6. **Discounts & Coupon Validator (`/api/v1/promos`)**:
   - [ ] Discount coupon validation endpoint (`POST /promos/validate`).

### `User` (Admin & Customers)
*Tracks administrators and storefront customers.*
- `id`: UUID (Primary Key)
- `email`: String (Unique)
- `name`: String
- `role`: Enum (`ADMIN`, `CUSTOMER`)
- `avatarUrl`: String (Optional)
- `createdAt`: DateTime

### `Product`
*Stores items available in the storefront.*
- `id`: UUID (Primary Key)
- `title`: String
- `description`: Text
- `price`: Float
- `compareAtPrice`: Float (Optional, for discounts)
- `inventoryCount`: Int
- `status`: Enum (`ACTIVE`, `DRAFT`, `DELETED`)
- `categoryId`: UUID (Foreign Key)
- `images`: Array of Strings (URLs)
- `createdAt`: DateTime

### `Category` / `Collection`
*Organizes products (e.g., Men, Women, Accessories).*
- `id`: UUID (Primary Key)
- `name`: String
- `slug`: String (Unique, e.g., `mens-collection`)
- `description`: Text (Optional)
- `imageUrl`: String (Optional)

### `Order`
*Tracks customer purchases, used heavily in the dashboard.*
- `id`: UUID (Primary Key)
- `orderNumber`: String (Unique, e.g., `#ORD-2026-1030`)
- `customerId`: UUID (Foreign Key)
- `totalAmount`: Float
- `status`: Enum (`PENDING`, `PROCESSING`, `CONFIRMED`, `SHIPPED`, `DELIVERED`, `REFUNDED`)
- `createdAt`: DateTime

### `OrderItem`
*Line items inside an order.*
- `id`: UUID (Primary Key)
- `orderId`: UUID (Foreign Key)
- `productId`: UUID (Foreign Key)
- `quantity`: Int
- `priceAtPurchase`: Float

### `Campaign` (Marketing)
*Drives the "Active Campaign" dashboard metrics.*
- `id`: UUID (Primary Key)
- `name`: String
- `channel`: Enum (`EMAIL`, `SOCIAL`, `SEARCH`)
- `status`: Enum (`ACTIVE`, `PAUSED`, `COMPLETED`)
- `budget`: Float
- `createdAt`: DateTime

## 2. Required API Endpoints / Server Actions

### Storefront APIs
- `GET /api/products` - Fetch all active products (supports filtering by category/collection).
- `GET /api/products/:slug` - Fetch single product details.
- `GET /api/collections` - Fetch all categories/collections for the header navigation.

### Admin Dashboard APIs
- **Metrics Aggregation:**
  - `GET /api/admin/metrics/revenue` - Returns total revenue, avg order value, and % change compared to last month.
  - `GET /api/admin/metrics/customers` - Returns total customers and growth %.
  - `GET /api/admin/metrics/sales` - Returns total sales (weekly) and daily breakdown for the bar chart.
  - `GET /api/admin/metrics/conversion` - Returns the store conversion rate.
- **Data Tables:**
  - `GET /api/admin/orders/recent` - Returns the top 4 latest transactions (for Row 3).
  - `GET /api/admin/orders` - Returns paginated list of all orders (for Row 4).
  - `GET /api/admin/campaigns/active` - Returns active campaign count and channel mix distribution.
- **Geospatial (Optional for V1):**
  - `GET /api/admin/sales-by-region` - Aggregates orders by country/region to plot on the world map.

## 3. Tech Stack Recommendations
When we build this, we should consider:
- **Database:** PostgreSQL (Vercel Postgres or Supabase).
- **ORM:** Prisma or Drizzle for type-safe database queries.
- **Architecture:** Next.js Server Actions (allows us to fetch data directly in our Server Components without needing to build traditional REST API routes).
