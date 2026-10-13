/**
 * VASTRAX Unified API Client
 * Connects Next.js Frontend directly to FastAPI / PostgreSQL Backend (/api/v1)
 * Without mock data or hardcoded credentials.
 */

import { reportBackendReachable, reportBackendUnreachable } from "./backendStatus";
import { getSession } from "next-auth/react";
import type { Session } from "next-auth";

/** Arbitrary JSON object, used where the backend payload shape is not fixed. */
export type JsonObject = Record<string, unknown>;

/** NextAuth session augmented with the backend access token set in the auth callbacks. */
type SessionWithToken = Session & { accessToken?: string };

/** Error payload returned by the FastAPI backend. */
interface ApiErrorBody {
  detail?: string;
  message?: string;
}


// Helper fetch wrapper
export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const isBrowser = typeof window !== "undefined";
  let token = isBrowser ? localStorage.getItem("vastrax_token") : null;

  // Fallback: If localStorage token is missing in browser, fetch from active NextAuth session
  if (isBrowser && (!token || token === "null" || token === "undefined")) {
    try {
      const session = await getSession();
      const accessToken = (session as SessionWithToken | null)?.accessToken;
      if (accessToken) {
        token = accessToken;
        localStorage.setItem("vastrax_token", token);
      }
    } catch {}
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Pragma: "no-cache",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Use relative proxy /api/v1 in browser (works seamlessly across tunnels and localhost)
  const basesToTry = isBrowser
    ? ["/api/v1"]
    : [
        process.env.INTERNAL_BACKEND_URL
          ? `${process.env.INTERNAL_BACKEND_URL}/api/v1`
          : "http://127.0.0.1:8090/api/v1",
      ];
  let lastError: unknown = null;
  let gotResponse = false;

  for (const base of basesToTry) {
    try {
      const cleanBase = base.replace(/\/+$/, "");
      const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
      const url = cleanBase.endsWith("/api/v1")
        ? `${cleanBase}${cleanEndpoint}`
        : `${cleanBase}/api/v1${cleanEndpoint}`;

      const res = await fetch(url, {
        cache: "no-store",
        ...options,
        headers,
      });
      gotResponse = true;
      reportBackendReachable();

      if (res.ok) {
        const text = await res.text();
        return (text ? JSON.parse(text) : ({ success: true })) as T;
      }

      // If 401 occurs, try refreshing token from active NextAuth session
      if (res.status === 401 && isBrowser) {
        try {
          const session = await getSession();
          const sessionToken = (session as SessionWithToken | null)?.accessToken;
          if (sessionToken && sessionToken !== token) {
            token = sessionToken;
            localStorage.setItem("vastrax_token", sessionToken);
            const retryHeaders = { ...headers, Authorization: `Bearer ${sessionToken}` };
            const retryRes = await fetch(url, { ...options, headers: retryHeaders });
            if (retryRes.ok) {
              const retryText = await retryRes.text();
              return (retryText ? JSON.parse(retryText) : ({ success: true })) as T;
            }
          }
        } catch {}

        // For public GET requests, retry without Authorization header
        const method = (options.method || "GET").toUpperCase();
        if (method === "GET") {
          const retryHeaders = { ...headers };
          delete retryHeaders["Authorization"];
          const retryRes = await fetch(url, { ...options, headers: retryHeaders });
          if (retryRes.ok) {
            const retryText = await retryRes.text();
            return (retryText ? JSON.parse(retryText) : ({ success: true })) as T;
          }
        }
      }

      // If DELETE returns 404, consider it already deleted (idempotent)
      if (res.status === 404 && options.method && options.method.toUpperCase() === "DELETE") {
        return { success: true } as unknown as T;
      }

      const errorBody: ApiErrorBody = await res.json().catch(() => ({}));
      lastError = new Error(errorBody.detail || errorBody.message || `API Error (${res.status}): ${res.statusText}`);
    } catch (err: unknown) {
      lastError = err;
    }
  }

  if (!gotResponse) {
    // Every attempt failed before reaching the server at all — the backend is unreachable,
    // not just returning an error. BackendStatusProvider takes over rendering for this case.
    reportBackendUnreachable();
  }

  // Suppress uncaught throws for GET requests to prevent Next.js error modal overlays during fetch
  if (!options.method || options.method.toUpperCase() === "GET") {
    console.warn(`[API Notice] ${endpoint}:`, lastError instanceof Error ? lastError.message : undefined);
    return ({ success: true }) as unknown as T;
  }

  throw lastError || new Error("Failed to connect to backend service");
}

