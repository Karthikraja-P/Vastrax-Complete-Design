# VASTRAX E-Commerce & Admin Dashboard

This is a complete Next.js 16 + FastAPI PostgreSQL project integrating a modern, dark-luxury e-commerce storefront and a high-end "cyber-luxury" admin dashboard.

For complete end-to-end architecture documentation, system flow diagrams, and API specifications, see **[APPLICATION_OVERVIEW.md](./APPLICATION_OVERVIEW.md)**.

## Codebase Architecture & Map

- `/src/app/page.tsx` - The main Admin Dashboard overview (Bento grid, charts, metrics).
- `/src/app/ai-assistant/page.tsx` - Admin AI Assistant conversational interface (OpenAI GPT-4o model selector, 3D iridescent loop, store analytics & inventory queries).
- `/src/app/admin/management/page.tsx` - Administrator Management & Security Roles console (Admins/Roles tabs, permission assignment, modals).
- `/src/app/products/` - Admin Products Management.
  - `page.tsx` - All products table with filters, search, thumbnails, delete modal, and pagination.
  - `create/page.tsx` - Create product form with category linkage and variant generation.
  - `add/page.tsx` - Enhanced Add Product wizard with tabbed layout: Basic Info, Pricing & Inventory, Product Images (drag-drop 2D upload with previews/reorder/remove), and **3D Product** (front/side/back photo upload → Hunyuan 3D reconstruction → GLB preview).
  - `edit/page.tsx` - Edit product form with preloaded garment parameters and category assignment.
- `/src/app/categories/` - Product Categories Management (active catalog & deleted trash bin).
- `/src/app/orders/page.tsx` - Orders Management & Live Fulfillment Tracking.
- `/src/app/users/` - Admin User Directory & Deleted Archive.
  - `page.tsx` - All users directory (live metrics, search/filters, create user modal, view profile, verification toggle, soft delete).
  - `deleted/page.tsx` - Deleted users archive (search in trash, restore account, permanent purge).
- `/src/app/settings/page.tsx` - Settings panel (Profile, Security, and App & Storefront Configuration).
- `/src/app/storefront/` - The user-facing e-commerce storefront.
  - `/home/page.tsx` - Storefront landing page.
  - `/collections/page.tsx` - Category/Collections page with dynamic category resolution, strict category filtering, banner carousel, and URL query param synchronization (`?category=`, `?gender=`).
  - `/product/page.tsx` - Dynamic Product Details Page (PDP) handling `?id={productId}`.
  - `/product/[id]/page.tsx` - Automatic dynamic route forwarder mapping `/product/{id}` directly to `/product?id={id}` to prevent 404s.
  - `/product/[id]/tryon/page.tsx` - Dedicated AI Fitting Room & Virtual Try-On page with combo & photo guidelines.
  - `/checkout/page.tsx` - Luxury Multi-step Checkout & Order Confirmation.
  - `/account/page.tsx` - Customer Account Portal (Order timeline tracker, saved addresses, wishlist, profile).
- `/src/app/health/route.ts` - Edge runtime health route handler forwarding to container backend `http://backend:8090/health`.
- `/src/middleware.ts` - Edge route-guard protecting root `/` and admin consoles (`/products`, `/categories`, `/orders`, `/users`, `/admin`, `/settings`, `/ai-assistant`) strictly for `role: admin`; automatically redirects unauthenticated & customer visitors to `/storefront/home`.
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
- `/src/components/auth/` - Storefront authentication modules:
  - `AuthModal.tsx` - Modal supporting dual email+mobile registration, email OTP verification, and direct email/phone login.
  - `IdleTimerProvider.tsx` - Global inactivity/idle timeout listener (30 min inactivity threshold, throttled mouse/keyboard/touch activity detection, and 60-second warning countdown modal with "Stay Logged In" action).
