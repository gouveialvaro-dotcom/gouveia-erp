import type { NextAuthConfig } from "next-auth";

// Configuração compatível com o runtime "edge" do middleware.
// Não pode importar Prisma/bcrypt aqui (ver src/auth.ts para o provider real).
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const logado = !!auth?.user;
      const noLogin = nextUrl.pathname.startsWith("/login");

      if (noLogin) {
        if (logado) return Response.redirect(new URL("/", nextUrl));
        return true;
      }

      return logado;
    },
    jwt({ token, user }) {
      if (user) {
        token.perfil = user.perfil;
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.perfil = token.perfil as string;
      }
      return session;
    },
  },
  providers: [], // preenchido em src/auth.ts
} satisfies NextAuthConfig;
