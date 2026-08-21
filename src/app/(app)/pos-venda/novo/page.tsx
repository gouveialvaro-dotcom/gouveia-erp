import Link from "next/link";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { clienteIdDaObra, projetoDaObra } from "@/lib/obras";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { ChamadoCriarForm } from "@/components/pos-venda/chamado-criar-form";

export default async function PaginaNovoChamado() {
  const { perfil, userId } = await acessoModulo("posVenda");
  if (!podeEscrever(perfil, "posVenda")) redirect("/pos-venda");

  const [
    { data: clientes },
    { data: unidades },
    { data: obras },
    { data: tipos },
    { data: usuarios },
  ] = await Promise.all([
    // Só energia solar: cliente de redes/subestações não tem contrato de
    // manutenção e não é atendido pelo pós-venda.
    supabase
      .from("Cliente")
      .select("id, razaoSocial, ramo, manutencaoInicio, manutencaoFim")
      .eq("ramo", "energia_solar")
      .order("razaoSocial"),
    supabase
      .from("UnidadeConsumidora")
      .select("id, clienteId, numero, apelido, endereco, tipo, concessionaria:Concessionaria(sigla, nome)")
      .eq("ativo", true)
      .order("numero"),
    supabase
      .from("Obra")
      .select(
        "id, criadoEm, clienteId, nomeProjeto, oportunidade:Oportunidade(clienteId, orcamento:Orcamento(nomeProjeto))"
      )
      .order("criadoEm", { ascending: false }),
    supabase
      .from("TipoProblemaPosVenda")
      .select("id, nome, prazoDias")
      .eq("ativo", true)
      .order("ordem"),
    supabase.from("Usuario").select("id, nome").eq("ativo", true).order("nome"),
  ]);

  return (
    <div className="flex flex-col gap-1">
      <Link href="/pos-venda" className="text-sm text-muted-foreground hover:underline w-fit">
        ← Pós-venda
      </Link>
      <h2 className="text-lg font-semibold mt-2">Novo chamado</h2>
      <p className="text-sm text-muted-foreground mb-4">
        O prazo é calculado automaticamente a partir do tipo de problema escolhido.
      </p>

      {(tipos ?? []).length === 0 && (
        <p className="text-sm text-destructive mb-4">
          Nenhum tipo de problema ativo.{" "}
          <Link href="/cadastros/tipos-problema" className="underline">
            Cadastre os tipos e seus prazos
          </Link>{" "}
          antes de abrir chamados.
        </p>
      )}

      <ChamadoCriarForm
        clientes={(clientes ?? []).map((c) => ({
          id: c.id,
          nome: c.razaoSocial,
          ramo: c.ramo,
          manutencaoInicio: c.manutencaoInicio,
          manutencaoFim: c.manutencaoFim,
        }))}
        unidades={(unidades ?? []).map((u) => ({
          id: u.id,
          clienteId: u.clienteId,
          rotulo: `${u.numero}${u.apelido ? ` — ${u.apelido}` : ""} · ${
            u.tipo === "geradora" ? "geradora" : "beneficiária"
          }${u.endereco ? ` · ${u.endereco}` : ""}`,
        }))}
        obras={(obras ?? []).flatMap((o) => {
          // A obra manual guarda o cliente na própria linha; a de funil, na
          // oportunidade. Antes daqui a manual sumia do seletor de obra.
          const clienteId = clienteIdDaObra(o);
          return clienteId ? [{ id: o.id, clienteId, rotulo: projetoDaObra(o) }] : [];
        })}
        tipos={tipos ?? []}
        usuarios={usuarios ?? []}
        responsavelPadraoId={userId}
      />
    </div>
  );
}
