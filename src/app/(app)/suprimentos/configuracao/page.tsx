import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { contextoSuprimentos, parametrosSuprimentos } from "@/lib/suprimentos-auth";
import { ROTULO_PERFIL, type Perfil } from "@/lib/permissoes";
import { FormPapeis, FormAlcadas } from "@/components/suprimentos/configuracao-forms";

export default async function PaginaConfiguracaoSuprimentos() {
  const { ehAdmin } = await contextoSuprimentos();
  if (!ehAdmin) redirect("/suprimentos");

  const [{ data: usuarios }, { data: papeis }, parametros] = await Promise.all([
    supabase.from("Usuario").select("id, nome, email, perfil").eq("ativo", true).order("nome"),
    supabase.from("PapelUsuarioSuprimentos").select("usuarioId, papel"),
    parametrosSuprimentos(),
  ]);

  const marcados = (papeis ?? []).map((p) => `${p.usuarioId}:${p.papel}`);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">Alçadas de aprovação</h2>
          <p className="text-sm text-muted-foreground">
            O valor considerado é o total da requisição: itens + frete + DIFAL de cada
            fornecedor escolhido.
          </p>
        </div>
        <FormAlcadas parametros={parametros} />
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">Papéis no módulo</h2>
          <p className="text-sm text-muted-foreground">
            Qualquer usuário pode abrir requisição. Os papéis abaixo definem quem cota,
            aprova e recebe. O administrador do sistema pode tudo, mesmo sem papel marcado.
          </p>
        </div>
        <FormPapeis
          usuarios={(usuarios ?? []).map((u) => ({
            id: u.id,
            nome: u.nome,
            email: u.email,
            perfil: ROTULO_PERFIL[u.perfil as Perfil] ?? u.perfil,
          }))}
          marcados={marcados}
        />
      </section>
    </div>
  );
}
