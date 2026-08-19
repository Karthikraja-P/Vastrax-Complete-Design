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
        name: { label: "Name", type: "text" },
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Mock a successful login for any credentials
        return {
          id: "1",
          name: credentials?.name || "Aishwarya",
          email: credentials?.email || "test@example.com",
        };
      }
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET || "placeholder-nextauth-secret",
});

export { handler as GET, handler as POST };
