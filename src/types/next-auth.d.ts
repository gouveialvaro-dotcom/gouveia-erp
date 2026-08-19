import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      perfil: string;
    } & DefaultSession["user"];
  }

  interface User {
    perfil?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    perfil?: string;
  }
}
