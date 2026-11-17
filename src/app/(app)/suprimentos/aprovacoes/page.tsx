import Link from "next/link";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { contextoSuprimentos, parametrosSuprimentos } from "@/lib/suprimentos-auth";
import {
  PAPEL_DO_NIVEL,
  ROTULO_DECISAO,
  ROTULO_NIVEL,
  codigoRequisicao,
  niveisExigidos,
} from "@/lib/suprimentos";
import { moeda } from "@/lib/suprimentos-cotacao";
import { formatarData, formatarDataHora } from "@/lib/format";
import { BadgeUrgencia } from "@/components/suprimentos/status-requisicao";
import { Badge } from "@/components/ui/badge";

// Central do aprovador: o que espera a decisão dele, o que espera o outro
// nível, e o que ele decidiu por último.

export default async function PaginaAprovacoes() {
  const contexto = await contextoSuprimentos();
  if (!contexto.tem("aprovador_gerencia", "aprovador_diretoria")) redirect("/suprimentos");

  const [{ data: pendentesBrutas }, { data: minhas }, { minimoCotacoes }] = await Promise.all([
    supabase
      .from("Requisicao")
      .select(
        `id, numero, urgencia, prazoDesejado, valorTotal, nivelAlcada, rodadaAprovacao, requisitanteId, enviadaAprovacaoEm,
         obra:Obra(nomeProjeto),
         requisitante:Usuario!Requisicao_requisitanteId_fkey(nome),
         comprador:Usuario!Requisicao_compradorId_fkey(nome),
         aprovacoes:Aprovacao(rodada, nivel, aprovadorId),
         cotacoes:Cotacao(id)`
      )
      .eq("status", "aguardando_aprovacao")
      .order("urgencia", { ascending: false })
      .order("enviadaAprovacaoEm"),
    supabase
      .from("Aprovacao")
      .select("id, decisao, nivel, valorTotal, decididoEm, requisicao:Requisicao(id, numero, obra:Obra(nomeProjeto))")
      .eq("aprovadorId", contexto.usuarioId)
      .neq("nivel", "comprador")
      .order("decididoEm", { ascending: false })
      .limit(15),
    parametrosSuprimentos(),
  ]);

  const linhas = (pendentesBrutas ?? []).map((r) => {
    const daRodada = r.aprovacoes.filter((a) => a.rodada === r.rodadaAprovacao);
    const faltam = niveisExigidos(r.nivelAlcada).filter((n) => !daRodada.some((a) => a.nivel === n));
    const jaDecidi = daRodada.some((a) => a.aprovadorId === contexto.usuarioId);
    const minha =
      !jaDecidi && faltam.some((n) => n !== "comprador" && contexto.tem(PAPEL_DO_NIVEL[n]));
    return { r, faltam, minha };
  });
  const minhasPendentes = linhas.filter((l) => l.minha);
  const deOutros = linhas.filter((l) => !l.minha);

  const lista = (itens: typeof linhas, vazio: string) =>
    itens.length === 0 ? (
      <p className="rounded-md border bg-card p-4 text-sm text-muted-foreground">{vazio}</p>
    ) : (
      <div className="rounded-md border bg-card divide-y">
        {itens.map(({ r, faltam }) => (
          <Link
            key={r.id}
            href={`/suprimentos/requisicoes/${r.id}`}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3 text-sm hover:bg-muted"
          >
            <span className="font-mono font-medium">{codigoRequisicao(r.numero)}</span>
            <BadgeUrgencia urgencia={r.urgencia} />
            <span className="min-w-0 flex-1">
              {r.obra?.nomeProjeto ?? "—"}
              <span className="block text-xs text-muted-foreground">
                {r.requisitante?.nome ?? "—"} · comprador {r.comprador?.nome ?? "—"} · entregar até{" "}
                {formatarData(r.prazoDesejado)}
                {r.requisitanteId === contexto.usuarioId && " · você é o requisitante"}
              </span>
            </span>
            {r.cotacoes.length < minimoCotacoes && (
              <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-400">
                {r.cotacoes.length} {r.cotacoes.length === 1 ? "cotação" : "cotações"}
              </Badge>
            )}
            <span className="text-right">
              <span className="block font-semibold tabular-nums">{moeda(Number(r.valorTotal))}</span>
              <span className="block text-xs text-muted-foreground">
                falta {faltam.map((n) => ROTULO_NIVEL[n]).join(" e ")}
              </span>
            </span>
          </Link>
        ))}
      </div>
    );

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Aguardando você ({minhasPendentes.length})</h2>
        {lista(minhasPendentes, "Nenhuma compra esperando a sua aprovação.")}
      </section>

      {deOutros.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Aguardando outro aprovador ({deOutros.length})</h2>
          {lista(deOutros, "")}
        </section>
      )}

      {(minhas ?? []).length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Suas últimas decisões</h2>
          <div className="rounded-md border bg-card divide-y">
            {(minhas ?? []).map((a) => (
              <Link
                key={a.id}
                href={`/suprimentos/requisicoes/${a.requisicao?.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3 text-sm hover:bg-muted"
              >
                <span className="font-mono">{a.requisicao ? codigoRequisicao(a.requisicao.numero) : "—"}</span>
                <span className="flex-1 text-muted-foreground">{a.requisicao?.obra?.nomeProjeto ?? "—"}</span>
                <Badge variant={a.decisao === "recusada" ? "destructive" : a.decisao === "aprovada" ? "default" : "outline"}>
                  {ROTULO_DECISAO[a.decisao]}
                </Badge>
                <span className="tabular-nums">{moeda(Number(a.valorTotal))}</span>
                <span className="text-xs text-muted-foreground">{formatarDataHora(a.decididoEm)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
