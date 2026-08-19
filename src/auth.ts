import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";
import { supabase } from "@/lib/supabase";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: {},
        senha: {},
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const senha = credentials?.senha as string | undefined;
        if (!email || !senha) return null;

        const { data: usuario } = await supabase
          .from("Usuario")
          .select("*")
          .eq("email", email)
          .maybeSingle();
        if (!usuario || !usuario.ativo) return null;

        const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);
        if (!senhaValida) return null;

        return {
          id: usuario.id,
          name: usuario.nome,
          email: usuario.email,
          perfil: usuario.perfil,
        };
      },
    }),
  ],
});
