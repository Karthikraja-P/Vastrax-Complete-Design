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
        // Return the real user data passed from the successful backend OTP verification
        if (credentials?.email && credentials?.name) {
          return {
            id: credentials.id || "1",
            name: credentials.name,
            email: credentials.email,
            accessToken: credentials.accessToken,
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
