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
        accessToken: { label: "Token", type: "text" }
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;

        const email = credentials.email.toLowerCase().trim();

        // If an authenticated token from backend is already present
        if (credentials.accessToken && credentials.accessToken !== "undefined") {
          return {
            id: credentials.id || `usr_${Date.now()}`,
            name: credentials.name || email.split("@")[0] || "User",
            email: email,
            accessToken: credentials.accessToken,
          };
        }

        // Direct authentication against FastAPI backend
        const backendUrls = [
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
              const data = await res.json();
              return {
                id: String(data.user?.id || credentials.id || "usr_1"),
                name: data.user?.full_name || credentials.name || email.split("@")[0],
                email: data.user?.email || email,
                role: data.user?.role || "CUSTOMER",
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
        token.accessToken = (user as any).accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        (session as any).user.id = token.id;
        (session as any).accessToken = token.accessToken;
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET || "placeholder-nextauth-secret",
});

export { handler as GET, handler as POST };
