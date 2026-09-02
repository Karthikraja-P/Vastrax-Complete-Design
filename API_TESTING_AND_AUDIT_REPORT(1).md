# VASTRAX — Comprehensive Live API Testing, Discrepancy Analysis & Frontend Audit Report

**Audit Target URL**: `https://dec-obtaining-horizontal-timber.trycloudflare.com`  
**Storefront URL**: `https://dec-obtaining-horizontal-timber.trycloudflare.com/storefront/home`  
**Admin Dashboard URL**: `https://dec-obtaining-horizontal-timber.trycloudflare.com/`  
**Reference Specification**: [APPLICATION_OVERVIEW.md]
**Date**: September 2, 2026  

---

## 1. Executive Summary

A second, deeper re-testing cycle was conducted on the upgraded live deployment, analyzing both backend APIs and the client-side Next.js bundle logic for **Admin Dashboard interactions**, **Settings tabs**, **CRUD file uploads**, and **Storefront navigation**.

### Key Outcomes:
1. **Backend Upgrades Verified (8 Endpoints Fixed)**:
   - Mobile login (`POST /auth/login`), Address creation without label (`POST /users/me/addresses`), Product update (`PUT /products/{id}`), Analytics insights (`GET /analytics/insights`), Shipping serviceability (`GET /shipping/serviceability`), 3D mesh generation (`POST /3d/generate`), Customer orders list (`GET /orders/my-orders`), and Wishlist save (`POST /users/me/wishlist`) have now been fixed and return `200 OK` / `201 Created`.
2. **Settings Page Tabs Bug Identified**:
   - In `src/app/settings/page.tsx`, only the `Profile` tab renders content. The JSX return block completely omits render blocks for `activeTab === 'security'` and `activeTab === 'app'`, leaving the screen completely blank when clicking **Security** or **App Settings**.
3. **Header Avatar & Notifications Redirection Issues**:
   - Clicking the circular avatar (`AV Alexandre`) does not navigate directly to the Admin profile or `/settings`; it opens a dropdown whose "My Account" link mistakenly points to the customer portal (`/storefront/account`).
   - The Notification Bell button only toggles a static popup and lacks a dedicated activity page.
4. **Missing File Attachments on CRUD Pages**:
   - Zero `<input type="file">` components exist on the **Products**, **Categories**, or **Users** pages. Forms rely entirely on hardcoded Unsplash image URLs rather than actual file/photo uploads.
5. **Storefront Home Navigation Dead Links**:
   - Main header navigation links (`New Arrivals`, `Women`, `Men`) are dead links (`href="#"`) and do not navigate anywhere.
6. **Storefront Checkout Payload Mismatch**:
   - The checkout form still sends item prices under the key `price` instead of the backend's required `unit_price`, causing order submission to fail (`422 Unprocessable Entity`).

---

## 2. Page-by-Page Detailed Error & Discrepancy Breakdown

### 🛠️ 1. Admin Settings Page (`/settings`)
- **URL**: `https://dec-obtaining-horizontal-timber.trycloudflare.com/settings`
- **Error**: Clicking **Security** or **App Settings** shows an empty/blank panel.
- **Root Cause**:
  ```tsx
  // src/app/settings/page.tsx
  // The tab state updates:
  onClick={() => setActiveTab('security')}
  onClick={() => setActiveTab('app')}

  // BUT in the render section, only profile is implemented:
  {activeTab === 'profile' && (
    <div>{/* Profile Content */}</div>
  )}
  // MISSING: {activeTab === 'security' && (...)}
  // MISSING: {activeTab === 'app' && (...)}
  ```
- **Fix**: Implement the conditional JSX render blocks for `activeTab === 'security'` (Password change & 2FA) and `activeTab === 'app'` (Store Name, Support Email, Currency, Active Promotions).

---

### 🛡️ 2. Admin Header Bar (`/`)
- **URL**: `https://dec-obtaining-horizontal-timber.trycloudflare.com/` (Top Header)
- **Error**: Circular profile avatar (`AV Alexandre`) and Notification bell (`badge 2`) do not redirect properly.
- **Root Cause**:
  - Avatar button only toggles `isUserMenuOpen`. The menu item "My Account" has `href="/storefront/account"` (routes to customer portal instead of admin `/settings`).
  - Notification bell only toggles `isNotificationsOpen` with a small popup.
- **Fix**: Update the avatar dropdown link to point to `/settings`, and add a dedicated `/notifications` activity route.

---

### 📦 3. Products, Categories & Users Pages (Missing File Uploads)
- **URLs**:
  - `/products`
  - `/categories`
  - `/users`
- **Error**: No file attachment or image upload functionality.
- **Root Cause**:
  - Zero `<input type="file">` elements exist in `src/app/products/page.tsx`, `src/app/categories/page.tsx`, or `src/app/users/page.tsx`.
  - Product creation and editing uses text inputs with fallback Unsplash strings (`https://images.unsplash.com/...`).
- **Fix**: Add multi-part file upload pickers (`<input type="file" accept="image/*,.glb" />`) connected to backend S3 / local file upload endpoints.

---

### 🛍️ 4. Storefront Home Page (`/storefront/home`)
- **URL**: `https://dec-obtaining-horizontal-timber.trycloudflare.com/storefront/home`
- **Error**: Top navigation links do not work (`href="#"`); search input does not submit queries.
- **Root Cause**:
  - `New Arrivals`, `Women`, and `Men` are coded as `href="#"` in `src/app/storefront/home/page.tsx`.
  - The search input lacks an `onKeyDown` (Enter key) listener or form submit handler to route to `/storefront/collections?search=...`.
