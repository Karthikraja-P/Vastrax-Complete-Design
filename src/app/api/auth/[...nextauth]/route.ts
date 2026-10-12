import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "placeholder-client-id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "placeholder-client-secret",
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        id: { label: "ID", type: "text" },
        name: { label: "Name", type: "text" },
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        accessToken: { label: "Token", type: "text" },
        role: { label: "Role", type: "text" }
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;

        const email = credentials.email.toLowerCase().trim();

        // Verify supplied backend tokens before creating a NextAuth session.
        if (credentials.accessToken && credentials.accessToken !== "undefined") {
          const backendBase = process.env.INTERNAL_BACKEND_URL || "http://backend:8090";
          try {
            const res = await fetch(`${backendBase}/api/v1/auth/me`, {
              headers: { Authorization: `Bearer ${credentials.accessToken}` },
              cache: "no-store",
            });
            if (!res.ok) return null;
            const user = (await res.json()) as { id?: string | number; email?: string; is_active?: boolean; full_name?: string; role?: string; business_permissions?: string[] };
            if (!user?.id || !user?.email || !user?.is_active) return null;
            return {
              id: String(user.id),
              name: user.full_name || user.email.split("@")[0],
              email: user.email,
              role: user.business_permissions?.length ? "business_staff" : user.role || "customer",
              businessPermissions: user.business_permissions || [],
              accessToken: credentials.accessToken,
            };
          } catch {
            return null;
          }
        }

        // Direct authentication against FastAPI backend
        const internalUrl = process.env.INTERNAL_BACKEND_URL
          ? `${process.env.INTERNAL_BACKEND_URL}/api/v1/auth/login`
          : "http://backend:8090/api/v1/auth/login";

        const backendUrls = [
          internalUrl,
          "http://backend:8090/api/v1/auth/login",
          "http://localhost:8090/api/v1/auth/login",
          "http://localhost:8088/api/v1/auth/login",
          "http://localhost:8000/api/v1/auth/login"
        ];

        for (const url of backendUrls) {
          try {
            const res = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, password: credentials.password || "" }),
            });

            if (res.ok) {
              const data = (await res.json()) as { user?: { id?: string | number; full_name?: string; email?: string; role?: string; business_permissions?: string[] }; access_token?: string };
              return {
                id: String(data.user?.id || credentials.id || "usr_1"),
                name: data.user?.full_name || credentials.name || email.split("@")[0],
                email: data.user?.email || email,
                role: data.user?.business_permissions?.length ? "business_staff" : data.user?.role || "CUSTOMER",
                businessPermissions: data.user?.business_permissions || [],
                accessToken: data.access_token || "",
              };
            }
          } catch {}
        }

        return null;
      }
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || "CUSTOMER";
        token.accessToken = (user as any).accessToken;
        token.businessPermissions = user.businessPermissions || [];
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        (session as any).user.id = token.id;
        (session as any).user.role = token.role;
        (session as any).accessToken = token.accessToken;
        session.businessPermissions = token.businessPermissions || [];
      }
      return session;
    }
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60, // 1 hour session expiration
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
