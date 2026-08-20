import { formatarData, formatarMoeda } from "@/lib/format";
import { calcularTotais, formatarNumeroProposta } from "@/lib/proposta";
import { aplicarDesconto } from "@/app/(app)/orcamentos/actions";
import { AjustesComerciaisForm } from "@/components/orcamentos/ajustes-comerciais-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ItemMaterial = {
  quantidade: number;
  subtotal: number;
  custoUnitarioNoMomento: number;
  material: { descricao: string; categoria: string; unidade: string; codigo: string } | null;
};

type Alocacao = {
  diasAlocados: number;
  custoCalculado: number;
  funcao: { nome: string } | null;
};

type PropostaResumo = {
  numero: number;
  ano: number;
  revisao: number;
  valorFinal: number;
  geradoEm: string;
};

function percentual(parte: number, total: number) {
  if (total <= 0) return "—";
  return `${((parte / total) * 100).toFixed(1)}%`;
}

export function ResumoCustos({
  orcamentoId,
  itens,
  maoObra,
  bdiPersonalizado,
  impostosPersonalizado,
  bdiPadrao,
  impostosPadrao,
  ajusteMaoObraPercent,
  descontoPercent,
  margemMinima,
  podeEditar,
  ultimaProposta,
}: {
  orcamentoId: string;
  itens: ItemMaterial[];
  maoObra: Alocacao[];
  bdiPersonalizado: number | null;
  impostosPersonalizado: number | null;
  bdiPadrao: number;
  impostosPadrao: number;
  ajusteMaoObraPercent: number;
  descontoPercent: number;
  margemMinima: number;
  podeEditar: boolean;
  ultimaProposta: PropostaResumo | null;
}) {
  const custoMateriais = itens.reduce((acc, i) => acc + i.subtotal, 0);
  const custoMaoObra = maoObra.reduce((acc, m) => acc + m.custoCalculado, 0);

  const entradaBase = {
    custoMateriais,
    custoMaoObra,
    percentualBdi: bdiPersonalizado ?? bdiPadrao,
    percentualImpostos: impostosPersonalizado ?? impostosPadrao,
    percentualAjusteMaoObra: ajusteMaoObraPercent,
  };

  const totais = calcularTotais({ ...entradaBase, percentualDesconto: descontoPercent });

  // Simulações de fechamento: quanto sobra de margem em cada faixa de desconto.
  const sugestoes = [1, 2, 3, 4, 5].map((percentual) => {
    const simulado = calcularTotais({ ...entradaBase, percentualDesconto: percentual });
    return {
      percentual,
      valorFinal: simulado.valorFinal,
      valorDesconto: simulado.valorDesconto,
      margemPercent: simulado.margemPercent,
      abaixoDoMinimo: simulado.margemPercent < margemMinima,
      aplicado: Math.abs(descontoPercent - percentual) < 0.001,
    };
  });

  // Materiais agrupados por categoria, do maior para o menor valor.
  const porCategoria = [...
    itens
      .reduce((mapa, item) => {
        const categoria = item.material?.categoria ?? "Sem categoria";
        const atual = mapa.get(categoria) ?? { quantidadeItens: 0, valor: 0 };
        mapa.set(categoria, {
          quantidadeItens: atual.quantidadeItens + 1,
          valor: atual.valor + item.subtotal,
        });
        return mapa;
      }, new Map<string, { quantidadeItens: number; valor: number }>())
      .entries()
  ].sort((a, b) => b[1].valor - a[1].valor);

  const totalDias = maoObra.reduce((acc, m) => acc + m.diasAlocados, 0);
  const vazio = itens.length === 0 && maoObra.length === 0;

  // O valor da última proposta é um retrato do momento em que ela foi emitida;
  // divergir do total atual significa que o orçamento mudou depois disso.
  const propostaDesatualizada =
    ultimaProposta !== null && Math.abs(ultimaProposta.valorFinal - totais.valorFinal) > 0.01;

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Materiais</CardDescription>
            <CardTitle className="text-lg">{formatarMoeda(custoMateriais)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {itens.length} item(ns) · {percentual(custoMateriais, totais.custoDireto)} do custo
            direto
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Mão de obra</CardDescription>
            <CardTitle className="text-lg">{formatarMoeda(totais.custoMaoObra)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {maoObra.length} alocação(ões) · {totalDias} dia(s)
            {totais.percentualAjusteMaoObra !== 0 && (
              <>
                {" "}
                · ajuste de {totais.percentualAjusteMaoObra > 0 ? "+" : ""}
                {totais.percentualAjusteMaoObra}%
              </>
            )}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Valor de venda</CardDescription>
            <CardTitle className="text-lg">{formatarMoeda(totais.valorFinal)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            custo direto + BDI + impostos
            {totais.percentualDesconto > 0 && ` − ${totais.percentualDesconto}% de desconto`}
          </CardContent>
        </Card>
      </div>

      {vazio && (
        <p className="text-sm text-muted-foreground">
          Nenhum custo lançado ainda. Use as abas <strong>Materiais</strong> e{" "}
          <strong>Mão de obra</strong> para compor o orçamento.
        </p>
      )}

      {itens.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Materiais por categoria</h3>
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Itens</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">% dos materiais</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porCategoria.map(([categoria, dados]) => (
                  <TableRow key={categoria}>
                    <TableCell>{categoria}</TableCell>
                    <TableCell className="text-right">{dados.quantidadeItens}</TableCell>
                    <TableCell className="text-right">{formatarMoeda(dados.valor)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {percentual(dados.valor, custoMateriais)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-medium">
                    Total de materiais
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatarMoeda(custoMateriais)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </div>
      )}

      {itens.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Detalhamento dos materiais</h3>
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Un.</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                  <TableHead className="text-right">Custo unit.</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((item, indice) => (
                  <TableRow key={indice}>
                    <TableCell className="font-mono text-xs">{item.material?.codigo}</TableCell>
                    <TableCell>{item.material?.descricao}</TableCell>
                    <TableCell>{item.material?.unidade}</TableCell>
                    <TableCell className="text-right">{item.quantidade}</TableCell>
                    <TableCell className="text-right">
                      {formatarMoeda(item.custoUnitarioNoMomento)}
                    </TableCell>
                    <TableCell className="text-right">{formatarMoeda(item.subtotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {maoObra.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Mão de obra alocada</h3>
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Função</TableHead>
                  <TableHead className="text-right">Dias</TableHead>
                  <TableHead className="text-right">Custo/dia</TableHead>
                  <TableHead className="text-right">Custo total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {maoObra.map((alocacao, indice) => (
                  <TableRow key={indice}>
                    <TableCell>{alocacao.funcao?.nome ?? "—"}</TableCell>
                    <TableCell className="text-right">{alocacao.diasAlocados}</TableCell>
                    <TableCell className="text-right">
                      {formatarMoeda(alocacao.custoCalculado / alocacao.diasAlocados)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatarMoeda(alocacao.custoCalculado)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-medium">
                    Total de mão de obra
                  </TableCell>
                  <TableCell className="text-right">{totalDias}</TableCell>
                  <TableCell />
                  <TableCell className="text-right font-bold">
                    {formatarMoeda(custoMaoObra)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold mb-2">Formação do preço de venda</h3>
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Componente</TableHead>
                <TableHead className="text-right">% do valor de venda</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Materiais</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {percentual(custoMateriais, totais.valorFinal)}
                </TableCell>
                <TableCell className="text-right">{formatarMoeda(custoMateriais)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Mão de obra</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {percentual(totais.custoMaoObraBase, totais.valorFinal)}
                </TableCell>
                <TableCell className="text-right">
                  {formatarMoeda(totais.custoMaoObraBase)}
                </TableCell>
              </TableRow>
              {totais.percentualAjusteMaoObra !== 0 && (
                <TableRow>
                  <TableCell>
                    Ajuste na mão de obra ({totais.percentualAjusteMaoObra > 0 ? "+" : ""}
                    {totais.percentualAjusteMaoObra}%)
                  </TableCell>
                  <TableCell />
                  <TableCell className="text-right">
                    {formatarMoeda(totais.valorAjusteMaoObra)}
                  </TableCell>
                </TableRow>
              )}
              <TableRow>
                <TableCell className="font-medium">Custo direto</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {percentual(totais.custoDireto, totais.valorFinal)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatarMoeda(totais.custoDireto)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  BDI ({totais.percentualBdi}%){" "}
                  <Badge variant="outline" className="ml-1">
                    {bdiPersonalizado !== null ? "personalizado" : "padrão"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {percentual(totais.valorBdi, totais.valorFinal)}
                </TableCell>
                <TableCell className="text-right">{formatarMoeda(totais.valorBdi)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  Impostos ({totais.percentualImpostos}%){" "}
                  <Badge variant="outline" className="ml-1">
                    {impostosPersonalizado !== null ? "personalizado" : "padrão"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {percentual(totais.valorImpostos, totais.valorFinal)}
                </TableCell>
                <TableCell className="text-right">{formatarMoeda(totais.valorImpostos)}</TableCell>
              </TableRow>
              {totais.percentualDesconto > 0 && (
                <>
                  <TableRow>
                    <TableCell className="font-medium">Preço sem desconto</TableCell>
                    <TableCell />
                    <TableCell className="text-right font-medium">
                      {formatarMoeda(totais.subtotal)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-destructive">
                      Desconto de negociação ({totais.percentualDesconto}%)
                    </TableCell>
                    <TableCell />
                    <TableCell className="text-right text-destructive">
                      − {formatarMoeda(totais.valorDesconto)}
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">Valor final de venda</TableCell>
                <TableCell />
                <TableCell className="text-right text-base font-bold">
                  {formatarMoeda(totais.valorFinal)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          BDI e impostos são aplicados em cascata sobre o custo direto; o desconto incide sobre o
          preço final. Os percentuais padrão vêm de Cadastros → Parâmetros. Margem atual:{" "}
          <strong className={totais.margemPercent < margemMinima ? "text-destructive" : ""}>
            {totais.margemPercent.toFixed(1)}%
          </strong>{" "}
          (mínima {margemMinima}%).
        </p>
      </div>

      {!vazio && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Margem de negociação</h3>
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Desconto</TableHead>
                  <TableHead className="text-right">Abatimento</TableHead>
                  <TableHead className="text-right">Preço ao cliente</TableHead>
                  <TableHead className="text-right">Margem restante</TableHead>
                  {podeEditar && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sugestoes.map((s) => (
                  <TableRow key={s.percentual}>
                    <TableCell className="font-medium">{s.percentual}%</TableCell>
                    <TableCell className="text-right text-destructive">
                      − {formatarMoeda(s.valorDesconto)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatarMoeda(s.valorFinal)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={s.abaixoDoMinimo ? "text-destructive font-medium" : ""}>
                        {s.margemPercent.toFixed(1)}%
                      </span>
                      {s.abaixoDoMinimo && (
                        <Badge variant="destructive" className="ml-2">
                          abaixo do mínimo
                        </Badge>
                      )}
                    </TableCell>
                    {podeEditar && (
                      <TableCell className="text-right">
                        {s.aplicado ? (
                          <Badge variant="secondary">aplicado</Badge>
                        ) : (
                          <form
                            action={async () => {
                              "use server";
                              await aplicarDesconto(orcamentoId, s.percentual);
                            }}
                          >
                            <Button type="submit" variant="ghost" size="sm">
                              Aplicar
                            </Button>
                          </form>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Simulações sobre os valores atuais. Aplicar um desconto grava no orçamento e passa a
            valer na próxima revisão da proposta — use{" "}
            <strong>0%</strong> nos ajustes acima para removê-lo.
          </p>
        </div>
      )}

      {podeEditar && (
        <AjustesComerciaisForm
          orcamentoId={orcamentoId}
          bdiPersonalizado={bdiPersonalizado}
          bdiPadrao={bdiPadrao}
          ajusteMaoObraPercent={ajusteMaoObraPercent}
          descontoPercent={descontoPercent}
        />
      )}

      {ultimaProposta && (
        <div className="rounded-md border bg-card p-4 text-sm">
          <p>
            Última proposta emitida:{" "}
            <strong>
              {formatarNumeroProposta(
                ultimaProposta.numero,
                ultimaProposta.ano,
                ultimaProposta.revisao
              )}
            </strong>{" "}
            em {formatarData(ultimaProposta.geradoEm)} — {formatarMoeda(ultimaProposta.valorFinal)}
          </p>
          {propostaDesatualizada && (
            <p className="text-destructive mt-1">
              O orçamento mudou desde então (diferença de{" "}
              {formatarMoeda(Math.abs(totais.valorFinal - ultimaProposta.valorFinal))}). Gere uma
              nova proposta para refletir os valores atuais.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
