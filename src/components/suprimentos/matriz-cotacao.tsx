"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, TrendingDown } from "lucide-react";
import { salvarEscolha } from "@/app/(app)/suprimentos/requisicoes/cotacao-actions";
import {
  ROTULO_FRETE,
  ROTULO_NIVEL,
  nivelExigido,
  type ModalidadeFrete,
} from "@/lib/suprimentos";
import {
  escolhaMenorPreco,
  escolhaUnica,
  menoresPrecos,
  moeda,
  precoUnitarioBr,
  resumoEscolha,
  subtotalCotacao,
  totalLinha,
  type CotacaoParaCalculo,
} from "@/lib/suprimentos-cotacao";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EnviarAprovacao } from "@/components/suprimentos/enviar-aprovacao";

export type CotacaoMatriz = CotacaoParaCalculo & {
  frete: ModalidadeFrete;
  coletaPropria: boolean;
  ufOrigem: string | null;
  incideDifal: boolean;
  condicaoPagamento: string;
  prazoEntregaDias: number | null;
  /** Faturada direto em nome do cliente da obra. */
  faturadoCliente: boolean;
  /** Empresa do grupo faturada (nome curto). */
  empresa: string | null;
  temAutorizacao: boolean;
};

type ItemMatriz = { id: string; ordem: number; descricao: string; quantidade: number; unidade: string };

// Comparativo lado a lado: uma coluna por fornecedor, menor preço de cada item
// em verde. Com `editavel`, clicar num preço escolhe aquele fornecedor para o
// item; os atalhos fazem "menor preço por item" (compra dividida) ou "tudo de
// um fornecedor" (compra unificada).

