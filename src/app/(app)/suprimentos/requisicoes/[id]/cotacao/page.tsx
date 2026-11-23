import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { contextoSuprimentos, parametrosSuprimentos } from "@/lib/suprimentos-auth";
import { carregarCotacoes } from "@/lib/suprimentos-cotacao-dados";
import { ROTULO_NIVEL, STATUS_COTACAO_ABERTA, codigoRequisicao,
  nomeCentroCusto,
} from "@/lib/suprimentos";
import { moeda, subtotalCotacao } from "@/lib/suprimentos-cotacao";
import { formatarData } from "@/lib/format";
import { excluirCotacao } from "@/app/(app)/suprimentos/requisicoes/cotacao-actions";
import { BadgeStatusRequisicao, BadgeUrgencia } from "@/components/suprimentos/status-requisicao";
import { AlertaMinimoCotacoes } from "@/components/suprimentos/alerta-cotacoes";
import { MatrizCotacao } from "@/components/suprimentos/matriz-cotacao";
import { VincularProduto } from "@/components/suprimentos/vincular-produto";
import { BotaoExcluir } from "@/components/ui/botao-excluir";
import { Button } from "@/components/ui/button";

// Mesa de trabalho do comprador numa requisição: catálogo, cotações e escolha.

export default async function PaginaCotacao({ params }: { params: Promise<{ id: string }> }) {
  const contexto = await contextoSuprimentos();
  const { id } = await params;
  if (!contexto.tem("comprador")) redirect(`/suprimentos/requisicoes/${id}`);

  const { data: r } = await supabase
    .from("Requisicao")
    .select("id, numero, status, urgencia, prazoDesejado, rodadaAprovacao, obra:Obra(nomeProjeto), centroCusto:CentroCusto(nome), requisitante:Usuario!Requisicao_requisitanteId_fkey(nome)")
    .eq("id", id)
    .maybeSingle();
  if (!r) notFound();

  const [{ itens, cotacoes, cotacoesBrutas, escolhas }, parametros, { data: devolucao }] = await Promise.all([
    carregarCotacoes(r.id),
    parametrosSuprimentos(),
    // A devolução do último envio explica ao comprador o que refazer.
    supabase
      .from("Aprovacao")
      .select("comentario, nivel, aprovador:Usuario!Aprovacao_aprovadorId_fkey(nome)")
      .eq("requisicaoId", id)
      .eq("rodada", r.rodadaAprovacao)
      .eq("decisao", "devolvida")
      .maybeSingle(),
  ]);
  const editavel = STATUS_COTACAO_ABERTA.includes(r.status);
  const codigo = codigoRequisicao(r.numero);
  const vinculados = itens.filter((i) => i.produtoId).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">
              Cotação <span className="font-mono">{codigo}</span>
            </h2>
            <BadgeStatusRequisicao status={r.status} />
            <BadgeUrgencia urgencia={r.urgencia} />
          </div>
          <p className="text-sm text-muted-foreground">
            {nomeCentroCusto(r)} · {r.requisitante?.nome ?? "—"} · entregar até{" "}
            {formatarData(r.prazoDesejado)}
          </p>
          <Link href={`/suprimentos/requisicoes/${r.id}`} className="text-xs text-muted-foreground hover:underline">
            ← Detalhes da requisição
          </Link>
        </div>
      </div>

      {editavel && devolucao && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          <span className="font-medium">
            Devolvida por {devolucao.aprovador?.nome ?? "—"} ({ROTULO_NIVEL[devolucao.nivel]}):
          </span>{" "}
          {devolucao.comentario}
        </div>
      )}

      {!editavel && (
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          {r.status === "aguardando_aprovacao"
            ? "Enviada para aprovação: a cotação fica travada até a decisão. Se o aprovador devolver, ela reabre aqui."
            : "A cotação está fechada nesta situação."}
        </div>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">1. Itens no catálogo</h3>
          <span className="text-xs text-muted-foreground">
            {vinculados} de {itens.length} vinculados
          </span>
        </div>
        <div className="rounded-md border bg-card divide-y">
          {itens.map((item) => (
            <div key={item.id} className="grid gap-1 p-3 sm:grid-cols-2 sm:items-center">
              <div className="text-sm">
                <span className="text-muted-foreground mr-1">{item.ordem}.</span>
                <span className="font-medium">{item.descricao}</span>
                <span className="text-muted-foreground">
                  {" "}· {item.quantidade.toLocaleString("pt-BR")} {item.unidade}
                </span>
                {item.especificacao && (
                  <span className="block text-xs text-muted-foreground whitespace-pre-line">
                    {item.especificacao}
                  </span>
                )}
              </div>
              <VincularProduto
                itemId={item.id}
                descricaoItem={item.descricao}
                produto={item.produto}
                editavel={editavel}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">
            2. Cotações ({cotacoes.length}
            <span className="font-normal text-muted-foreground"> de {parametros.minimoCotacoes} mínimas</span>)
          </h3>
          {editavel && (
            <Button
              size="sm"
              render={<Link href={`/suprimentos/requisicoes/${r.id}/cotacao/nova`} />}
              nativeButton={false}
            >
              <Plus className="h-4 w-4" /> Adicionar cotação
            </Button>
          )}
        </div>
        <AlertaMinimoCotacoes quantidade={cotacoes.length} minimo={parametros.minimoCotacoes} />
        {cotacoes.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {cotacoes.map((c) => {
              const bruta = cotacoesBrutas.find((b) => b.id === c.id);
              const s = subtotalCotacao(c, itens);
              return (
                <div key={c.id} className="flex flex-col gap-2 rounded-md border bg-card p-3 text-sm">
                  <div>
                    <span className="font-medium">{c.fornecedor}</span>
                    <span className="block text-xs text-muted-foreground">
                      {bruta?.vendedor ? `${bruta.vendedor} · ` : ""}
                      {Object.keys(c.precos).length} de {itens.length} itens · {c.condicaoPagamento}
                    </span>
                  </div>
                  <span className="font-semibold tabular-nums">{moeda(s.total)}</span>
                  {editavel && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        render={<Link href={`/suprimentos/requisicoes/${r.id}/cotacao/${c.id}`} />}
                        nativeButton={false}
                      >
                        Editar
                      </Button>
                      <BotaoExcluir
                        acao={excluirCotacao}
                        campos={{ cotacaoId: c.id }}
                        titulo={`Excluir a cotação de ${c.fornecedor}?`}
                        descricao="Os preços dela saem do comparativo e os itens escolhidos dela ficam sem fornecedor."
                        variant="ghost"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">3. Comparativo e escolha</h3>
        {editavel && cotacoes.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Verde = menor preço do item. Clique num preço para escolher aquele fornecedor no item, ou use
            os atalhos para compra dividida (menor preço por item) ou unificada (tudo deste).
          </p>
        )}
        <MatrizCotacao
          // Remonta quando uma cotação ou preço entra/sai (escolha local apontaria
          // para preço que não existe mais); a própria gravação da escolha não remonta.
          key={cotacoes.map((c) => c.id + ":" + Object.values(c.precos).map((p) => p.cotacaoItemId).join(",")).join("|")}
          requisicaoId={r.id}
          itens={itens}
          cotacoes={cotacoes}
          escolhasIniciais={escolhas}
          limites={parametros}
          editavel={editavel}
          envio={{ itensSemProduto: itens.length - vinculados, minimoCotacoes: parametros.minimoCotacoes }}
        />
      </section>
    </div>
  );
}