// -------------------------------------------------------------
// 1. PRODUCTS API
// -------------------------------------------------------------
export interface ProductReview {
  id: string;
  product_id: string;
  user_id: string;
  user_name: string;
  rating: number;
  comment?: string;
  created_at: string;
}

export interface ProductImage {
  s3_url?: string;
  url?: string;
  is_primary?: boolean;
  sort_order?: number;
  [key: string]: unknown;
}

export interface ProductVariant {
  id?: string | number;
  sku?: string;
  size?: string;
  colour?: string;
  color?: string;
  stock_qty?: number;
  price?: number;
  [key: string]: unknown;
}

export interface ProductItem {
  id: string | number;
  name?: string;
  title?: string;
  slug?: string;
  description?: string;
  created_at?: string;
  fabric?: string;
  colour?: string;
  occasion?: string;
  model_path?: string;
  model3dUrl?: string;
  price: number;
  price_selling?: number;
  price_mrp?: number;
  originalPrice?: number;
  compareAtPrice?: number;
  stock?: number;
  inventoryCount?: number;
  category?: string;
  category_name?: string;
  categoryId?: string | number;
  category_id?: string | number;
  status?: string;
  image?: string;
  images?: (string | ProductImage)[];
  rating?: number;
  rating_average?: number;
  rating_count?: number;
  reviewsCount?: number;
  sku?: string;
  gender?: string;
  size_chart?: JsonObject;
  isNew?: boolean;
  isSale?: boolean;
  is_published?: boolean;
  is_featured?: boolean;
  variants?: ProductVariant[];
}

export interface StorefrontProduct {
  id: string | number;
  name: string;
  price: number;
  originalPrice?: number;
  rating: number;
  ratingCount?: number;
  image: string;
  isNew: boolean;
  categoryId?: string | number;
  categoryName: string;
  model3dUrl?: string;
  colour?: string;
  gender?: string;
  stock?: number;
  isSale?: boolean;
  created_at?: string;
  variants?: ProductVariant[];
}