- `/src/components/BackendStatusProvider.tsx` / `ServerDownScreen.tsx` - Global backend-reachability gate: probes the API before rendering any page, shows a full-page fallback (instead of mock/zeroed data) when the backend is unreachable, and auto-recovers.
- `/src/lib/auth-utils.ts` - Centralized authentication sign-out utility coordinating NextAuth `signOut()`, `localStorage.removeItem("vastrax_token")`, and backend `POST /api/v1/auth/logout`.
- `/src/lib/api.ts` - Unified typed API client connecting directly to live FastAPI / PostgreSQL backend REST endpoints (/api/v1) without mock data.
- `/src/lib/cart.ts` - Centralized cart state manager (`getCart`, `addToCart`, `updateCartQuantity`, `removeFromCart`, `clearCart`, `getCartCount`, `getCartSubtotal`) with localStorage persistence and cross-component custom event broadcasting.
- `/src/lib/toast.ts` & `/src/components/ui/Toast.tsx` - Global cyber-luxury Toast notification dispatcher and floating glassmorphic container for instant user feedback.
- `/src/lib/backendStatus.ts` - Shared connectivity pub/sub consumed by `api.ts` and every raw-`fetch` call site (checkout, auth, try-on) to report backend reachability.
- `/backend/` - FastAPI backend application (SQLAlchemy 2.0 + Alembic, SQLite for local dev).
  - `app/core/gpu_queue.py` - In-process asynchronous FIFO GPU queue manager (`gpu_queue`) with queue depth tracking, active job counting, and single-concurrency isolation (`asyncio.Semaphore(1)`) protecting RTX 5070 Ti 16GB VRAM from OOM.
  - `app/api/routes/` - REST endpoints: `auth`, `users`, `products` (including `POST /{id}/notify` waitlist), `categories`, `orders`, `payments`, `shipping`, `tryon` (FIFO GPU queued), `three_d` (FIFO GPU queued), `chat` (`POST /`, `POST /stream`, `GET /history`, `DELETE /history`), `analytics`, `settings`, `otp`, `health`.
  - `app/models/` - SQLAlchemy models (`User`, `Product`, `Order`, `Payment`, `ChatMessage`, `SupportTicket`, `TryonSession`, `StockNotification`, etc.).
  - `app/services/` - Business logic services (Razorpay, Fashn VTON, Shiprocket, OpenAI GPT-4o mini Stylist with `chat_tools` function calling & authorization boundary, Resend email notifications, OrderService with thread-safe inventory locking `_inventory_lock` preventing overselling, StockNotificationService with throttled background batch email queue, and PaymentService).
  - `app/middleware/auth.py` - JWT auth (`get_current_user`, `require_admin`) — no anonymous/admin fallback; missing or invalid credentials are always rejected.
- `/virtual-try-on/` - Standalone Virtual Try-On sub-system (FASHN VTON 1.5 engine + Fitting Room UI).
  - `backend/` - Dedicated VTON FastAPI service with GPU inference execution.
  - `frontend/` - Standalone luxury boutique UI and modal fitting room.
  - `docker-compose.yml` - Container orchestration for standalone try-on.
- `/3d-model/` - 3D Garment Generation & Interactive 3D Product Display Pipeline.
  - `server_3d.py` - Dedicated FastAPI 3D Garment Generator service on port 8081 (mirroring FASHN AI on 8001), managed by backend `gpu_queue` to ensure zero VRAM collision.
  - `Hunyuan3D-2.1/` - Neural 3D shape reconstruction, texturing, and remeshing engine.
  - `Hunyuan3D-2.1/hy3dshape/` - 3D Shape reconstruction, remeshing, decimation, and base meshes.
  - `Hunyuan3D-2.1/hy3dshape/web_test/` - Interactive boutique 3D web viewer with `.glb` assets (`garment_perfect.glb`, `textured_garment.glb`, etc.).
  - `Hunyuan3D-2.1/hy3dpaint/` - AI texture painting pipeline, custom rasterizer, and UV mappers.
  - `Hunyuan3D-2.1/api_server.py` - FastAPI 3D generation & texture synthesis server.

## Quick Start: Local PC Instant Docker Deployment

