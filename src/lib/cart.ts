/**
 * VASTRAX Unified Cart Manager
 * Centralized cart state management with localStorage persistence and cross-component event sync.
 */

export interface CartItem {
  id: string | number;
  name: string;
  price: number;
  image: string;
  quantity: number;
  size?: string;
  color?: string;
  variantId?: string;
}

const CART_STORAGE_KEY = "vastrax_cart";

/**
 * Safely retrieves all items from the cart.
 */
export function getCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Failed to parse cart from localStorage:", err);
    return [];
  }
}

/**
 * Saves cart items and notifies all subscribers across the application.
 */
export function saveCart(items: CartItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("cart-updated", { detail: { items } }));
  } catch (err) {
    console.error("Failed to save cart to localStorage:", err);
  }
}

/**
 * Adds an item to the shopping bag. If identical item (id + size) exists, increments quantity.
 */
export function addToCart(newItem: Omit<CartItem, "quantity"> & { quantity?: number }): CartItem[] {
  const cart = getCart();
  const qtyToAdd = Math.max(1, newItem.quantity || 1);
  const targetSize = newItem.size || "M";
  const targetColor = newItem.color || "Default";

  const existingIndex = cart.findIndex(
    (item) => String(item.id) === String(newItem.id) && (item.size || "M") === targetSize
  );

  if (existingIndex >= 0) {
    cart[existingIndex].quantity += qtyToAdd;
    if (newItem.image && !cart[existingIndex].image) {
      cart[existingIndex].image = newItem.image;
    }
  } else {
    cart.push({
      id: String(newItem.id),
      name: newItem.name,
      price: typeof newItem.price === "string" ? parseFloat(String(newItem.price).replace(/[^0-9.-]+/g, "")) || 0 : Number(newItem.price) || 0,
      quantity: qtyToAdd,
      size: targetSize,
      color: targetColor,
      image: newItem.image || "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=400&auto=format&fit=crop",
      variantId: newItem.variantId,
    });
  }

  saveCart(cart);
  return cart;
}

/**
 * Updates quantity of a specific cart item. If quantity falls below 1, keeps it at 1.
 */
export function updateCartQuantity(id: string | number, delta: number, size?: string): CartItem[] {
  const cart = getCart();
  const updated = cart.map((item) => {
    const matches = String(item.id) === String(id) && (!size || (item.size || "M") === size);
    if (matches) {
      return { ...item, quantity: Math.max(1, item.quantity + delta) };
    }
    return item;
  });

  saveCart(updated);
  return updated;
}

/**
 * Removes an item from the cart.
 */
export function removeFromCart(id: string | number, size?: string): CartItem[] {
  const cart = getCart();
  const updated = cart.filter((item) => {
    if (size) {
      return !(String(item.id) === String(id) && (item.size || "M") === size);
    }
    return String(item.id) !== String(id);
  });

  saveCart(updated);
  return updated;
}

/**
 * Completely empties the shopping cart.
 */
export function clearCart(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(CART_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("cart-updated", { detail: { items: [] } }));
  } catch (err) {}
}

/**
 * Calculates total count of individual units in the cart.
 */
export function getCartCount(): number {
  const cart = getCart();
  return cart.reduce((acc, item) => acc + (item.quantity || 1), 0);
}

/**
 * Calculates subtotal amount in currency.
 */
export function getCartSubtotal(): number {
  const cart = getCart();
  return cart.reduce((acc, item) => acc + (Number(item.price) || 0) * (item.quantity || 1), 0);
}
