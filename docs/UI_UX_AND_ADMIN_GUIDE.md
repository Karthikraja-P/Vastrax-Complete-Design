# VASTRAX — Complete Webpage Flow, Screen Architecture & Admin Guide

This document provides a screen-by-screen walkthrough of the entire VASTRAX platform, covering every storefront customer journey, interactive 3D/AI module, and the complete admin management suite with all options, buttons, and behavioral descriptions.

---

## Table of Contents
1. [Platform Navigation & Global Components](#1-platform-navigation--global-components)
2. [Customer Storefront Screens (E-Commerce Journey)](#2-customer-storefront-screens-e-commerce-journey)
   - [2.1 Storefront Landing Page (`/storefront/home`)](#21-storefront-landing-page-storefronthome)
   - [2.2 Collections & Catalog Page (`/storefront/collections`)](#22-collections--catalog-page-storefrontcollections)
   - [2.3 Product Details Page (PDP) (`/storefront/product`)](#23-product-details-page-pdp-storefrontproduct)
   - [2.4 Interactive 3D Garment Modal & Viewer](#24-interactive-3d-garment-modal--viewer)
   - [2.5 AI Virtual Try-On Fitting Room (`/storefront/product/[id]/tryon`)](#25-ai-virtual-try-on-fitting-room-storefrontproductidtryon)
   - [2.6 AI Stylist Concierge Drawer (`StylistDrawer.tsx`)](#26-ai-stylist-concierge-drawer-stylistdrawertsx)
   - [2.7 Slide-Over Shopping Bag Drawer (`CartDrawer.tsx`)](#27-slide-over-shopping-bag-drawer-cartdrawertsx)
   - [2.8 Multi-Step Checkout & Payment Screen (`/storefront/checkout`)](#28-multi-step-checkout--payment-screen-storefrontcheckout)
   - [2.9 Customer Account & Order Tracker Portal (`/storefront/account`)](#29-customer-account--order-tracker-portal-storefrontaccount)
   - [2.10 Customer Favorites / Wishlist Page (`/storefront/favorites`)](#210-customer-favorites--wishlist-page-storefrontfavorites)
   - [2.11 Customer Auth Modal (`AuthModal.tsx`)](#211-customer-auth-modal-authmodaltsx)
3. [Admin Management Suite (Operations & Control)](#3-admin-management-suite-operations--control)
   - [3.1 Admin Dashboard Overview (`/`)](#31-admin-dashboard-overview-)
   - [3.2 AI Executive Assistant Console (`/ai-assistant`)](#32-ai-executive-assistant-console-ai-assistant)
   - [3.3 Products Management Directory (`/products`)](#33-products-management-directory-products)
   - [3.4 Enhanced Add Product Wizard (`/products/add`)](#34-enhanced-add-product-wizard-productsadd)
   - [3.5 Product Categories & Trash Bin (`/categories`)](#35-product-categories--trash-bin-categories)
   - [3.6 Live Orders & Fulfillment Pipeline (`/orders`)](#36-live-orders--fulfillment-pipeline-orders)
   - [3.7 User Directory & Deleted Archive (`/users`)](#37-user-directory--deleted-archive-users)
   - [3.8 Administrator Security & RBAC Roles (`/admin/management`)](#38-administrator-security--rbac-roles-adminmanagement)
   - [3.9 System Settings & Storefront Configuration (`/settings`)](#39-system-settings--storefront-configuration-settings)

---

## 1. Platform Navigation & Global Components

### A. Storefront Header Bar (Sticky Top)
- **Brand Logo (`VASTRAX`)**: Click to return to Storefront Home (`/storefront/home`).
- **Navigation Links**: Direct routes to `Collections`, `Dresses`, `Pants`, `Tops`, and `Fitting Room`.
- **Search Bar**: Real-time product search with keyword auto-suggestions.
- **Theme Toggle**: Switch between Obsidian Dark Mode (`#0B0F19`) and Silk Light Mode (`#FFFFFF`).
- **Wishlist Button (`<Heart />`)**: Opens `/storefront/favorites` displaying saved items.
- **AI Stylist Launcher Button**: Floating badge button that summons the AI Stylist Concierge drawer from any screen.
- **Shopping Bag Button (`<ShoppingBag />`)**: Shows dynamic live item count badge (e.g., `2`). Clicking slides out the `CartDrawer`.
- **Customer Account / Sign In**:
  - Unauthenticated: Launches the dual Email + Mobile authentication modal.
  - Authenticated: Displays customer avatar dropdown with links to `My Orders`, `Saved Addresses`, `Profile Settings`, and `Sign Out`.

### B. Global Cyber-Luxury Toast System
- Floats at the bottom-right corner of the screen.
- Displays animated glassmorphic cards with garment thumbnails when items are added to cart, removed, favorited, or when promo codes are applied.

---

## 2. Customer Storefront Screens (E-Commerce Journey)

```
[Storefront Home] ──> [Collections Catalog] ──> [Product Details (PDP)] ──> [Shopping Bag Drawer]
         │                     │                              │                        │
         ├──> [AI Stylist]     ├──> [3D Viewer Modal]         ├──> [Virtual Try-On]    └──> [Checkout]
         └──> [Favorites]      └──> [Quick Size Add]          └──> [Direct Buy Now]             │
                                                                                        [Confirmation]
```

### 2.1 Storefront Landing Page (`/storefront/home`)
- **Hero Video & Lookbook Banner**: High-fashion cinematic presentation featuring seasonal couture drops.
  - *Call-to-Action*: `"Explore Runway Collection"` (Routes directly to `/storefront/collections`).
- **Curated Category Grid**: Visual tiles for *Dresses, Outerwear, Pants, Tops, Tailored Denims, and Evening Wear*.
- **Trending Runway Picks**: Horizontal interactive carousel showcasing live catalog items with price, rating, and quick hover actions.
- **3D Feature Highlight Banner**: Interactive teaser promoting 360° garment exploration and AI Virtual Try-On.
- **Footer**: Brand manifesto, newsletter subscription with instant validation, compliance badges, and currency selector.

---

### 2.2 Collections & Catalog Page (`/storefront/collections`)
- **Filter Sidebar & Mobile Drawer**:
  - *Category Selector*: Filter by Dresses, Jackets, Hoodies, Pants, Tops, etc.
  - *Price Range Slider*: Real-time budget filter with minimum and maximum bounds.
  - *Size Pills*: Filter catalog by available sizing (`S`, `M`, `L`, `XL`, `XXL`).
  - *Color Palette*: Filter by swatch tones (*Onyx Black, Ivory, Navy, Sandstone*).
- **Sort Dropdown**: Options for *Recommended, Newest Arrivals, Price: Low to High, Price: High to Low, Top Rated*.
- **Product Cards**:
  - *Image Layer*: High-resolution garment photo with smooth hover zoom.
  - *3D View Icon (`<Box />`)*: Opens the standalone 3D WebGL preview modal without leaving the catalog.
  - *Wishlist Icon (`<Heart />`)*: Toggles favorite state with instant optimistic UI update.
  - *Quick Add to Bag Button*: Opens the rapid size selection popover (`S, M, L, XL`), instantly adding the item to the cart and popping a toast alert.

---

### 2.3 Product Details Page (PDP) (`/storefront/product`)
- **Interactive Dual Viewport**:
  - *2D Mode*: Multi-angle high-resolution gallery with thumbnail switcher and full-screen zoom.
  - *3D Mode Toggle (`View in 3D`)*: Renders a real-time WebGL canvas allowing 360° rotational inspection, zooming, and fabric surface texture lighting.
- **Product Metadata**: Brand title, category breadcrumbs, customer review stars (`4.9 / 5.0`), MRP comparison, and discounted selling price in Indian Rupees (`₹`).
- **Interactive Selectors**:
  - *Color Swatches*: Select color variant with active gold ring indicator.
  - *Size Selector*: Pill buttons (`S`, `M`, `L`, `XL`) with out-of-stock disable states.
  - *Size Guide Modal (`<Ruler />`)*: Popover displaying chest, waist, and hip measurements in cm and inches.
  - *Quantity Stepper*: Decrement/Increment controls (`-`, `+`) with stock upper limit validation.
- **Primary Action Buttons**:
  - **`Add to Cart` Button**: Upserts the variant into `vastrax_cart`, displays the gold luxury toast notification, and automatically slides open the `CartDrawer`.
  - **`Buy Now` Button**: Instantly adds the item to the cart and navigates directly to the checkout screen (`/storefront/checkout`).
  - **`Virtual Fitting Room` Button (`<Sparkles />`)*: Routes to `/storefront/product/[id]/tryon` with garment preloaded for AI drape testing.
- **Information Tabs**: Tabbed accordion for *Garment Details, Fabric & Care, Delivery & Returns, Authenticity Guarantee*.

---

### 2.4 Interactive 3D Garment Modal & Viewer
- **WebGL Canvas**: OrbitControls for touch/mouse 360° rotation and pinch-to-zoom.
- **Lighting Controls**: Switch lighting presets (*Studio Warm, Runway Spot, Ambient Cyber*).
- **Direct Action**: `"Add to Bag"` button inside the 3D viewport to purchase directly from the 3D inspection state.

---

### 2.5 AI Virtual Try-On Fitting Room (`/storefront/product/[id]/tryon`)
- **User Photo Upload Zone**: Drag-and-drop or file selector for full-body patron portraits.
- **AI Drape Engine (Fashn VTON 1.5)**: Neural warping and segmentation that realistically fits the garment onto the patron's posture and body shape.
- **Pose Guidance Panel**: Dynamic guide cards displaying recommendations (*"Avoid long kurtis for pants try-on; full-length photos yield optimal drape"*).
- **Split Comparison Slider**: Interactive before/after swipe comparing patron original photo vs. AI dressed photo.
- **Instant Checkout Action**: `"Add Drape to Bag"` button with size selection.

---

### 2.6 AI Stylist Concierge Drawer (`StylistDrawer.tsx`)
- **Conversational Interface**: Powered by OpenAI GPT-4o mini with haute couture persona.
- **Persistent Chat History**: Stores and recalls user conversation threads across sessions.
- **Interactive Context Chips**: Clickable prompt pills (*"Outfit for black-tie gala", "What shoes match this dress?", "Trending minimalist looks"*).
- **Product Recommendation Cards**: Stylist replies embed interactive cards with product thumbnail, price, and one-click `"Add to Bag"` buttons.

---

### 2.7 Slide-Over Shopping Bag Drawer (`CartDrawer.tsx`)
- **Live Item List**: Displays thumbnail, item title, selected size, color, quantity stepper, and unit price.
- **Complimentary Delivery Progress Bar**: Interactive tracker showing remaining balance needed for free global delivery (*"Add ₹500 more for Complimentary Express"*).
- **Promo Code Engine**: Coupon code input (*e.g., `VASTRAX10`*) with live validation and discount calculation.
- **Pricing Breakdown**: Subtotal, Applied Discount, Shipping fee, and Grand Total.
- **Checkout CTA**: Full-width high-contrast button routing directly to `/storefront/checkout`.

---

### 2.8 Multi-Step Checkout & Payment Screen (`/storefront/checkout`)
- **Step 1: Contact & Delivery Address**:
  - Full Name, Email, Phone Number (for courier contact), Street Address, Apartment, City, State, PIN Code.
  - Automatically saves address to customer profile for one-click future checkouts.
- **Step 2: Shipping Method**:
  - *Standard Complimentary Delivery (3-5 business days)*
  - *Express Air Courier (1-2 business days)*
  - *White-Glove VIP Delivery (Same-day scheduled drop)*
- **Step 3: Payment Options**:
  - *Online Payment (Cards, NetBanking, UPI via Razorpay SDK Modal)*
  - *Cash on Delivery (COD)* with instant automated Shiprocket manifesting.
  - *Development Simulation Mode*: In-page modal allowing instant local verification of successful charges or card decline handling without live keys.
- **Step 4: Order Confirmation & Receipt**:
  - Order Reference Number (e.g. `#VX-2026-1F90`).
  - Estimated delivery timeline and tracking number.
  - Automated HTML confirmation email dispatched to customer inbox.

---

### 2.9 Customer Account & Order Tracker Portal (`/storefront/account`)
- **Order History & Timeline**: Comprehensive list of all past customer orders.
  - *Progress Stepper*: Visual tracking bar (`Order Placed` → `Confirmed` → `Dispatched` → `Out for Delivery` → `Delivered`).
  - *Tracking Integration*: Live Shiprocket courier status and AWB tracking link.
- **Saved Addresses**: Address book allowing customers to add, edit, or delete delivery locations.
- **Profile & Security**: Update full name, phone number, and password.

---

### 2.10 Customer Favorites / Wishlist Page (`/storefront/favorites`)
- **Saved Items Grid**: All favorited pieces with real-time stock availability badges.
- **One-Click Move to Bag**: Quick size selector modal transferring pieces into the active cart drawer.

---

### 2.11 Customer Auth Modal (`AuthModal.tsx`)
- **Dual Registration**: Requires both **Email** and **Mobile Number (+91)**.
- **Email OTP Verification Screen**: Clean 6-digit code entry interface with 10-minute expiry and resend countdown.
- **Direct Login**: Single-step sign in accepting either email address or mobile number + password.

---

## 3. Admin Management Suite (Operations & Control)

```
[Admin Dashboard Overview]
         │
         ├──> [AI Executive Assistant] ─── (OpenAI GPT-4o analytics & stock queries)
         ├──> [Products Management] ───── (Catalog table, 3D Hunyuan generation, variants)
         ├──> [Categories Manager] ────── (Active taxonomy & deleted trash bin)
         ├──> [Orders & Fulfillment] ──── (Live pipeline, status updater, Shiprocket)
         ├──> [User Directory] ────────── (Customer list, verification toggle, soft delete)
         ├──> [Security & RBAC] ───────── (Admin permissions, role matrix)
         └──> [Storefront Settings] ───── (Maintenance mode, payment & gateway config)
```

---

### 3.1 Admin Dashboard Overview (`/`)
- **Top Metrics Bento Grid**:
  - *Total Revenue (`₹`)* with percentage growth indicator.
  - *Active Orders Count* with pending fulfillment counter.
  - *Catalog Products Count* with low-stock alerts.
  - *Registered Patrons* with weekly user acquisition velocity.
- **Sales Analytics Chart**: Interactive Day-of-Week bar/line visualization calculating revenue dynamically from completed orders.
- **AI Executive Insights Panel**: Real-time analytical highlights generated by GPT-4o (*"Dresses category experiencing 34% surge in virtual try-on conversions"*).
- **Recent Orders Feed**: Quick-view table of latest high-value transactions with one-click status transitions.

---

### 3.2 AI Executive Assistant Console (`/ai-assistant`)
- **Model Selector**: Toggle between OpenAI GPT-4o and specialized analytical models.
- **Natural Language Store Queries**: Admins can ask questions like:
  - *"Which garments have stock lower than 5 units?"*
  - *"What was our total revenue over the last 48 hours?"*
  - *"Suggest a price markdown for slow-moving trousers."*
- **Visual 3D Iridescent Orb**: Real-time voice/text processing animation indicator.

---

### 3.3 Products Management Directory (`/products`)
- **Catalog Master Table**:
  - *Thumbnail & Title*: Garment image, category pill, and SKU code.
  - *Inventory Sizing Matrix*: Stock counts for `S`, `M`, `L`, `XL`. Low-stock rows are highlighted in amber/red.
  - *Pricing Column*: MRP vs. Selling Price in Indian Rupees.
  - *Status Pill*: Published / Draft toggle switch.
  - *Action Buttons*: Edit product, Preview 3D model, and Delete with confirmation modal.
- **Search & Filter Bar**: Filter by category, stock status (*In Stock / Low Stock / Out of Stock*), and search query.

---

### 3.4 Enhanced Add Product Wizard (`/products/add`)
- **Tab 1: Basic Information**: Title, category association, fabric description, care instructions, and occasion tags.
- **Tab 2: Pricing & Sizing**: MRP, selling price, tax rate, and individual variant stock allocations (`S`, `M`, `L`, `XL`).
- **Tab 3: Product Imagery**: Drag-and-drop 2D photo upload zone with drag-reorder, primary image selector, and image deletion.
- **Tab 4: 3D Garment Reconstruction (Hunyuan3D-2.1)**:
  - Upload Front, Side, and Back photos of the garment.
  - Click `"Generate 3D Asset"` to trigger neural shape reconstruction and UV texture painting.
  - Real-time WebGL viewport previewing the resulting `.glb` asset before saving to catalog.

---

### 3.5 Product Categories & Trash Bin (`/categories`)
- **Active Categories View**: List of all product categories with display order rank, image banner, and linked product count.
- **Create Category Modal**: Form to add new taxonomy with banner upload and URL slug.
- **Deleted Archive (Trash Bin)**: Tab containing soft-deleted categories with `"Restore"` and `"Permanent Purge"` actions.

---

### 3.6 Live Orders & Fulfillment Pipeline (`/orders`)
- **Order Pipeline Stepper**:
  - Filter tabs: *All Orders, Pending, Confirmed, Packed, Shipped, Delivered, Cancelled*.
- **Order Details Drawer**:
  - Customer contact details, delivery address, ordered line items with size and quantity.
  - Shiprocket AWB number and courier tracking link.
- **Admin Status Transition Buttons**:
  - Click `"Mark as Packed"`, `"Dispatch / Ship"`, `"Mark Delivered"`, or `"Cancel Order"`.
  - Cancelling an order automatically triggers inventory restoration (`variant.stock_qty += item.quantity`) and marks payment status as `refunded`.

---

### 3.7 User Directory & Deleted Archive (`/users`)
- **Master User Table**: Full name, email, mobile number, role (`Admin` or `Customer`), email verification badge, and registration timestamp.
- **User Actions**:
  - *Toggle Verification*: Instantly mark user as active or unverified.
  - *View Profile Drawer*: View user's lifetime spend, total orders placed, and saved addresses.
  - *Soft Delete*: Move user account to trash.
- **Deleted Users Archive (`/users/deleted`)**: Search through soft-deleted accounts with one-click restore or irreversible purge.

---

### 3.8 Administrator Security & RBAC Roles (`/admin/management`)
- **Admin Accounts List**: Table of all elevated staff accounts.
- **Create Admin Modal**: Form to invite new administrators with assigned roles.
- **Role Permission Matrix**: Configure granular permissions (*Manage Products, Manage Orders, View Financial Analytics, Access AI Assistant, Manage Staff*).

---

### 3.9 System Settings & Storefront Configuration (`/settings`)
- **Tab 1: General & Brand Profile**: Boutique name, official support email, currency symbol, and logo branding.
- **Tab 2: Payment Gateways**: Configuration for Razorpay credentials (*Key ID, Key Secret, Webhook Secret, Live/Mock toggle*).
- **Tab 3: Logistics & Couriers**: Shiprocket API settings (*API Email, Password, Warehouse Pickup Pincode*).
- **Tab 4: AI & Communication**: OpenAI API Key configuration, model selection, and Resend email credentials.
- **Tab 5: Storefront Maintenance**: One-click toggle for Storefront Maintenance Mode.

---

## 4. Default Credentials & Access Guide

| Portal | URL Route | Default Email | Password |
| :--- | :--- | :--- | :--- |
| **Storefront Customer Portal** | `/storefront/home` | `customer@vastrax.com` | `customer123` |
| **Admin Operations Dashboard**| `/` (or `/orders`) | `admin@vastrax.com` | `admin123` |