Launch the entire stack with a single command:
```bash
./start-docker.sh
# or manually:
docker compose up --build -d
```

- **Storefront**: [http://localhost:3000/storefront/home](http://localhost:3000/storefront/home)
- **Admin Dashboard**: [http://localhost:3000/](http://localhost:3000/)
- **Backend API & Health**: [http://localhost:8090/health](http://localhost:8090/health)
- **Data Persistence**: Host directory `./backend/vastrax.db` and `./backend/user_uploads` are mapped directly to preserve all products, media, and orders.

## Production Ready Status

- [x] Next.js 16 (Turbopack) production build passing with 0 errors across all 18 routes.
- [x] Full customer shopping journey complete: Home -> Collections -> PDP with VTON -> Shopping Bag with Promo Codes -> Checkout -> Client Portal.
- [x] Checkout collects real payment via Razorpay Checkout.js (falls back to an in-page simulated gateway when no live Razorpay credentials are configured), with server-side signature verification and a webhook as the durable fallback.
- [x] Out-of-Stock & "Notify Later" System: Storefront product details and catalog cards automatically detect zero stock, disable "Buy Now" and "Add to Cart", display "Sold Out" badges, and present a luxury "Notify Me When Available" waitlist form connected to `POST /products/{id}/notify`. Automated restock emails are dispatched to subscribers via Resend when inventory is replenished.

- [x] Personal AI Stylist Concierge integrated across all storefront views.
- [x] Admin dashboard and CRUD modules (Products, Categories, Orders, App Settings) wired to backend API client.
- [x] Admin usage analytics (`GET /analytics/usage`) and per-user try-on/AI-chat counters on the Users page.
- [x] Security hardening pass: removed an unauthenticated-admin-fallback bug and an inverted `require_admin` check in the JWT middleware, closed a password-reset-token leak, fixed a path-traversal/SSRF hole in garment image resolution, made the payment webhook always verify its signature, and added authorization checks to the shipping endpoints.
- [x] Global "server down" fallback: the app no longer renders mock/zeroed data when the backend is unreachable — it shows a dedicated reconnect screen and recovers automatically.
- [x] Logistics & shipping endpoints exposed (`/shipping/serviceability`, `/shipping/manifest`, `/shipping/track/{awb}`).
- [x] Live Shiprocket Logistics Integration: Configured boutique merchant credentials (`vastrax.shop@gmail.com`) and primary dispatch warehouse hub (`PICKUP_PINCODE: 625706`) across [`backend/.env`](file:///home/pkr/Vastrax-Complete-Design/backend/.env), [`backend/app/core/config.py`](file:///home/pkr/Vastrax-Complete-Design/backend/app/core/config.py), [`backend/app/services/shiprocket_service.py`](file:///home/pkr/Vastrax-Complete-Design/backend/app/services/shiprocket_service.py), and [`docker-compose.yml`](file:///home/pkr/Vastrax-Complete-Design/docker-compose.yml). Live courier serviceability, rates (Delhivery, Blue Dart, Xpressbees), shipment creation, and tracking endpoints are active.
- [x] File and asset upload pickers added across Admin Products, Categories, and Users modals.
- [x] Storefront header dead links fixed, wired to dynamic catalog category filters, and fully optimized for responsive mobile layout (eliminating icon/logo overlap).
- [x] Admin header search and profile settings navigation wired.
- [x] Dashboard sidebar direct navigation, overview KPI card links, settings tabs, and storefront interactive buttons wired.
- [x] Production AI Support & Stylist agent with OpenAI tool calling, security authorization guards, order tracking, cancellation, and human escalation.
- [x] Customer Reviews & Dynamic Rating Engine: Created ProductReview model & database schema (`product_reviews`), REST endpoints (`POST /products/{id}/reviews`, `GET /products/{id}/reviews`), automatic dynamic rating average recalculation (`rating_average` & `rating_count`), and storefront PDP Reviews tab with interactive 5-star submission form & verified customer review cards.
- [x] Multi-Department Garment Classification System: Added `gender` attribute (`Women`, `Men`, `Kids`, `Unisex`) across backend database models, Pydantic schemas, REST endpoints, Admin Product Create/Edit/Add forms, Admin Product Table filters, and Storefront header navigation & collection filtering (`/storefront/collections?gender=Women|Men|Kids`).
- [x] Garment Size Chart System: Added JSON `size_chart` field across backend database models, Pydantic schemas, Admin Product Creation & Editing forms (Preset Category Templates for Tops, Dresses, Pants, Shoes), interactive Size Guide link prompt ("Not sure about fit? Look into Size Chart") next to size selection on PDP, and dedicated Size Chart measurement grid with Inches / CM unit toggle right after product display.
- [x] Unified AI Stylist Branding: Standardized all chat drawer triggers, drawer headers, bot responses, and system descriptions to **AI Stylist** (removing legacy mixed "Stylist Concierge" references).
- [x] Enhanced AI Stylist System Prompt & Webpage Card Availability: Upgraded concierge prompt with strict catalog inventory grounding (never suggests non-existent garments), multi-department awareness (Men, Women, Kids), size chart & measurement guidance, proactive cross-selling/pairing with cart items, and seamless Virtual Try-On call-to-actions. All recommendations are tagged with `[PRODUCT:id]` and backed by backend catalog fuzzy matching, ensuring every suggested product appears directly on the webpage as an interactive luxury card with image, price, Favorite, Add to Bag, and 1-click Try-On.
- [x] Option 2 AI Stylist Prompt & Store Updates Optimization: Refined core styling prompt directives in [`backend/app/services/chat_service.py`](file:///home/pkr/Vastrax-Complete-Design/backend/app/services/chat_service.py), [`backend/app/api/routes/settings.py`](file:///home/pkr/Vastrax-Complete-Design/backend/app/api/routes/settings.py), and [`src/app/settings/page.tsx`](file:///home/pkr/Vastrax-Complete-Design/src/app/settings/page.tsx) for maximum token efficiency. Directives cover live catalog grounding, atelier size chart standards (XS-XXL measurements in inches & cm), 1-click AI Fitting Room Try-On CTAs, active promotion codes (`VASTRAX10`, `VIP20`, `FREESHIP`), and activity-aware `[CHIPS:...]` quick replies.
- [x] Multi-Occasion Carousel & Dynamic Stylist Suggestions: Integrated an expanded 6-occasion suggestion carousel (`"Wedding / Festive"`, `"Office Wear"`, `"Casual / Everyday"`, `"Trending Looks"`, `"Party / Night Out"`, `"Resort / Vacation"`) and 4 high-fashion prompt pills (`"Curate an office capsule look"`, `"Wedding guest outfit ideas"`, `"Trending pieces this week"`, `"Relaxed weekend casual styling"`). Backend profile extraction and mock intelligence handlers map each occasion directly to catalog products with live `[PRODUCT:id]` card generation, with 404-free navigation to `/storefront/product?id=...`.
- [x] Universal AI Stylist Trigger & Drawer State Management: Fixed broken AI Stylist launcher on Collections, Favorites, and Account pages by adding internal self-managing open state and direct window event listeners to [`StylistDrawer.tsx`](file:///home/pkr/Vastrax-Complete-Design/src/components/stylist/StylistDrawer.tsx), plus synchronized `open-stylist` event listeners on [`collections/page.tsx`](file:///home/pkr/Vastrax-Complete-Design/src/app/storefront/collections/page.tsx), [`favorites/page.tsx`](file:///home/pkr/Vastrax-Complete-Design/src/app/storefront/favorites/page.tsx), and [`account/page.tsx`](file:///home/pkr/Vastrax-Complete-Design/src/app/storefront/account/page.tsx).
- [x] Customer-First AI Stylist Dialogue & Inspiration Drawer: Transformed initial chat flow in [`StylistDrawer.tsx`](file:///home/pkr/Vastrax-Complete-Design/src/components/stylist/StylistDrawer.tsx) from bot-scripted buttons into a humanized real-time conversation. Initial view features an elegant warm welcome watermark (*"Meet Vastra, Your AI Stylist"*) with auto-focused input prompt. Quick styling prompts are neatly organized in an expandable `✨ Need inspiration?` accordion, allowing the customer to initiate the dialogue naturally before tailored options, product cards, and suggestion chips appear.
- [x] Enhanced Terms of Service Document: Updated [`/storefront/terms`](file:///home/pkr/Vastrax-Complete-Design/src/app/storefront/terms/page.tsx) with comprehensive clauses for VASTRAX AI Stylist, Virtual Try-On / AI Fitting Room disclaimers, Size Chart guidance, OTP authentication, and customer reviews.
- [x] Real CUDA GPU Neural Virtual Try-On Execution: Integrated FastAPI host worker (`/home/pkr/fashn-tryon/server.py`) running FASHN VTON 1.5 directly on host CUDA GPU (NVIDIA RTX 5070 Ti, 16GB VRAM) on port `8001`. Uploaded user portraits and garment product images undergo real diffusion draping inference (~12s) and return seamless `/results/result_gpu_xxx.png` rendered outputs directly to the storefront fitting room.
- [x] Next.js Route Guard Middleware protecting admin consoles exclusively for `role: admin`, with automatic customer redirection to `/storefront/home`.

## Known Gaps / Pending Work
1. **Cart → order variant mapping**: the storefront cart sends a hardcoded `variant_id: "var_dummy"` for every line item regardless of which product/size was actually added, instead of tracking the real `ProductVariant.id` per cart entry. Works today only because a matching dummy variant exists in seed data; needs a real fix before multiple distinct products can be ordered correctly.
2. **Auth surface duplication**: `AuthModal`, `checkout/page.tsx`, and NextAuth's `authorize()` each independently hardcode a list of candidate backend ports (`8090`/`8088`/`8000`) instead of sharing one source of truth; `fetchApi` separately defaults to `8090`. Should be consolidated behind a single `NEXT_PUBLIC_API_URL`.
3. **OAuth2 social sign-in** (Google/Apple) is wired into NextAuth's config but not exercised end-to-end against the backend.
4. **AI Stylist chat streaming** (SSE/WebSocket) — current `/chat` endpoint is request/response only.
5. **Discount/coupon validation** (`promosApi.validate` in `src/lib/api.ts`) is pure client-side logic against a hardcoded code list (`VASTRAX10` 10%, `VIP20` 20%, `FREESHIP`) — never touches the backend. Confirmed working in browser tests.

## Verified Behaviors (browser-tested on vastrax.ai)
- [x] **Virtual Try-On auth gate**: Clicking "Virtual Try-On" without login shows sign-in modal. Direct URL access to `/product/{id}/tryon` redirects to product page with auth modal auto-opened (`requireAuth=1`).
- [x] **Add to Cart auth gate**: Clicking "Add to Cart" without login shows sign-in modal; resumes cart action after login.
- [x] **Buy Now auth gate**: Clicking "Buy Now" without login shows sign-in modal; proceeds to checkout after login.
- [x] **Favorites auth gate**: Clicking the heart/wishlist button without login shows sign-in modal.
- [x] **Promo codes**: `VASTRAX10` (10%), `VIP20` (20%), `FREESHIP` (free ship), invalid codes all respond correctly in cart drawer.
- [x] **Header buttons**: All links wired and functional.
- [x] **Theme toggle**: Defaults to system preference (light ☀️ / dark 🌙), switches correctly on click.
- [x] **AI Stylist chatbot**: Functional without login (anonymous session via localStorage `session_id`); full OpenAI/Anthropic response when API keys configured.
- [x] **Virtual Try-On Garment Resolution & Inference**: Validated all catalog garment images with high-resolution Unsplash assets, added download status/Content-Type/magic-byte checks in `file_utils.py`, fixed fallback copying behavior in `fashn_service.py`, and aligned dress categories to FASHN `one-pieces` in `tryon/page.tsx`.

