import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Client server-only com a service role key: ignora RLS (nenhuma policy foi
// criada nas tabelas de propósito) e nunca deve ser importado em código que
// roda no browser. A autenticação da aplicação é feita pelo NextAuth
// (ver src/auth.ts), não pelo Supabase Auth — por isso não há sessão de
// usuário do Supabase aqui, só a conexão de serviço.
export const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
