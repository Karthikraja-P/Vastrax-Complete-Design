import { signOut } from "next-auth/react";

/**
 * Cleanly signs out the user across NextAuth, localStorage, and the backend session.
 * @param callbackUrl Destination URL after sign out completes (default: /storefront/home)
 */
export async function performSignOut(callbackUrl: string = "/storefront/home"): Promise<void> {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("vastrax_token");
    if (token) {
      try {
        await fetch("/api/v1/auth/logout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }).catch(() => {});
      } catch {
        // Ignore network errors on logout
      }
      localStorage.removeItem("vastrax_token");
    }
    localStorage.removeItem("vastrax_user");
  }

  await signOut({ callbackUrl, redirect: true });
}
