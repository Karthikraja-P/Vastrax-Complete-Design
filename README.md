# VASTRAX E-Commerce & Admin Dashboard

This is a complete Next.js 16 + FastAPI PostgreSQL project integrating a modern, dark-luxury e-commerce storefront and a high-end "cyber-luxury" admin dashboard.

## Codebase Architecture & Map

- `/src/app/page.tsx` - The main Admin Dashboard overview (Bento grid, charts, metrics).
- `/src/app/ai-assistant/page.tsx` - Admin AI Assistant conversational interface (OpenAI GPT-4o model selector, 3D iridescent loop, store analytics & inventory queries).
- `/src/app/admin/management/page.tsx` - Administrator Management & Security Roles console (Admins/Roles tabs, permission assignment, modals).
- `/src/app/products/` - Admin Products Management.
  - `page.tsx` - All products table with filters, search, thumbnails, delete modal, and pagination.
  - `create/page.tsx` - Create product form with category linkage and variant generation.
  - `add/page.tsx` - Enhanced Add Product wizard with tabbed layout: Basic Info, Pricing & Inventory, Product Images (drag-drop 2D upload with previews/reorder/remove), Virtual Try-On, AI Video, and **3D Product** (front/side/back photo upload → Hunyuan 3D reconstruction → GLB preview).
  - `edit/page.tsx` - Edit product form with preloaded garment parameters and category assignment.
- `/src/app/categories/` - Product Categories Management (active catalog & deleted trash bin).
- `/src/app/orders/page.tsx` - Orders Management & Live Fulfillment Tracking.
- `/src/app/users/` - Admin User Directory & Deleted Archive.
  - `page.tsx` - All users directory (live metrics, search/filters, create user modal, view profile, verification toggle, soft delete).
  - `deleted/page.tsx` - Deleted users archive (search in trash, restore account, permanent purge).
- `/src/app/settings/page.tsx` - Settings panel (Profile, Security, and App & Storefront Configuration).
- `/src/app/storefront/` - The user-facing e-commerce storefront.
  - `/home/page.tsx` - Storefront landing page.
  - `/collections/page.tsx` - Category/Collections page with filters and banner carousel.
  - `/product/[id]/tryon/page.tsx` - Dedicated AI Fitting Room & Virtual Try-On page with combo & photo guidelines.
  - `/checkout/page.tsx` - Luxury Multi-step Checkout & Order Confirmation.
  - `/account/page.tsx` - Customer Account Portal (Order timeline tracker, saved addresses, wishlist, profile).
- `/src/components/layout/` - Global layout wrappers.
  - `Header.tsx` - Top navigation bar (storefront/dashboard routing, theme toggle, interactive notifications drawer, customer account link).
  - `Sidebar.tsx` - Collapsible admin sidebar.
  - `MainLayout.tsx` - Layout wrapper managing the sidebar state and grid layout.
  - `CartDrawer.tsx` - Glassmorphic slide-over shopping bag drawer with promo validation and live checkout link.
- `/src/components/stylist/` - AI Haute Couture Stylist.
  - `StylistDrawer.tsx` - Conversational concierge powered by OpenAI GPT-4o mini with persistent database chat history, interactive chips, active promotions, and instant virtual try-on routing.
- `/src/components/3d/` - Interactive 3D Garment Visualization.
  - `GarmentViewer3D.tsx` - PBR WebGL 3D model viewer with 360° rotation, zoom, lighting presets, and theme controls.
  - `Product3DModal.tsx` - Quick-preview 3D modal integrated across catalog cards and product pages.
- `/src/components/products/` - Product management and interactive modules.
  - `ProductTable.tsx` - Products listing wired to `productsApi`.
