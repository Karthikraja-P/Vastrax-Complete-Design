# VASTRAX E-Commerce & Admin Dashboard

This is a complete Next.js 15 project integrating a modern, dark-luxury e-commerce storefront and a high-end "cyber-luxury" admin dashboard.

## Codebase Architecture & Map

- `/src/app/page.tsx` - The main Admin Dashboard overview (Bento grid, charts, metrics).
- `/src/app/storefront/` - The user-facing e-commerce storefront.
  - `/home/page.tsx` - Storefront landing page.
  - `/collections/page.tsx` - Category/Collections page.
  - `/product/page.tsx` - Product Details Page (PDP).
- `/src/components/layout/` - Global layout wrappers.
  - `Header.tsx` - Top navigation bar (handles storefront routing and theme toggling).
  - `Sidebar.tsx` - Collapsible admin sidebar.
  - `MainLayout.tsx` - Layout wrapper managing the sidebar state and grid layout.
- `/src/components/admin/` - Admin specific components.
  - `NotchedCard.tsx` - Custom card component with a notched corner (`clip-path`) and glass grid background.
- `/src/app/globals.css` - Global Tailwind CSS, theme variables, and custom typography overrides.

## Current To-Do
- [ ] Implement robust backend APIs.
- [ ] Connect Postgres/MongoDB database.
- [ ] Implement user authentication and authorization logic.
- [ ] Dynamic data fetching for metrics, orders, and products.

---

# Backend Requirements & Data Models

Based on the VASTRAX Storefront and Admin Dashboard UI we have built so far, here is a detailed breakdown of the required backend data models and API endpoints. We will use this document as a checklist when we begin implementing the backend (e.g., using Prisma/Drizzle ORM with PostgreSQL or MongoDB).

## 1. Data Models (Database Schema)

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
