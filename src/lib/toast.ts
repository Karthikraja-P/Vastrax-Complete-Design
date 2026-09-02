/**
 * VASTRAX Cyber-Luxury Toast Dispatcher
 */

export interface ToastOptions {
  id?: string;
  title: string;
  description?: string;
  type?: "success" | "error" | "info" | "gold";
  duration?: number;
  image?: string;
}

export function showToast(options: ToastOptions): void {
  if (typeof window === "undefined") return;
  const event = new CustomEvent("vastrax-toast", {
    detail: {
      id: options.id || Math.random().toString(36).substring(2, 9),
      title: options.title,
      description: options.description,
      type: options.type || "gold",
      duration: options.duration || 3500,
      image: options.image,
    },
  });
  window.dispatchEvent(event);
}
