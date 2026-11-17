"use client";

import Link from "next/link";
import { startTransition, useActionState, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  salvarCotacao,
  type EstadoFormCotacao,
} from "@/app/(app)/suprimentos/requisicoes/cotacao-actions";
import { ROTULO_FRETE, UF_EMPRESA, type ModalidadeFrete } from "@/lib/suprimentos";
import { centavos, moeda, numeroBr, totalLinha } from "@/lib/suprimentos-cotacao";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNativo } from "@/components/ui/select-nativo";
import { Textarea } from "@/components/ui/textarea";

export type FornecedorOpcao = {
  id: string;
  nome: string;
  uf: string | null;
  vendedor: string | null;
};

export type CotacaoInicial = {
  id: string;
  fornecedorId: string;
  vendedor: string | null;
  incideDifal: boolean;
  aliquotaDifal: number | null;
  valorDifal: number;
  frete: ModalidadeFrete;
  coletaPropria: boolean;
  valorFrete: number;
  condicaoPagamento: string;
  prazoEntregaDias: number | null;
  observacoes: string | null;
  precos: Record<string, number>;
};

type ItemCotado = { id: string; ordem: number; descricao: string; quantidade: number; unidade: string };

const br = (n: number | null | undefined, casas = 2) =>
  n === null || n === undefined
    ? ""
    : n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas, useGrouping: false });

