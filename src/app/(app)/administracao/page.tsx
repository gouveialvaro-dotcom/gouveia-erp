import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { acessoModulo, usuarioIdAtual } from "@/lib/pagina-auth";
import { podeEscrever, type Perfil } from "@/lib/permissoes";
import { cn } from "@/lib/utils";
import { COLUNAS_USUARIO } from "@/components/administracao/colunas";
import { UsuarioLinha } from "@/components/administracao/usuario-linha";
import { NovoUsuarioDialog } from "@/components/administracao/novo-usuario-dialog";

export default async function PaginaAdministracao() {
  const { perfil } = await acessoModulo("administracao");
  if (!podeEscrever(perfil, "administracao")) redirect("/");

  // Id conferido no banco, não o do JWT: é ele que a action de exclusão compara
  // para recusar o auto-apagamento, e a tela precisa esconder o mesmo botão.
  const meuId = await usuarioIdAtual();

  const { data } = await supabase
    .from("Usuario")
    .select("id, nome, email, perfil, ativo, notificaWhatsappSemDono")
    .order("nome");

  const usuarios = data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Administração</h1>
          <p className="text-sm text-muted-foreground">
            Perfil de acesso e situação — {usuarios.length} usuário(s).
          </p>
        </div>
        <NovoUsuarioDialog />
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
          <span>Aviso de WhatsApp</span>
          <span />
        </div>

        {usuarios.map((u) => (
          <UsuarioLinha
            // Remonta a linha quando o servidor devolve valores novos: os
            // campos são não controlados e o Base UI reclama de defaultChecked
            // trocando depois da montagem.
            key={`${u.id}|${u.perfil}|${u.ativo}|${u.notificaWhatsappSemDono}`}
            ehVoce={u.id === meuId}
            usuario={{
              id: u.id,
              nome: u.nome,
              email: u.email,
              perfil: u.perfil as Perfil,
              ativo: u.ativo,
              notificaWhatsappSemDono: u.notificaWhatsappSemDono,
            }}
          />
        ))}
      </div>

      <div className="rounded-md border bg-card p-3 text-sm">
        <p className="font-medium mb-1">Quem recebe aviso do pós-venda</p>
        <p className="text-muted-foreground">
          Não se marca mais aqui. O aviso de cada chamado vai para o responsável dele —
          apontado na abertura — e, quando o caso vence, para e é atualizado, também para
          os administradores ativos. Trocar o dono é feito na tela do próprio chamado.
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Quem já tem orçamento, chamado, mensagem ou proposta no nome não pode ser
        excluído — o histórico ficaria sem autor. Nesse caso, desmarque &quot;Ativo&quot;:
        o login para de funcionar e os registros antigos continuam de pé. A redefinição de
        senha de quem já existe continua pelo seed do banco (<code>npm run seed</code>).
      </p>
    </div>
  );
}
