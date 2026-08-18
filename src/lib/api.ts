/**
 * VASTRAX Unified API Client
 * Connects Next.js Frontend to FastAPI / PostgreSQL Backend (/api/v1)
 * Includes graceful offline fallback to preserve UI interactivity.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// Helper fetch wrapper
async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("vastrax_token") : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || errorBody.message || `API Error: ${res.statusText}`);
  }

  return res.json();
}

// -------------------------------------------------------------
// 1. PRODUCTS API
// -------------------------------------------------------------
export interface ProductItem {
  id: string | number;
  name?: string;
  title?: string;
  slug?: string;
  description?: string;
  price: number;
  originalPrice?: number;
  compareAtPrice?: number;
  stock?: number;
  inventoryCount?: number;
  category?: string;
  categoryId?: string;
  status?: string;
  image?: string;
  images?: string[];
  rating?: number;
  sku?: string;
  isNew?: boolean;
  isSale?: boolean;
}

export const productsApi = {
  async list(params?: { category_id?: string; skip?: number; limit?: number }): Promise<ProductItem[]> {
    try {
      const query = new URLSearchParams();
      if (params?.category_id) query.append("category_id", params.category_id);
      if (params?.skip !== undefined) query.append("skip", String(params.skip));
      if (params?.limit !== undefined) query.append("limit", String(params.limit));
      return await fetchApi<ProductItem[]>(`/products?${query.toString()}`);
    } catch {
      // Offline fallback products
      return [
        { id: 1, name: "Teal Five-Panel Cap", title: "Teal Five-Panel Cap", price: 45, originalPrice: 55, stock: 18, category: "Hats", image: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?q=80&w=400&auto=format&fit=crop", status: "Published", rating: 4.8 },
        { id: 2, name: "Camel Wool Flat Cap", title: "Camel Wool Flat Cap", price: 48, originalPrice: 60, stock: 9, category: "Hats", image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=400&auto=format&fit=crop", status: "Published", rating: 4.5, isNew: true },
        { id: 3, name: "Cream Pullover Hoodie", title: "Cream Pullover Hoodie", price: 120, stock: 32, category: "Hoodies", image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=400&auto=format&fit=crop", status: "Published", rating: 4.9 },
        { id: 4, name: "Olive Puffer Jacket", title: "Olive Puffer Jacket", price: 220, originalPrice: 280, stock: 12, category: "Jackets", image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=400&auto=format&fit=crop", status: "Published", rating: 4.7 },
        { id: 5, name: "Tailored Cargo Pants", title: "Tailored Cargo Pants", price: 95, stock: 24, category: "Pants", image: "https://images.unsplash.com/photo-1542272604-787c3835535d?q=80&w=400&auto=format&fit=crop", status: "Published", rating: 4.6 },
        { id: 6, name: "Suede Penny Loafers", title: "Suede Penny Loafers", price: 179, stock: 8, category: "Shoes", image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&w=400&auto=format&fit=crop", status: "Draft", rating: 4.8 }
      ];
    }
  },

  async getById(id: string | number): Promise<ProductItem | null> {
    try {
      return await fetchApi<ProductItem>(`/products/${id}`);
    } catch {
      return {
        id,
        name: "Teal Five-Panel Cap",
        title: "Teal Five-Panel Cap",
        price: 45,
        originalPrice: 55,
        stock: 18,
        category: "Hats",
        description: "Low-profile five-panel cap in deep teal cotton, with a flat brim and a woven adjuster strap.",
        image: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?q=80&w=400&auto=format&fit=crop",
        status: "Published",
        rating: 4.8
      };
    }
  },

  async create(data: Partial<ProductItem>): Promise<ProductItem> {
    return await fetchApi<ProductItem>("/products", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async update(id: string | number, data: Partial<ProductItem>): Promise<ProductItem> {
    return await fetchApi<ProductItem>(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async delete(id: string | number): Promise<{ success: boolean }> {
    return await fetchApi<{ success: boolean }>(`/products/${id}`, {
      method: "DELETE",
    });
  }
};

// -------------------------------------------------------------
// 2. CATEGORIES API
// -------------------------------------------------------------
export interface CategoryItem {
  id: string | number;
  name: string;
  slug: string;
  count?: number;
  image_url?: string;
  icon?: string;
}

export const categoriesApi = {
  async list(): Promise<CategoryItem[]> {
    try {
      return await fetchApi<CategoryItem[]>("/categories");
    } catch {
      return [
        { id: "cat-1", name: "T-Shirts", slug: "t-shirts", count: 45, icon: "❖", image_url: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=300&auto=format&fit=crop" },
        { id: "cat-2", name: "Hoodies & Sweatshirts", slug: "hoodies-sweatshirts", count: 32, icon: "❖", image_url: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=300&auto=format&fit=crop" },
        { id: "cat-3", name: "Jackets & Outerwear", slug: "jackets-outerwear", count: 18, icon: "❖", image_url: "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=300&auto=format&fit=crop" },
        { id: "cat-4", name: "Pants & Trousers", slug: "pants-trousers", count: 24, icon: "❖", image_url: "https://images.unsplash.com/photo-1542272604-787c3835535d?q=80&w=300&auto=format&fit=crop" },
        { id: "cat-5", name: "Shoes & Sneakers", slug: "shoes-sneakers", count: 28, icon: "❖", image_url: "https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&w=300&auto=format&fit=crop" },
        { id: "cat-6", name: "Hats", slug: "hats", count: 12, icon: "❖", image_url: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?q=80&w=300&auto=format&fit=crop" }
      ];
    }
  },

  async create(data: { name: string; slug: string; image_url?: string }): Promise<CategoryItem> {
    return await fetchApi<CategoryItem>("/categories", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async delete(id: string | number): Promise<{ success: boolean }> {
    return await fetchApi<{ success: boolean }>(`/categories/${id}`, {
      method: "DELETE",
    });
  }
};

// -------------------------------------------------------------
// 3. ORDERS API
// -------------------------------------------------------------
export interface OrderItemRecord {
  id: string | number;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  status: "PENDING" | "PROCESSING" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  itemsCount: number;
  createdAt: string;
  deliveryMethod: string;
}

export const ordersApi = {
  async list(): Promise<OrderItemRecord[]> {
    try {
      return await fetchApi<OrderItemRecord[]>("/orders");
    } catch {
      return [
        { id: "ord-1", orderNumber: "#VX-9021", customerName: "Elena Rostova", customerEmail: "elena@rostova.com", totalAmount: 460.00, status: "CONFIRMED", itemsCount: 3, createdAt: "2026-08-18T14:32:00Z", deliveryMethod: "Express" },
        { id: "ord-2", orderNumber: "#VX-9020", customerName: "Marcus Sterling", customerEmail: "marcus@sterling.co", totalAmount: 185.00, status: "SHIPPED", itemsCount: 1, createdAt: "2026-08-18T11:20:00Z", deliveryMethod: "Standard" },
        { id: "ord-3", orderNumber: "#VX-9019", customerName: "Sarah Jenkins", customerEmail: "sarah.j@gmail.com", totalAmount: 890.00, status: "PROCESSING", itemsCount: 4, createdAt: "2026-08-17T18:45:00Z", deliveryMethod: "Concierge" },
        { id: "ord-4", orderNumber: "#VX-9018", customerName: "David Chen", customerEmail: "d.chen@apex.io", totalAmount: 240.00, status: "DELIVERED", itemsCount: 2, createdAt: "2026-08-16T09:15:00Z", deliveryMethod: "Express" }
      ];
    }
  },

  async updateStatus(id: string | number, status: string): Promise<{ success: boolean }> {
    return await fetchApi<{ success: boolean }>(`/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }
};

// -------------------------------------------------------------
// 4. VIRTUAL TRY-ON API (FASHN VTON 1.5 wrapper)
// -------------------------------------------------------------
export interface TryonResult {
  session_id: string;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  result_image_url?: string;
  processing_time_ms?: number;
}

export const tryonApi = {
  async submit(data: { product_id: string | number; user_photo_base64: string; category?: string }): Promise<TryonResult> {
    try {
      return await fetchApi<TryonResult>("/tryon/submit", {
        method: "POST",
        body: JSON.stringify(data),
      });
    } catch {
      // Mocked realistic simulation for offline dev
      await new Promise(r => setTimeout(r, 1200));
      return {
        session_id: `ses_${Math.floor(Math.random() * 100000)}`,
        status: "COMPLETED",
        result_image_url: "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600&auto=format&fit=crop",
        processing_time_ms: 1100
      };
    }
  }
};

// -------------------------------------------------------------
// 5. ANALYTICS & APP SETTINGS API
// -------------------------------------------------------------
export const analyticsApi = {
  async getOverview() {
    try {
      return await fetchApi<any>("/analytics/overview");
    } catch {
      return {
        revenue: { total: 319200.00, changePercent: 14.6, trend: "UP", avgOrderValue: 128.50 },
        customers: { total: 8420, growthPercent: 8.2, retentionRate: 74.5 },
        salesWeekly: { labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], values: [4200, 6800, 5100, 9200, 8400, 11500, 13400] },
        conversionRate: { rate: 3.42, change: 0.8 },
        activeCampaigns: { count: 4, reach: "128.4K", roi: "340%" }
      };
    }
  },

  async getRegionalSales() {
    try {
      return await fetchApi<any>("/analytics/regional-sales");
    } catch {
      return {
        regions: [
          { countryCode: "US", countryName: "United States", revenue: 142000, orders: 890 },
          { countryCode: "GB", countryName: "United Kingdom", revenue: 68000, orders: 410 },
          { countryCode: "SA", countryName: "Saudi Arabia", revenue: 54000, orders: 290 },
          { countryCode: "AE", countryName: "United Arab Emirates", revenue: 38000, orders: 210 }
        ]
      };
    }
  }
};

export const settingsApi = {
  async getApp() {
    try {
      return await fetchApi<any>("/settings/app");
    } catch {
      return {
        storeName: "VASTRAX Luxury Apparel",
        supportEmail: "concierge@vastrax.luxury",
        supportPhone: "+1 (800) 827-8729",
        currency: "USD ($)",
        timezone: "UTC-05:00 (Eastern Time)",
        announcementText: "Complimentary Global Express Delivery on Orders Over $250",
        enableGuestCheckout: true,
        enableLowStockAlerts: true,
        lowStockThreshold: 5,
        autoArchiveOrders: false,
        maintenanceMode: false
      };
    }
  },

  async updateApp(data: any) {
    try {
      return await fetchApi<any>("/settings/app", {
        method: "PUT",
        body: JSON.stringify(data),
      });
    } catch {
      return { success: true, settings: data };
    }
  }
};

// -------------------------------------------------------------
// 7. AI FASHION STYLIST CHAT API (Anthropic Claude)
// -------------------------------------------------------------
export const chatApi = {
  async sendMessage(message: string, sessionId?: string): Promise<string> {
    try {
      const res = await fetchApi<{ reply?: string; message?: string }>("/chat", {
        method: "POST",
        body: JSON.stringify({ message, session_id: sessionId || "session-default" }),
      });
      return res.reply || res.message || "For a refined architectural silhouette, pair structured tailored blazers with fluid silk bottoms and matte leather accents.";
    } catch {
      return "For a refined architectural silhouette, pair structured tailored blazers with fluid silk bottoms and matte leather accents.";
    }
  }
};

// -------------------------------------------------------------
// 8. PROMOS & DISCOUNTS API
// -------------------------------------------------------------
export interface PromoValidationResult {
  valid: boolean;
  code: string;
  discountPercentage: number;
  discountAmount?: number;
  message: string;
}

export const promosApi = {
  async validate(code: string, cartTotal: number): Promise<PromoValidationResult> {
    const clean = code.trim().toUpperCase();
    if (clean === "VASTRAX10") {
      return {
        valid: true,
        code: clean,
        discountPercentage: 10,
        discountAmount: Number((cartTotal * 0.1).toFixed(2)),
        message: "10% VIP Private Invitation applied."
      };
    } else if (clean === "VIP20") {
      return {
        valid: true,
        code: clean,
        discountPercentage: 20,
        discountAmount: Number((cartTotal * 0.2).toFixed(2)),
        message: "20% Concierge Patron discount applied."
      };
    } else if (clean === "FREESHIP") {
      return {
        valid: true,
        code: clean,
        discountPercentage: 0,
        discountAmount: 25,
        message: "Complimentary Global Express Delivery applied."
      };
    } else {
      return {
        valid: false,
        code: clean,
        discountPercentage: 0,
        message: "Invalid promotion or expired invitation code."
      };
    }
  }
};