- `/src/components/admin/` - Admin specific components (`NotchedCard.tsx` with interactive `<Bell />` threshold alerts and `<Sparkles />` AI insights popovers).
- `/src/components/auth/` - Storefront authentication modals (`AuthModal.tsx` supporting dual email+mobile registration, email OTP verification, and direct email/phone login).
- `/src/components/BackendStatusProvider.tsx` / `ServerDownScreen.tsx` - Global backend-reachability gate: probes the API before rendering any page, shows a full-page fallback (instead of mock/zeroed data) when the backend is unreachable, and auto-recovers.
- `/src/lib/api.ts` - Unified typed API client connecting directly to live FastAPI / PostgreSQL backend REST endpoints (/api/v1) without mock data.
- `/src/lib/cart.ts` - Centralized cart state manager (`getCart`, `addToCart`, `updateCartQuantity`, `removeFromCart`, `clearCart`, `getCartCount`, `getCartSubtotal`) with localStorage persistence and cross-component custom event broadcasting.
- `/src/lib/toast.ts` & `/src/components/ui/Toast.tsx` - Global cyber-luxury Toast notification dispatcher and floating glassmorphic container for instant user feedback.
- `/src/lib/backendStatus.ts` - Shared connectivity pub/sub consumed by `api.ts` and every raw-`fetch` call site (checkout, auth, try-on) to report backend reachability.
- `/backend/` - FastAPI backend application (SQLAlchemy 2.0 + Alembic, SQLite for local dev).
  - `app/main.py` - FastAPI entrypoint.
  - `app/api/routes/` - REST endpoints: `auth`, `users`, `products`, `categories`, `orders`, `payments`, `shipping`, `tryon`, `chat` (`POST /`, `GET /history`, `DELETE /history`), `analytics`, `settings`, `otp`, `health`.
  - `app/models/` - SQLAlchemy models (`User`, `Product`, `Order`, `Payment`, `ChatMessage`, `TryonSession`, etc.).
  - `app/services/` - Business logic services (Razorpay, Fashn VTON, Shiprocket, OpenAI GPT-4o mini Stylist, Resend email notifications, OrderService with variant resolution, stock decrements/restorations, and PaymentService).
  - `app/middleware/auth.py` - JWT auth (`get_current_user`, `require_admin`) — no anonymous/admin fallback; missing or invalid credentials are always rejected.
- `/virtual-try-on/` - Standalone Virtual Try-On sub-system (FASHN VTON 1.5 engine + Fitting Room UI).
  - `backend/` - Dedicated VTON FastAPI service with GPU inference execution.
  - `frontend/` - Standalone luxury boutique UI and modal fitting room.
  - `docker-compose.yml` - Container orchestration for standalone try-on.
- `/3d-model/Hunyuan3D-2.1/` - 3D Garment Generation & Interactive 3D Product Display Pipeline.
  - `hy3dshape/` - 3D Shape reconstruction, remeshing, decimation, and base meshes.
  - `hy3dshape/web_test/` - Interactive boutique 3D web viewer with `.glb` assets (`garment_perfect.glb`, `textured_garment.glb`, etc.).
  - `hy3dpaint/` - AI texture painting pipeline, custom rasterizer, and UV mappers.
  - `api_server.py` - FastAPI 3D generation & texture synthesis server.
  - `.venv/` - PyTorch + CUDA environment for 3D model inference.

## Production Ready Status
- [x] Next.js 16 (Turbopack) production build passing with 0 errors across all 18 routes.
- [x] Full customer shopping journey complete: Home -> Collections -> PDP with VTON -> Shopping Bag with Promo Codes -> Checkout -> Client Portal.
- [x] Checkout collects real payment via Razorpay Checkout.js (falls back to an in-page simulated gateway when no live Razorpay credentials are configured), with server-side signature verification and a webhook as the durable fallback.
- [x] Personal AI Stylist Concierge integrated across all storefront views.
- [x] Admin dashboard and CRUD modules (Products, Categories, Orders, App Settings) wired to backend API client.
- [x] Admin usage analytics (`GET /analytics/usage`) and per-user try-on/AI-chat counters on the Users page.
- [x] Security hardening pass: removed an unauthenticated-admin-fallback bug and an inverted `require_admin` check in the JWT middleware, closed a password-reset-token leak, fixed a path-traversal/SSRF hole in garment image resolution, made the payment webhook always verify its signature, and added authorization checks to the shipping endpoints.
- [x] Global "server down" fallback: the app no longer renders mock/zeroed data when the backend is unreachable — it shows a dedicated reconnect screen and recovers automatically.

## Known Gaps / Pending Work
1. **Cart → order variant mapping**: the storefront cart sends a hardcoded `variant_id: "var_dummy"` for every line item regardless of which product/size was actually added, instead of tracking the real `ProductVariant.id` per cart entry. Works today only because a matching dummy variant exists in seed data; needs a real fix before multiple distinct products can be ordered correctly.
2. **Auth surface duplication**: `AuthModal`, `checkout/page.tsx`, and NextAuth's `authorize()` each independently hardcode a list of candidate backend ports (`8090`/`8088`/`8000`) instead of sharing one source of truth; `fetchApi` separately defaults to `8090`. Should be consolidated behind a single `NEXT_PUBLIC_API_URL`.
3. **OAuth2 social sign-in** (Google/Apple) is wired into NextAuth's config but not exercised end-to-end against the backend.
4. **Shiprocket live tracking** (`GET /shipping/track/{tracking_number}`) and **courier serviceability pre-check** are not yet exposed as dedicated endpoints.
5. **AI Stylist chat streaming** (SSE/WebSocket) — current `/chat` endpoint is request/response only.
6. **Discount/coupon validation** (`promosApi.validate` in `src/lib/api.ts`) is pure client-side logic against a hardcoded code list — never touches the backend.
