import "next-auth";
import "next-auth/jwt";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    businessPermissions?: string[];
    user: {
      id?: string;
      role?: string;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    accessToken?: string;
    businessPermissions?: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    accessToken?: string;
    businessPermissions?: string[];
  }
}