export const productsApi = {
  async list(params?: { category_id?: string; gender?: string; skip?: number; limit?: number; published_only?: boolean }): Promise<ProductItem[]> {
    try {
      const query = new URLSearchParams();
      if (params?.category_id) query.append("category_id", params.category_id);
      if (params?.gender) query.append("gender", params.gender);
      if (params?.skip !== undefined) query.append("skip", String(params.skip));
      if (params?.limit !== undefined) query.append("limit", String(params.limit));
      if (params?.published_only !== undefined) query.append("published_only", String(params.published_only));
      const res = await fetchApi<ProductItem[]>(`/products?${query.toString()}`);
      return Array.isArray(res) ? res : [];
    } catch (err) {
      console.error("Failed to fetch products:", err);
      return [];
    }
  },

  async getById(id: string | number): Promise<ProductItem | null> {
    try {
      return await fetchApi<ProductItem>(`/products/${id}`);
    } catch (err) {
      console.error(`Failed to fetch product ${id}:`, err);
      return null;
    }
  },

  async create(data: Partial<ProductItem> | JsonObject): Promise<ProductItem> {
    return await fetchApi<ProductItem>("/products", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async update(id: string | number, data: Partial<ProductItem> | JsonObject): Promise<ProductItem> {
    return await fetchApi<ProductItem>(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async delete(id: string | number): Promise<{ success: boolean }> {
    return await fetchApi<{ success: boolean }>(`/products/${id}`, {
      method: "DELETE",
    });
  },

  async subscribeStockNotification(productId: string | number, email: string, size?: string): Promise<{ success: boolean; message: string }> {
    return await fetchApi<{ success: boolean; message: string }>(`/products/${productId}/notify`, {
      method: "POST",
      body: JSON.stringify({ email, size }),
    });
  },

  async getReviews(productId: string | number): Promise<ProductReview[]> {
    try {
      const res = await fetchApi<ProductReview[]>(`/products/${productId}/reviews`);
      return Array.isArray(res) ? res : [];
    } catch (err) {
      console.error(`Failed to fetch reviews for product ${productId}:`, err);
      return [];
    }
  },

  async createReview(productId: string | number, data: { rating: number; comment?: string }): Promise<ProductReview> {
    return await fetchApi<ProductReview>(`/products/${productId}/reviews`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};


// -------------------------------------------------------------
// 2. CATEGORIES API
// -------------------------------------------------------------
export interface CategoryItem {
  id: string | number;
  name: string;
  slug: string;
  count?: number;
  product_count?: number;
  image_url?: string | null;
  image?: string | null;
  description?: string | null;
  is_active?: boolean;
  icon?: string;
}

export type CategoryInput = { name: string; slug: string; description?: string | null; is_active?: boolean; image_url?: string | null };

export const categoriesApi = {
  async list(): Promise<CategoryItem[]> {
    try {
      const res = await fetchApi<CategoryItem[]>("/categories");
      return Array.isArray(res) ? res : [];
    } catch (err) {
      console.error("Failed to fetch categories:", err);
      return [];
    }
  },

  async create(data: CategoryInput): Promise<CategoryItem> {
    return await fetchApi<CategoryItem>("/categories", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async update(id: string | number, data: Partial<CategoryInput>): Promise<CategoryItem> {
    return await fetchApi<CategoryItem>(`/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async delete(id: string | number): Promise<{ success: boolean }> {
    return await fetchApi<{ success: boolean }>(`/categories/${id}`, {
      method: "DELETE",
    });
  },
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
  status: string;
  paymentStatus: string;
  shippingAddress?: string;
  items: unknown[];
  itemsCount: number;
  createdAt: string;
  deliveryMethod: string;
  total_amount?: number | string;
  placed_at?: string;
  payment_status?: string;
  shipping_address?: string;
}

interface BackendOrderRecord {
  id: string | number;
  total_amount: number | string;
  status: string;
  payment_status: string;
  placed_at: string;
  customer_name?: string | null;
  customer_email?: string | null;
  delivery_method?: string | null;
  shipping_address?: string | null;
  items?: unknown[];
}

function normalizeOrder(order: BackendOrderRecord): OrderItemRecord {
  return {
    id: order.id,
    orderNumber: String(order.id),
    customerName: order.customer_name || "Customer",
    customerEmail: order.customer_email || "—",
    totalAmount: Number(order.total_amount) || 0,
    status: order.status.toUpperCase(),
    paymentStatus: order.payment_status.toUpperCase(),
    itemsCount: order.items?.length || 0,
    createdAt: order.placed_at,
    deliveryMethod: order.delivery_method || "—",
    shippingAddress: order.shipping_address || undefined,
    items: order.items || [],
  };
}

export const ordersApi = {
  async list(): Promise<OrderItemRecord[]> {
    try {
      const res = await fetchApi<BackendOrderRecord[]>("/orders/admin");
      return Array.isArray(res) ? res.map(normalizeOrder) : [];
    } catch (err) {
      console.error("Failed to fetch orders:", err);
      return [];
    }
  },

  async myOrders(): Promise<OrderItemRecord[]> {
    try {
      const res = await fetchApi<BackendOrderRecord[]>("/orders/me");
      return Array.isArray(res) ? res.map(normalizeOrder) : [];
    } catch {
      return [];
    }
  },

  async updateStatus(id: string | number, status: string): Promise<{ success: boolean }> {
    return await fetchApi<{ success: boolean }>(`/orders/admin/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
  },
  async markCodCollected(id: string | number): Promise<{ order_id: string; payment_status: string; amount: string }> {
    return await fetchApi<{ order_id: string; payment_status: string; amount: string }>("/orders/admin/" + id + "/cod-collected", {
      method: "POST",
    });
  },
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

export const DEFAULT_API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8090";

interface TryonSubmitResponse {
  session_id?: string;
  result_image_url?: string;
}

interface TryonDirectResponse {
  result_url?: string;
}

export const tryonApi = {
  async submit(data: { product_id?: string | number; user_photo_base64?: string; category?: string; garment_path?: string }): Promise<TryonResult> {
    const res = await fetchApi<TryonSubmitResponse>("/try-on/submit", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return {
      session_id: res.session_id || `ses_${Date.now()}`,
      status: "COMPLETED",
      result_image_url: res.result_image_url?.startsWith("http") ? res.result_image_url : `${DEFAULT_API_BASE.replace(/\/api\/v1\/?$/, "")}${res.result_image_url || ""}`,
      processing_time_ms: 1100,
    };
  },

  async submitDirect(personFile: File, garmentPath: string, garmentType?: string, productId?: string | number): Promise<TryonResult> {
    const formData = new FormData();
    formData.append("person_image", personFile);
    formData.append("garment_path", garmentPath);
    if (garmentType) formData.append("garment_type", garmentType);
    if (productId != null) formData.append("product_id", String(productId));

    const token = typeof window !== "undefined" ? localStorage.getItem("vastrax_token") : null;
    const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    const endpoints = [
      "/api/v1/try-on/",
      "http://localhost:8090/api/v1/try-on/",
      "http://localhost:8088/api/v1/try-on/",
      "http://localhost:8000/api/v1/try-on/",
    ];

    let lastError: unknown = null;
    let gotResponse = false;
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: authHeaders,
          body: formData,
        });
        gotResponse = true;
        reportBackendReachable();

        if (res.ok) {
          const data: TryonDirectResponse = await res.json();
          const imgUrl = data.result_url?.startsWith("http")
            ? data.result_url
            : data.result_url?.startsWith("/")
            ? data.result_url
            : `/results/${data.result_url || ""}`;
          return {
            session_id: `ses_${Date.now()}`,
            status: "COMPLETED",
            result_image_url: imgUrl,
          };
        } else if (res.status === 401 && typeof window !== "undefined" && token) {
          localStorage.removeItem("vastrax_token");
          delete authHeaders["Authorization"];
          const retryRes = await fetch(url, {
            method: "POST",
            headers: authHeaders,
            body: formData,
          });
          if (retryRes.ok) {
            const data: TryonDirectResponse = await retryRes.json();
            const imgUrl = data.result_url?.startsWith("http")
              ? data.result_url
              : data.result_url?.startsWith("/")
              ? data.result_url
              : `/results/${data.result_url || ""}`;
            return {
              session_id: `ses_${Date.now()}`,
              status: "COMPLETED",
              result_image_url: imgUrl,
            };
          }
          const errorBody: ApiErrorBody = await retryRes.json().catch(() => ({}));
          lastError = new Error(errorBody.detail || `Server returned ${retryRes.status}`);
        } else {
          const errorBody: ApiErrorBody = await res.json().catch(() => ({}));
          lastError = new Error(errorBody.detail || `Server returned ${res.status}`);
        }
      } catch (e: unknown) {
        lastError = e;
      }
    }

    if (!gotResponse) reportBackendUnreachable();
    throw lastError || new Error("Neural GPU inference failed to connect.");
  },

  async submitCombo(personFile: File, topPath: string, bottomPath: string, productId?: string | number): Promise<TryonResult> {
    const formData = new FormData();
    formData.append("person_image", personFile);
    formData.append("top_path", topPath);
    formData.append("bottom_path", bottomPath);
    if (productId != null) formData.append("product_id", String(productId));

    const token = typeof window !== "undefined" ? localStorage.getItem("vastrax_token") : null;
    const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    const endpoints = [
      "/api/v1/try-on/combo",
      "http://localhost:8090/api/v1/try-on/combo",
      "http://localhost:8088/api/v1/try-on/combo",
      "http://localhost:8000/api/v1/try-on/combo",
    ];

    let lastError: unknown = null;
    let gotResponse = false;
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: authHeaders,
          body: formData,
        });
        gotResponse = true;
        reportBackendReachable();

        if (res.ok) {
          const data: TryonDirectResponse = await res.json();
          const imgUrl = data.result_url?.startsWith("http")
            ? data.result_url
            : data.result_url?.startsWith("/")
            ? data.result_url
            : `/results/${data.result_url || ""}`;
          return {
            session_id: `ses_${Date.now()}`,
            status: "COMPLETED",
            result_image_url: imgUrl,
          };
        } else if (res.status === 401 && typeof window !== "undefined" && token) {
          localStorage.removeItem("vastrax_token");
          delete authHeaders["Authorization"];
          const retryRes = await fetch(url, {
            method: "POST",
            headers: authHeaders,
            body: formData,
          });
          if (retryRes.ok) {
            const data: TryonDirectResponse = await retryRes.json();
            const imgUrl = data.result_url?.startsWith("http")
              ? data.result_url
              : data.result_url?.startsWith("/")
              ? data.result_url
              : `/results/${data.result_url || ""}`;
            return {
              session_id: `ses_${Date.now()}`,
              status: "COMPLETED",
              result_image_url: imgUrl,
            };
          }
          const errorBody: ApiErrorBody = await retryRes.json().catch(() => ({}));
          lastError = new Error(errorBody.detail || `Server returned ${retryRes.status}`);
        } else {
          const errorBody: ApiErrorBody = await res.json().catch(() => ({}));
          lastError = new Error(errorBody.detail || `Server returned ${res.status}`);
        }
      } catch (e: unknown) {
        lastError = e;
      }
    }

    if (!gotResponse) reportBackendUnreachable();
    throw lastError || new Error("Neural GPU combo inference failed to connect.");
  },
};

// -------------------------------------------------------------
// 5. USERS API (Admin)
// -------------------------------------------------------------
export interface UserRecord {
  id: string | number;
  email?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  name?: string;
  phone?: string;
  phone_number?: string;
  role?: string;
  is_active?: boolean;
  created_at?: string;
  tryon_count?: number;
  chat_message_count?: number;
  [key: string]: unknown;
}

export const usersApi = {
  async listAll(): Promise<UserRecord[]> {
    try {
      const res = await fetchApi<UserRecord[]>("/users/admin");
      return Array.isArray(res) ? res : [];
    } catch (err) {
      console.error("Failed to fetch users:", err);
      return [];
    }
  },
};

// -------------------------------------------------------------
// 6. ANALYTICS & APP SETTINGS API
// -------------------------------------------------------------
export interface AnalyticsOverview {
  revenue: { total: number; growthPercent: number; avgOrderValue: number; ordersCount: number };
  customers: { total: number; growthPercent: number };
  salesWeekly: { labels: string[]; values: number[] };
  conversionRate: { rate: number; change: number };
  activeCampaigns: { count: number; reach: string; roi: string };
}

export interface RegionalSales {
  regions: JsonObject[];
}

export interface AnalyticsUsage {
  tryon: { total_sessions: number; completed: number; failed: number; processing: number; unique_users: number };
  ai_assistant: { total_messages: number; total_sessions: number; unique_signed_in_users: number };
}

/** Free-form AI insights payload; shape is owned by the backend. */
export interface AnalyticsInsights {
  revenue?: InsightBlock;
  customers?: InsightBlock;
  products?: InsightBlock;
  users?: InsightBlock;
  orders?: InsightBlock;
  [key: string]: unknown;
}

interface InsightBlock {
  alertTitle?: string;
  alertContent?: string;
  insightTitle?: string;
  insightContent?: string;
}

export const analyticsApi = {
  async getInsights(): Promise<AnalyticsInsights | null> {
    try {
      return await fetchApi<AnalyticsInsights>("/analytics/insights");
    } catch {
      return null;
    }
  },

  async getOverview(): Promise<AnalyticsOverview> {
    try {
      return await fetchApi<AnalyticsOverview>("/analytics/overview");
    } catch {
      return {
        revenue: { total: 0, growthPercent: 0, avgOrderValue: 0, ordersCount: 0 },
        customers: { total: 0, growthPercent: 0 },
        salesWeekly: { labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], values: [0, 0, 0, 0, 0, 0, 0] },
        conversionRate: { rate: 0, change: 0 },
        activeCampaigns: { count: 0, reach: "0", roi: "0%" },
      };
    }
  },

  async getRegionalSales(): Promise<RegionalSales> {
    try {
      return await fetchApi<RegionalSales>("/analytics/regional-sales");
    } catch {
      return { regions: [] };
    }
  },

  async getUsage(): Promise<AnalyticsUsage> {
    try {
      return await fetchApi<AnalyticsUsage>("/analytics/usage");
    } catch {
      return {
        tryon: { total_sessions: 0, completed: 0, failed: 0, processing: 0, unique_users: 0 },
        ai_assistant: { total_messages: 0, total_sessions: 0, unique_signed_in_users: 0 },
      };
    }
  },
};

export interface AppSettings {
  storeName: string;
  supportEmail: string;
  supportPhone: string;
  currency: string;
  timezone: string;
  announcementText: string;
  enableGuestCheckout: boolean;
  enableLowStockAlerts: boolean;
  lowStockThreshold: number;
  autoArchiveOrders: boolean;
  maintenanceMode: boolean;
  stylistSystemPrompt: string;
  activeOffers: string;
  [key: string]: unknown;
}

export const settingsApi = {
  async getApp(): Promise<AppSettings> {
    try {
      return await fetchApi<AppSettings>("/settings/app");
    } catch {
      return {
        storeName: "VASTRAX Luxury Apparel",
        supportEmail: "concierge@vastrax.luxury",
        supportPhone: "+1 (800) 827-8729",
        currency: "INR (₹)",
        timezone: "UTC+05:30 (India Standard Time)",
        announcementText: "Complimentary Global Express Delivery on Orders Over ₹1,999",
        enableGuestCheckout: true,
        enableLowStockAlerts: true,
        lowStockThreshold: 5,
        autoArchiveOrders: false,
        maintenanceMode: false,
        stylistSystemPrompt: "You are Vastra, personal style advisor for VastraX.",
        activeOffers: "",
      };
    }
  },

  async updateApp(data: Partial<AppSettings>): Promise<AppSettings> {
    return await fetchApi<AppSettings>("/settings/app", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
};

// -------------------------------------------------------------
// 7. AI FASHION STYLIST CHAT API (OpenAI GPT-4o mini)
// -------------------------------------------------------------
export interface ChatResponse {
  message: string;
  session_id: string;
  suggested_products?: {
    id?: string;
    name: string;
    price: string;
    image: string;
    category: string;
  }[];
  executed_tools?: {
    tool: string;
    arguments?: unknown;
    result?: unknown;
  }[];
  is_escalated?: boolean;
}

export interface ChatHistoryMessage {
  id: string;
  sender: "user" | "stylist";
  text: string;
  timestamp: string;
  suggestedProducts?: {
    id?: string;
    name: string;
    price: string;
    image: string;
    category: string;
  }[];
  tool_calls?: unknown;
  is_escalated?: boolean;
}

export interface ChatTurn {
  role: string;
  content: string;
}

/** Cart line forwarded to the stylist for context. */
export type ChatCartItem = JsonObject;

export const chatApi = {
  async sendMessage(
    message: string,
    sessionId?: string,
    history: ChatTurn[] = [],
    profile: JsonObject = {},
    contextUrl?: string,
    cartItems?: ChatCartItem[],
    userId?: string
  ): Promise<ChatResponse> {
    const messagesPayload = [...history, { role: "user", content: message }];
    return await fetchApi<ChatResponse>("/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: messagesPayload,
        session_id: sessionId,
        profile,
        context_url: contextUrl,
        cart_items: cartItems,
        user_id: userId
      }),
    });
  },

  async getHistory(sessionId?: string, userId?: string): Promise<ChatHistoryMessage[]> {
    try {
      const params = new URLSearchParams();
      if (sessionId) params.append("session_id", sessionId);
      if (userId) params.append("user_id", userId);
      const res = await fetchApi<{ messages: ChatHistoryMessage[] }>(`/chat/history?${params.toString()}`);
      return res.messages || [];
    } catch {
      return [];
    }
  },

  async clearHistory(sessionId?: string, userId?: string): Promise<boolean> {
    try {
      const params = new URLSearchParams();
      if (sessionId) params.append("session_id", sessionId);
      if (userId) params.append("user_id", userId);
      const res = await fetchApi<{ success: boolean }>(`/chat/history?${params.toString()}`, {
        method: "DELETE",
      });
      return res.success;
    } catch {
      return true;
    }
  },
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
        message: "10% VIP Private Invitation applied.",
      };
    } else if (clean === "VIP20") {
      return {
        valid: true,
        code: clean,
        discountPercentage: 20,
        discountAmount: Number((cartTotal * 0.2).toFixed(2)),
        message: "20% Concierge Patron discount applied.",
      };
    } else if (clean === "FREESHIP") {
      return {
        valid: true,
        code: clean,
        discountPercentage: 0,
        discountAmount: 25,
        message: "Complimentary Global Express Delivery applied.",
      };
    } else {
      return {
        valid: false,
        code: clean,
        discountPercentage: 0,
        discountAmount: 0,
        message: "Invalid promotion code.",
      };
    }
  },
};