export function MatrizCotacao({
  requisicaoId,
  itens,
  cotacoes,
  escolhasIniciais,
  limites,
  editavel,
  envio,
}: {
  requisicaoId: string;
  itens: ItemMatriz[];
  cotacoes: CotacaoMatriz[];
  escolhasIniciais: Record<string, string | null>;
  limites: { limiteComprador: number; limiteGerencia: number };
  editavel: boolean;
  /** Na mesa do comprador: habilita o envio para aprovação. */
  envio?: { itensSemProduto: number; minimoCotacoes: number };
}) {
  const [escolhas, setEscolhas] = useState(escolhasIniciais);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [gravando, iniciar] = useTransition();

  const menores = useMemo(() => menoresPrecos(itens, cotacoes), [itens, cotacoes]);
  const resumo = resumoEscolha(itens, cotacoes, escolhas);
  const alterado = itens.some((i) => (escolhas[i.id] ?? null) !== (escolhasIniciais[i.id] ?? null));

  // Referência para a decisão unificada × dividida: a cotação completa mais barata.
  const melhorUnica = cotacoes
    .map((c) => ({ c, ...subtotalCotacao(c, itens) }))
    .filter((x) => x.completa)
    .sort((a, b) => a.total - b.total)[0];

  function mudar(novas: Record<string, string | null>) {
    setEscolhas(novas);
    setSalvo(false);
    setErro(null);
  }

  function salvar() {
    iniciar(async () => {
      const resultado = await salvarEscolha(requisicaoId, escolhas);
      if (resultado?.erro) setErro(resultado.erro);
      else setSalvo(true);
    });
  }

  if (cotacoes.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma cotação lançada ainda.</p>;
  }

  // Mesma regra do banco: a alçada olha o que sai do caixa da empresa; compra
  // faturada para o cliente passa ao menos pela gerência.
  const totalCliente = resumo.fornecedores
    .filter((f) => cotacoes.find((c) => c.id === f.cotacaoId)?.faturadoCliente)
    .reduce((soma, f) => soma + f.total, 0);
  const nivelEmpresa = nivelExigido(resumo.total - totalCliente, limites);
  const nivel =
    resumo.fornecedores.length === 0
      ? null
      : totalCliente > 0 && nivelEmpresa === "comprador"
        ? "gerencia"
        : nivelEmpresa;
  const semAutorizacao = resumo.fornecedores.filter(
    (f) => {
      const c = cotacoes.find((x) => x.id === f.cotacaoId);
      return c?.faturadoCliente && !c.temAutorizacao;
    }
  ).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 align-bottom">
              <th className="sticky left-0 z-10 bg-muted/40 p-2 text-left font-medium min-w-48">Item</th>
              {cotacoes.map((c) => (
                <th key={c.id} className="p-2 text-left font-medium min-w-40">
                  <span className="block">{c.fornecedor}</span>
                  <span className="block text-xs font-normal text-muted-foreground">{c.ufOrigem ?? "—"}</span>
                  {editavel && (
                    <button
                      type="button"
                      onClick={() => mudar(escolhaUnica(itens, c))}
                      className="mt-1 text-xs font-normal text-primary hover:underline"
                    >
                      Tudo deste
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="sticky left-0 z-10 bg-card p-2 align-top">
                  <span className="text-muted-foreground mr-1">{item.ordem}.</span>
                  {item.descricao}
                  <span className="block text-xs text-muted-foreground">
                    {item.quantidade.toLocaleString("pt-BR")} {item.unidade}
                  </span>
                </td>
                {cotacoes.map((c) => {
                  const preco = c.precos[item.id];
                  if (!preco) {
                    return (
                      <td key={c.id} className="p-2 align-top text-xs text-muted-foreground">
                        Não cotou
                      </td>
                    );
                  }
                  const menor = menores.get(item.id)?.has(c.id);
                  const escolhido = escolhas[item.id] === preco.cotacaoItemId;
                  const conteudo = (
                    <>
                      <span className="flex items-center gap-1 font-medium tabular-nums">
                        {escolhido && <Check className="h-3.5 w-3.5 text-primary" />}
                        {precoUnitarioBr(preco.precoUnitario)}
                      </span>
                      <span className="block text-xs text-muted-foreground tabular-nums">
                        {moeda(totalLinha(item.quantidade, preco.precoUnitario))}
                      </span>
                    </>
                  );
                  return (
                    <td
                      key={c.id}
                      className={cn("p-1 align-top", menor && "bg-emerald-50 dark:bg-emerald-950/40")}
                    >
                      {editavel ? (
                        <button
                          type="button"
                          aria-pressed={escolhido}
                          onClick={() =>
                            mudar({ ...escolhas, [item.id]: escolhido ? null : preco.cotacaoItemId })
                          }
                          className={cn(
                            "w-full rounded-md border border-transparent p-1 text-left hover:border-border",
                            escolhido && "border-primary ring-1 ring-primary"
                          )}
                        >
                          {conteudo}
                        </button>
                      ) : (
                        <div
                          className={cn(
                            "rounded-md border border-transparent p-1",
                            escolhido && "border-primary"
                          )}
                        >
                          {conteudo}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot className="text-xs">
            {(
              [
                ["Itens cotados", (c: CotacaoMatriz) => moeda(subtotalCotacao(c, itens).valorItens)],
                [
                  "Frete",
                  (c: CotacaoMatriz) =>
                    `${moeda(c.valorFrete)} · ${c.frete === "fob" && c.coletaPropria ? "FOB, coleta própria" : ROTULO_FRETE[c.frete]}`,
                ],
                ["DIFAL", (c: CotacaoMatriz) => (c.incideDifal ? moeda(c.valorDifal) : "Não incide")],
                [
                  "Faturar para",
                  (c: CotacaoMatriz) =>
                    c.faturadoCliente ? (
                      <span>
                        Cliente{" "}
                        {c.temAutorizacao ? (
                          <a
                            href={`/api/suprimentos/cotacoes/${c.id}/autorizacao`}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                          >
                            (ver autorização)
                          </a>
                        ) : (
                          <span className="text-destructive">(sem autorização)</span>
                        )}
                      </span>
                    ) : (
                      (c.empresa ?? "—")
                    ),
                ],
                ["Pagamento", (c: CotacaoMatriz) => c.condicaoPagamento || "—"],
                [
                  "Entrega",
                  (c: CotacaoMatriz) =>
                    c.prazoEntregaDias === null
                      ? "—"
                      : c.prazoEntregaDias === 0
                        ? "Pronta entrega"
                        : `${c.prazoEntregaDias} dia${c.prazoEntregaDias === 1 ? "" : "s"}`,
                ],
              ] as const
            ).map(([rotulo, valor]) => (
              <tr key={rotulo} className="border-b">
                <td className="sticky left-0 z-10 bg-card p-2 text-muted-foreground">{rotulo}</td>
                {cotacoes.map((c) => (
                  <td key={c.id} className="p-2">
                    {valor(c)}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="bg-muted/40 text-sm font-semibold">
              <td className="sticky left-0 z-10 bg-muted/40 p-2">Total da cotação</td>
              {cotacoes.map((c) => {
                const s = subtotalCotacao(c, itens);
                return (
                  <td key={c.id} className="p-2 tabular-nums">
                    {moeda(s.total)}
                    {!s.completa && (
                      <span className="block text-xs font-normal text-muted-foreground">incompleta</span>
                    )}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="grid gap-4 rounded-md border bg-card p-4 md:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-2 text-sm">
          <span className="font-semibold">Compra escolhida</span>
          {resumo.fornecedores.length === 0 ? (
            <span className="text-muted-foreground">Nenhum item com fornecedor escolhido.</span>
          ) : (
            <ul className="flex flex-col gap-1">
              {resumo.fornecedores.map((f) => (
                <li key={f.cotacaoId} className="flex flex-wrap justify-between gap-x-4">
                  <span>
                    {f.fornecedor}{" "}
                    <span className="text-muted-foreground">
                      ({f.itens} {f.itens === 1 ? "item" : "itens"})
                    </span>
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {moeda(f.valorItens)} + frete {moeda(f.valorFrete)}
                    {f.valorDifal > 0 ? ` + DIFAL ${moeda(f.valorDifal)}` : ""} ={" "}
                    <span className="font-medium text-foreground">{moeda(f.total)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {resumo.fornecedores.length > 1 && (
            <span className="text-xs text-muted-foreground">
              Compra dividida: cada fornecedor entra com o frete e o DIFAL dele.
            </span>
          )}
          {resumo.semVencedor > 0 && (
            <span className="text-amber-700 dark:text-amber-400">
              {resumo.semVencedor} {resumo.semVencedor === 1 ? "item" : "itens"} sem fornecedor escolhido.
            </span>
          )}
        </div>

        <div className="flex flex-col items-start gap-1 md:items-end md:text-right">
          <span className="text-xs text-muted-foreground">Total para aprovação</span>
          <span className="text-xl font-semibold tabular-nums">{moeda(resumo.total)}</span>
          {nivel && (
            <span className="text-xs">
              Alçada: <span className="font-medium">{ROTULO_NIVEL[nivel]}</span>
              {nivel === "diretoria" && " (Gerência + Diretoria)"}
            </span>
          )}
          {melhorUnica && resumo.semVencedor === 0 && resumo.fornecedores.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingDown className="h-3.5 w-3.5" />
              {resumo.total < melhorUnica.total
                ? `${moeda(melhorUnica.total - resumo.total)} abaixo de tudo com ${melhorUnica.c.fornecedor}`
                : resumo.total > melhorUnica.total
                  ? `${moeda(resumo.total - melhorUnica.total)} acima de tudo com ${melhorUnica.c.fornecedor}`
                  : `Igual a tudo com ${melhorUnica.c.fornecedor}`}
            </span>
          )}
        </div>
      </div>

      {editavel && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => mudar(escolhaMenorPreco(itens, cotacoes))}>
            Menor preço por item
          </Button>
          <Button type="button" onClick={salvar} disabled={gravando || !alterado}>
            {gravando ? "Salvando..." : "Salvar escolha"}
          </Button>
          {alterado && !gravando && <span className="text-xs text-amber-700 dark:text-amber-400">Escolha não salva</span>}
          {salvo && !alterado && <span className="text-xs text-muted-foreground">Escolha salva.</span>}
          {erro && <span className="text-sm text-destructive">{erro}</span>}
        </div>
      )}

      {editavel && envio && nivel && (
        <EnviarAprovacao
          requisicaoId={requisicaoId}
          total={resumo.total}
          nivel={nivel}
          cotacoes={cotacoes.length}
          minimoCotacoes={envio.minimoCotacoes}
          pendencias={[
            ...(envio.itensSemProduto > 0
              ? [`${envio.itensSemProduto} ${envio.itensSemProduto === 1 ? "item sem vínculo" : "itens sem vínculo"} ao catálogo`]
              : []),
            ...(resumo.semVencedor > 0
              ? [`${resumo.semVencedor} ${resumo.semVencedor === 1 ? "item" : "itens"} sem fornecedor escolhido`]
              : []),
            ...(alterado ? ["Salve a escolha antes de enviar"] : []),
            ...(semAutorizacao > 0 ? ["Anexe a autorização do cliente na cotação faturada em nome dele"] : []),
          ]}
        />
      )}
    </div>
  );
}
