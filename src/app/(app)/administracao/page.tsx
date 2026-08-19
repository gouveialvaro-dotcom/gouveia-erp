import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever, type Perfil } from "@/lib/permissoes";
import { cn } from "@/lib/utils";
import {
  COLUNAS_USUARIO,
  UsuarioLinha,
} from "@/components/administracao/usuario-linha";

export default async function PaginaAdministracao() {
  const { perfil } = await acessoModulo("administracao");
  if (!podeEscrever(perfil, "administracao")) redirect("/");

  const { data } = await supabase
    .from("Usuario")
    .select("id, nome, email, perfil, ativo, notificaPosVenda")
    .order("nome");

  const usuarios = data ?? [];
  const recebemAvisos = usuarios.filter((u) => u.ativo && u.notificaPosVenda);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Administração</h1>
        <p className="text-sm text-muted-foreground">
          Perfil de acesso e destinatários das notificações — {usuarios.length} usuário(s).
        </p>
      </div>

      <div className="rounded-md border bg-card divide-y">
        <div
          className={cn(
            "hidden md:grid gap-3 px-3 py-2 text-xs text-muted-foreground",
            COLUNAS_USUARIO
          )}
        >
          <span>Usuário</span>
          <span>Perfil</span>
          <span>Situação</span>
          <span>Notificações do pós-venda</span>
          <span />
        </div>

        {usuarios.map((u) => (
          <UsuarioLinha
            // Remonta a linha quando o servidor devolve valores novos: os
            // campos são não controlados e o Base UI reclama de defaultChecked
            // trocando depois da montagem.
            key={`${u.id}|${u.perfil}|${u.ativo}|${u.notificaPosVenda}`}
            usuario={{
              id: u.id,
              nome: u.nome,
              email: u.email,
              perfil: u.perfil as Perfil,
              ativo: u.ativo,
              notificaPosVenda: u.notificaPosVenda,
            }}
          />
        ))}
      </div>

      <div className="rounded-md border bg-card p-3 text-sm">
        <p className="font-medium mb-1">Quem recebe aviso do pós-venda hoje</p>
        {recebemAvisos.length > 0 ? (
          <p className="text-muted-foreground">
            {recebemAvisos.map((u) => u.nome).join(", ")}
          </p>
        ) : (
          <p className="text-destructive">
            Ninguém. Chamados vencidos e atualizações não vão avisar nenhum usuário até
            alguém ser marcado acima.
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        A criação de usuários e a redefinição de senha continuam pelo seed do banco
        (<code>npm run seed</code>) — não faziam parte deste escopo.
      </p>
    </div>
  );
}
