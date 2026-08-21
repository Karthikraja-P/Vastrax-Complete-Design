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

        // Admin dummy credential verification
        if (credentials.email.toLowerCase() === "admin@vastrax.com" && credentials.password === "admin123") {
          return {
            id: credentials.id || "admin-1",
            name: "Admin",
            email: "admin@vastrax.com",
            role: "admin",
            accessToken: credentials.accessToken || "admin_dummy_token",
          };
        }

        // Customer dummy credential verification
        if (credentials.email.toLowerCase() === "customer@vastrax.com") {
          return {
            id: credentials.id || "customer-1",
            name: "Demo Customer",
            email: "customer@vastrax.com",
            role: "customer",
            accessToken: credentials.accessToken || "customer_dummy_token",
          };
        }

        // Generic user credential login
        if (credentials.password) {
          return {
            id: credentials.id || "user-1",
            name: credentials.name || credentials.email.split("@")[0] || "User",
            email: credentials.email,
            accessToken: credentials.accessToken || "user_dummy_token",
          };
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