export function CotacaoForm({
  requisicaoId,
  cotacao,
  fornecedores,
  itens,
}: {
  requisicaoId: string;
  cotacao: CotacaoInicial | null;
  /** Já sem os fornecedores que têm cotação nesta requisição (exceto o desta). */
  fornecedores: FornecedorOpcao[];
  itens: ItemCotado[];
}) {
  const [estado, acao, pendente] = useActionState<EstadoFormCotacao, FormData>(
    salvarCotacao.bind(null, cotacao?.id ?? null),
    undefined
  );

  const [fornecedorId, setFornecedorId] = useState(cotacao?.fornecedorId ?? "");
  const fornecedor = fornecedores.find((f) => f.id === fornecedorId) ?? null;
  const [vendedor, setVendedor] = useState(cotacao?.vendedor ?? "");
  const [incideDifal, setIncideDifal] = useState(cotacao?.incideDifal ?? false);
  const [aliquota, setAliquota] = useState(br(cotacao?.aliquotaDifal, 4));
  const [valorDifal, setValorDifal] = useState(br(cotacao?.valorDifal || null));
  const [difalEditado, setDifalEditado] = useState(Boolean(cotacao?.valorDifal));
  const [frete, setFrete] = useState<ModalidadeFrete>(cotacao?.frete ?? "cif");
  const [coletaPropria, setColetaPropria] = useState(cotacao?.coletaPropria ?? false);
  const [valorFrete, setValorFrete] = useState(br(cotacao?.valorFrete || null));
  const [condicao, setCondicao] = useState(cotacao?.condicaoPagamento ?? "");
  const [prazo, setPrazo] = useState(br(cotacao?.prazoEntregaDias, 0));
  const [observacoes, setObservacoes] = useState(cotacao?.observacoes ?? "");
  const [precos, setPrecos] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(cotacao?.precos ?? {}).map(([k, v]) => [k, br(v, 4)]))
  );

  const subtotal = useMemo(() => {
    let soma = 0;
    for (const item of itens) {
      const preco = numeroBr(precos[item.id]);
      if (preco !== null && Number.isFinite(preco)) soma += totalLinha(item.quantidade, preco);
    }
    return centavos(soma);
  }, [itens, precos]);

  const aliquotaNumero = numeroBr(aliquota);
  const difalSugerido =
    aliquotaNumero !== null && Number.isFinite(aliquotaNumero) ? centavos((subtotal * aliquotaNumero) / 100) : null;
  // Enquanto o comprador não digitar o valor, o DIFAL acompanha alíquota × itens.
  const difalEfetivo = difalEditado ? valorDifal : difalSugerido !== null ? br(difalSugerido) : "";
  const foraDoEstado = fornecedor?.uf != null && fornecedor.uf !== UF_EMPRESA;

  const total =
    subtotal +
    (incideDifal ? (numeroBr(difalEfetivo) || 0) : 0) +
    (numeroBr(valorFrete) || 0);

  function escolherFornecedor(id: string) {
    setFornecedorId(id);
    const novo = fornecedores.find((f) => f.id === id);
    if (!novo) return;
    if (!vendedor && novo.vendedor) setVendedor(novo.vendedor);
    // Fornecedor de outro estado: DIFAL marcado por padrão (o comprador desmarca
    // se não incidir). Do RN, desmarcado.
    if (!cotacao) setIncideDifal(novo.uf != null && novo.uf !== UF_EMPRESA);
  }

  const precosJson = JSON.stringify(precos);

  return (
    <form
      // Envio manual: com action={} o React limpa o form após um erro e os
      // campos controlados (fornecedor, frete) voltariam ao início.
      onSubmit={(evento) => {
        evento.preventDefault();
        const dados = new FormData(evento.currentTarget);
        startTransition(() => acao(dados));
      }}
      className="flex flex-col gap-6 max-w-4xl"
    >
      <input type="hidden" name="requisicaoId" value={requisicaoId} />
      <input type="hidden" name="precos" value={precosJson} />
      <input type="hidden" name="frete" value={frete} />
      {incideDifal && <input type="hidden" name="incideDifal" value="on" />}
      {coletaPropria && frete === "fob" && <input type="hidden" name="coletaPropria" value="on" />}
      {incideDifal && <input type="hidden" name="valorDifal" value={difalEfetivo} />}

      <section className="grid gap-4 rounded-md border bg-card p-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="fornecedorId">Fornecedor</Label>
            <Link
              href="/suprimentos/fornecedores/novo"
              target="_blank"
              className="text-xs text-muted-foreground hover:underline"
            >
              + Cadastrar fornecedor (nova aba)
            </Link>
          </div>
          <SelectNativo
            id="fornecedorId"
            name="fornecedorId"
            value={fornecedorId}
            onChange={(e) => escolherFornecedor(e.target.value)}
            required
            className="h-10"
          >
            <option value="" disabled>
              Selecione o fornecedor
            </option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
                {f.uf ? ` — ${f.uf}` : ""}
              </option>
            ))}
          </SelectNativo>
          {fornecedores.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Todos os fornecedores ativos já têm cotação aqui. Cadastre outro.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="vendedor">Vendedor</Label>
          <Input id="vendedor" name="vendedor" value={vendedor} onChange={(e) => setVendedor(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="condicaoPagamento">Condição de pagamento</Label>
          <Input
            id="condicaoPagamento"
            name="condicaoPagamento"
            placeholder="Ex.: 28 dias boleto, à vista PIX"
            value={condicao}
            onChange={(e) => setCondicao(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prazoEntregaDias">Prazo de entrega (dias)</Label>
          <Input
            id="prazoEntregaDias"
            name="prazoEntregaDias"
            inputMode="numeric"
            placeholder="0 = pronta entrega"
            value={prazo}
            onChange={(e) => setPrazo(e.target.value.replace(/\D/g, ""))}
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Preços unitários</h3>
        <p className="text-xs text-muted-foreground">
          Deixe em branco o item que este fornecedor não cotou.
        </p>
        <div className="rounded-md border bg-card divide-y">
          {itens.map((item) => {
            const preco = numeroBr(precos[item.id]);
            const invalido = preco !== null && (!Number.isFinite(preco) || preco < 0);
            return (
              <div key={item.id} className="grid gap-2 p-3 sm:grid-cols-[1fr_9rem_8rem] sm:items-center">
                <div className="text-sm">
                  <span className="text-muted-foreground mr-1">{item.ordem}.</span>
                  {item.descricao}
                  <span className="block text-xs text-muted-foreground">
                    {item.quantidade.toLocaleString("pt-BR")} {item.unidade}
                  </span>
                </div>
                <Input
                  aria-label={`Preço unitário do item ${item.ordem}`}
                  inputMode="decimal"
                  placeholder="R$ / un."
                  value={precos[item.id] ?? ""}
                  onChange={(e) => setPrecos((p) => ({ ...p, [item.id]: e.target.value }))}
                  className={cn("h-9 text-right", invalido && "border-destructive")}
                />
                <span className="text-right text-sm tabular-nums text-muted-foreground">
                  {preco !== null && Number.isFinite(preco) ? moeda(totalLinha(item.quantidade, preco)) : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 rounded-md border bg-card p-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label>Frete</Label>
          <div className="grid grid-cols-2 gap-2">
            {(["cif", "fob"] as const).map((modalidade) => (
              <button
                key={modalidade}
                type="button"
                onClick={() => setFrete(modalidade)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  frete === modalidade ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted"
                )}
              >
                {ROTULO_FRETE[modalidade]}
              </button>
            ))}
          </div>
        </div>
        {frete === "fob" && (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox checked={coletaPropria} onCheckedChange={(v) => setColetaPropria(Boolean(v))} />
            Coleta com veículo/motorista próprio
          </label>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="valorFrete">Valor do frete</Label>
          <Input
            id="valorFrete"
            name="valorFrete"
            inputMode="decimal"
            placeholder={frete === "cif" ? "0 se incluso" : "Custo da coleta/transportadora"}
            value={valorFrete}
            onChange={(e) => setValorFrete(e.target.value)}
          />
        </div>
      </section>

      <section className="grid gap-4 rounded-md border bg-card p-4 sm:grid-cols-2">
        {foraDoEstado && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-2 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Fornecedor de {fornecedor?.uf}, fora do {UF_EMPRESA}: confira se incide DIFAL.
          </div>
        )}
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <Checkbox checked={incideDifal} onCheckedChange={(v) => setIncideDifal(Boolean(v))} />
          Incide DIFAL nesta compra
        </label>
        {incideDifal && (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="aliquotaDifal">Alíquota DIFAL (%)</Label>
              <Input
                id="aliquotaDifal"
                name="aliquotaDifal"
                inputMode="decimal"
                placeholder="Ex.: 8"
                value={aliquota}
                onChange={(e) => setAliquota(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="valorDifalVisivel">Valor do DIFAL</Label>
              <Input
                id="valorDifalVisivel"
                inputMode="decimal"
                value={difalEfetivo}
                onChange={(e) => {
                  setValorDifal(e.target.value);
                  setDifalEditado(true);
                }}
              />
              <span className="text-xs text-muted-foreground">
                {difalEditado
                  ? "Valor informado por você."
                  : "Calculado: alíquota × total dos itens. Digite para ajustar."}
              </span>
            </div>
          </>
        )}
      </section>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="observacoes">Observações (opcional)</Label>
        <Textarea
          id="observacoes"
          name="observacoes"
          rows={2}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border bg-muted/40 p-4">
        <div className="text-sm">
          <span className="text-muted-foreground">Itens {moeda(subtotal)}</span>
          <span className="block text-base font-semibold">Total desta cotação: {moeda(centavos(total))}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            render={<Link href={`/suprimentos/requisicoes/${requisicaoId}/cotacao`} />}
            nativeButton={false}
          >
            Voltar
          </Button>
          <Button type="submit" disabled={pendente}>
            {pendente ? "Salvando..." : "Salvar cotação"}
          </Button>
        </div>
      </div>

      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}
    </form>
  );
}
