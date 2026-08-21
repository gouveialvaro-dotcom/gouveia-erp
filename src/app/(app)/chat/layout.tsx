import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { acessoModulo, usuarioIdAtual } from "@/lib/pagina-auth";
import { podeLer } from "@/lib/permissoes";
import { carregarConversas } from "@/lib/chat-consultas";
import { ListaConversas } from "@/components/chat/lista-conversas";
import { NovaConversa } from "@/components/chat/nova-conversa";

export default async function LayoutChat({ children }: { children: React.ReactNode }) {
  const { perfil } = await acessoModulo("chat");
  if (!podeLer(perfil, "chat")) redirect("/");

  const usuarioId = await usuarioIdAtual();

  const [conversas, { data: usuarios }] = await Promise.all([
    carregarConversas(usuarioId),
    supabase
      .from("Usuario")
      .select("id, nome")
      .eq("ativo", true)
      .neq("id", usuarioId)
      .order("nome", { ascending: true }),
  ]);

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-4">
      <aside className="flex w-72 shrink-0 flex-col rounded-md border bg-card">
        <div className="flex items-center justify-between gap-2 border-b p-3">
          <h1 className="text-sm font-semibold">Chat</h1>
          <NovaConversa usuarios={usuarios ?? []} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <ListaConversas conversas={conversas} />
        </div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col rounded-md border bg-card">
        {children}
      </section>
    </div>
  );
}