- **Fix**:
  - Replace `href="#"` with active category query routes (e.g. `/storefront/collections?category=new-arrivals`).
  - Add search submit handler routing to `/storefront/collections?search=${query}`.

---

### 💳 5. Storefront Checkout Page (`/storefront/checkout`)
- **URL**: `https://dec-obtaining-horizontal-timber.trycloudflare.com/storefront/checkout`
- **Error**: `HTTP 422 Unprocessable Entity` on order submission (`POST /api/v1/orders`).
- **Root Cause**:
  ```tsx
  // src/app/storefront/checkout/page.tsx
  items: items.map((item) => ({
      product_id: String(item.id),
      size: item.size || "M",
      color: item.color || "Default",
      quantity: item.quantity,
      price: item.price // <--- BUG: Backend requires 'unit_price'
  }))
  ```
- **Fix**: Change `price` to `unit_price` in the checkout item payload.

---

## 3. Backend Retest Status (After Team Upgrades)

| Endpoint & Method | Previous Status | Current Retest Status | Notes |
| :--- | :---: | :---: | :--- |
| `POST /api/v1/auth/login` (Mobile) | `422 Unprocessable` | `200 OK` | **Fixed by team** — Mobile login now working. |
| `POST /api/v1/users/me/addresses` (No label)| `422 Unprocessable` | `201 Created` | **Fixed by team** — Default label applied automatically. |
| `PUT /api/v1/products/{id}` | `500 Server Error` | `200 OK` | **Fixed by team** — Partial updates now persist. |
| `GET /api/v1/analytics/insights` | `500 Server Error` | `200 OK` | **Fixed by team** — Returns AI business suggestions. |
| `GET /api/v1/shipping/serviceability` | `404 Not Found` | `200 OK` | **Fixed by team** — Pincode estimation working. |
| `POST /api/v1/3d/generate` | `404 Not Found` | `200 OK` | **Fixed by team** — Hunyuan3D route mounted. |
| `GET /api/v1/orders/my-orders` | `404 Not Found` | `200 OK` | **Fixed by team** — Customer order history accessible. |
| `POST /api/v1/users/me/wishlist` | `405 Method Not Allowed`| `200 OK` | **Fixed by team** — Server wishlist sync working. |
| `POST /api/v1/auth/register` (`mobile`) | `422 Unprocessable` | `422 Unprocessable` | **Pending** — Requires `phone_number`. |
| `POST /api/v1/orders` (`price` key) | `422 Unprocessable` | `422 Unprocessable` | **Pending** — Frontend must send `unit_price`. |

---

## 4. Summary of Concrete Frontend Code Fixes

### 1. Fix Settings Tabs in `src/app/settings/page.tsx`
```tsx
{activeTab === 'profile' && (
  <div>{/* Profile Content */}</div>
)}

{activeTab === 'security' && (
  <div className="space-y-6">
    <h2 className="text-xl font-bold text-foreground">Security & Credentials</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label className="text-sm font-medium">Current Password</label>
        <input type="password" className="w-full px-4 py-2.5 bg-background border border-border rounded-lg mt-1" />
      </div>
      <div>
        <label className="text-sm font-medium">New Password</label>
        <input type="password" className="w-full px-4 py-2.5 bg-background border border-border rounded-lg mt-1" />
      </div>
    </div>
    <button className="px-6 py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-accent/90">
      Update Password
    </button>
  </div>
)}

{activeTab === 'app' && (
  <div className="space-y-6">
    <h2 className="text-xl font-bold text-foreground">Store & App Configuration</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label className="text-sm font-medium">Store Name</label>
        <input type="text" defaultValue="VASTRAX Luxury" className="w-full px-4 py-2.5 bg-background border border-border rounded-lg mt-1" />
      </div>
      <div>
        <label className="text-sm font-medium">Support Email</label>
        <input type="email" defaultValue="concierge@vastrax.luxury" className="w-full px-4 py-2.5 bg-background border border-border rounded-lg mt-1" />
      </div>
    </div>
    <button className="px-6 py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-accent/90">
      Save App Settings
    </button>
  </div>
)}
```

### 2. Fix Header Avatar Dropdown in `src/components/layout/Header.tsx`
```tsx
<Link 
  href="/settings" 
  onClick={() => setIsUserMenuOpen(false)}
  className="block w-full text-left px-4 py-3 text-sm font-medium text-foreground hover:bg-surface transition-colors"
>
  Admin Settings & Profile
</Link>
```

### 3. Fix Storefront Header Links in `src/app/storefront/home/page.tsx`
```tsx
<Link href="/storefront/collections?category=new-arrivals" className="text-lg font-medium hover:text-accent transition-colors">
  New Arrivals
</Link>
<Link href="/storefront/collections?category=cat-dresses" className="text-lg font-medium hover:text-accent transition-colors">
  Women
</Link>
<Link href="/storefront/collections?category=cat-tops" className="text-lg font-medium hover:text-accent transition-colors">
  Men
</Link>
```

### 4. Fix Checkout Order Key in `src/app/storefront/checkout/page.tsx`
```tsx
items: items.map((item) => ({
    product_id: String(item.id),
    size: item.size || "M",
    color: item.color || "Default",
    quantity: item.quantity,
    unit_price: item.price // Fixed key name
}))
```
