import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { formatarData, formatarMoeda } from "@/lib/format";
import { formatarNumeroProposta, ROTULO_MODELO } from "@/lib/proposta";
import { OrcamentoForm } from "@/components/orcamentos/orcamento-form";
import { AdicionarMaterialForm } from "@/components/orcamentos/adicionar-material-form";
import { AdicionarMaoObraForm } from "@/components/orcamentos/adicionar-mao-obra-form";
import { ResumoCustos } from "@/components/orcamentos/resumo-custos";
import { GerarPropostaDialog } from "@/components/orcamentos/gerar-proposta-dialog";
import { BotaoExcluir } from "@/components/ui/botao-excluir";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  adicionarMaoObraOrcamento,
  adicionarMaterialOrcamento,
  excluirProposta,
  removerMaoObraOrcamento,
  removerMaterialOrcamento,
} from "../actions";

export default async function PaginaEditarOrcamento({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { perfil } = await acessoModulo("orcamentos");
  const { id } = await params;

  const [
    { data: orcamento },
    { data: clientes },
    { data: materiaisData },
    { data: funcionariosData },
    { data: propostasData },
    { data: parametros },
    { data: descricoesPadrao },
  ] = await Promise.all([
    supabase
      .from("Orcamento")
      .select(
        "*, cliente:Cliente(id, razaoSocial), itens:OrcamentoItem(*, material:Material(*)), maoObra:OrcamentoMaoObra(*, funcionario:Funcionario(nome, cargo))"
      )
      .eq("id", id)
      .eq("itens.tipo", "material")
      .order("id", { referencedTable: "itens", ascending: true })
      .order("criadoEm", { referencedTable: "maoObra", ascending: true })
      .maybeSingle(),
    supabase.from("Cliente").select("id, razaoSocial").order("razaoSocial", { ascending: true }),
    supabase.from("Material").select("*").order("descricao", { ascending: true }),
    supabase
      .from("Funcionario")
      .select("*")
      .eq("ativo", true)
      .order("nome", { ascending: true }),
    supabase
      .from("Proposta")
      .select("*, geradoPor:Usuario(nome)")
      .eq("orcamentoId", id)
      .order("revisao", { ascending: false }),
    supabase.from("ParametroGeral").select("*").limit(1).maybeSingle(),
    supabase
      .from("DescricaoPadrao")
      .select("id, nome, tipoProposta, texto")
      .order("nome", { ascending: true }),
  ]);

  if (!orcamento) notFound();

  const materiaisItems = (materiaisData ?? []).map((m) => ({
    value: m.id,
    label: `${m.codigo} · ${m.descricao}`,
  }));
  const funcionariosItems = (funcionariosData ?? []).map((f) => ({
    value: f.id,
    label: `${f.nome} · ${f.cargo}`,
  }));
  const podeEditar = podeEscrever(perfil, "orcamentos");
  const propostas = propostasData ?? [];
  // A listagem vem ordenada por revisão; o resumo compara com a emissão mais
  // recente no tempo, que é o retrato que foi de fato enviado ao cliente.
  const ultimaProposta =
    propostas.length > 0
      ? propostas.reduce((maisRecente, p) =>
          p.geradoEm > maisRecente.geradoEm ? p : maisRecente
        )
      : null;
  const custoTotalMateriais = orcamento.itens.reduce((acc, item) => acc + item.subtotal, 0);
  const custoTotalMaoObra = orcamento.maoObra.reduce((acc, m) => acc + m.custoCalculado, 0);

  const adicionarMaterialComOrcamento = adicionarMaterialOrcamento.bind(null, orcamento.id);
  const adicionarMaoObraComOrcamento = adicionarMaoObraOrcamento.bind(null, orcamento.id);

  return (
    <div className="flex flex-col gap-1">
      <Link href="/orcamentos" className="text-sm text-muted-foreground hover:underline w-fit">
        ← Orçamentos
      </Link>
      <div className="flex items-start justify-between gap-4 flex-wrap mt-2 mb-4">
        <div>
          <h2 className="text-lg font-semibold">Orçamento · {orcamento.nomeProjeto}</h2>
          <p className="text-sm text-muted-foreground">
            Criado em {formatarData(orcamento.criadoEm)}
          </p>
        </div>
        {podeEditar && (
          <GerarPropostaDialog orcamentoId={orcamento.id} modeloPadrao={orcamento.tipoProposta} />
        )}
      </div>

      <Tabs defaultValue="dados">
        <TabsList>
          <TabsTrigger value="dados">Dados do orçamento</TabsTrigger>
          <TabsTrigger value="materiais">Materiais</TabsTrigger>
          <TabsTrigger value="maoObra">Mão de obra</TabsTrigger>
          <TabsTrigger value="resumo">Resumo de custos</TabsTrigger>
          <TabsTrigger value="propostas">Propostas ({propostas.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-4">
          {podeEditar ? (
            <OrcamentoForm
              orcamento={{
                id: orcamento.id,
                nomeProjeto: orcamento.nomeProjeto,
                clienteId: orcamento.clienteId,
                tipoProposta: orcamento.tipoProposta,
                descricao: orcamento.descricao,
                status: orcamento.status,
              }}
              clientes={clientes ?? []}
              descricoesPadrao={descricoesPadrao ?? []}
            />
          ) : (
            <dl className="grid grid-cols-2 gap-3 max-w-2xl text-sm">
              <div><dt className="text-muted-foreground">Cliente</dt><dd>{orcamento.cliente?.razaoSocial ?? "—"}</dd></div>
              <div><dt className="text-muted-foreground">Tipo</dt><dd>{orcamento.tipoProposta === "usina_solar" ? "Usina Solar" : "Redes"}</dd></div>
              <div><dt className="text-muted-foreground">Status</dt><dd>{orcamento.status}</dd></div>
              <div className="col-span-2"><dt className="text-muted-foreground">Descrição</dt><dd>{orcamento.descricao ?? "—"}</dd></div>
            </dl>
          )}
        </TabsContent>

        <TabsContent value="materiais" className="mt-4">
          {podeEditar && (
            <AdicionarMaterialForm
              materiais={materiaisItems}
              adicionarMaterial={adicionarMaterialComOrcamento}
            />
          )}

          <div className="rounded-md border bg-card max-w-3xl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Un.</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                  <TableHead className="text-right">Custo unitário</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  {podeEditar && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {orcamento.itens.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">{item.material?.codigo}</TableCell>
                    <TableCell>{item.material?.descricao}</TableCell>
                    <TableCell>{item.material?.unidade}</TableCell>
                    <TableCell className="text-right">{item.quantidade}</TableCell>
                    <TableCell className="text-right">
                      {formatarMoeda(item.custoUnitarioNoMomento)}
                    </TableCell>
                    <TableCell className="text-right">{formatarMoeda(item.subtotal)}</TableCell>
                    {podeEditar && (
                      <TableCell className="text-right">
                        <form
                          action={async () => {
                            "use server";
                            await removerMaterialOrcamento(orcamento.id, item.id);
                          }}
                        >
                          <Button type="submit" variant="ghost" size="sm">
                            Remover
                          </Button>
                        </form>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {orcamento.itens.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={podeEditar ? 7 : 6} className="text-center text-muted-foreground py-6">
                      Nenhum material adicionado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5} className="text-right font-medium">
                    Custo total de materiais
                  </TableCell>
                  <TableCell className="text-right font-bold">{formatarMoeda(custoTotalMateriais)}</TableCell>
                  {podeEditar && <TableCell />}
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="maoObra" className="mt-4">
          {podeEditar && (
            <AdicionarMaoObraForm
              funcionarios={funcionariosItems}
              adicionarMaoObra={adicionarMaoObraComOrcamento}
            />
          )}

          <div className="rounded-md border bg-card max-w-3xl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Função/Cargo</TableHead>
                  <TableHead className="text-right">Dias</TableHead>
                  <TableHead className="text-right">Custo/dia</TableHead>
                  <TableHead className="text-right">Custo total</TableHead>
                  {podeEditar && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {orcamento.maoObra.map((alocacao) => (
                  <TableRow key={alocacao.id}>
                    <TableCell className="font-medium">
                      {alocacao.funcionario?.nome ?? "—"}
                    </TableCell>
                    <TableCell>{alocacao.funcionario?.cargo ?? "—"}</TableCell>
                    <TableCell className="text-right">{alocacao.diasAlocados}</TableCell>
                    <TableCell className="text-right">
                      {formatarMoeda(alocacao.custoCalculado / alocacao.diasAlocados)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatarMoeda(alocacao.custoCalculado)}
                    </TableCell>
                    {podeEditar && (
                      <TableCell className="text-right">
                        <form
                          action={async () => {
                            "use server";
                            await removerMaoObraOrcamento(orcamento.id, alocacao.id);
                          }}
                        >
                          <Button type="submit" variant="ghost" size="sm">
                            Remover
                          </Button>
                        </form>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {orcamento.maoObra.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={podeEditar ? 6 : 5}
                      className="text-center text-muted-foreground py-6"
                    >
                      Nenhum funcionário alocado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="text-right font-medium">
                    Custo total de mão de obra
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatarMoeda(custoTotalMaoObra)}
                  </TableCell>
                  {podeEditar && <TableCell />}
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          <p className="text-sm text-muted-foreground mt-3 max-w-3xl">
            Custo direto do orçamento (materiais + mão de obra):{" "}
            <strong className="text-foreground">
              {formatarMoeda(custoTotalMateriais + custoTotalMaoObra)}
            </strong>
          </p>
        </TabsContent>

        <TabsContent value="resumo" className="mt-4">
          <ResumoCustos
            orcamentoId={orcamento.id}
            itens={orcamento.itens}
            maoObra={orcamento.maoObra}
            bdiPersonalizado={orcamento.bdiPersonalizado}
            impostosPersonalizado={orcamento.impostosPersonalizado}
            bdiPadrao={parametros?.bdiPadrao ?? 0}
            impostosPadrao={parametros?.impostos ?? 0}
            ajusteMaoObraPercent={orcamento.ajusteMaoObraPercent}
            descontoPercent={orcamento.descontoPercent}
            margemMinima={parametros?.margemMinima ?? 0}
            podeEditar={podeEditar}
            ultimaProposta={ultimaProposta}
          />
        </TabsContent>

        <TabsContent value="propostas" className="mt-4">
          <p className="text-sm text-muted-foreground mb-3 max-w-3xl">
            Histórico completo de emissões deste orçamento. Cada nova geração vira uma{" "}
            <strong>revisão</strong> do mesmo número — as anteriores continuam guardadas e podem ser
            reabertas a qualquer momento.
          </p>
          <div className="rounded-md border bg-card max-w-3xl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Emitida em</TableHead>
                  <TableHead>Por</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {propostas.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {formatarNumeroProposta(p.numero, p.ano, p.revisao)}
                    </TableCell>
                    <TableCell>{ROTULO_MODELO[p.modeloUsado] ?? p.modeloUsado}</TableCell>
                    <TableCell>{formatarData(p.geradoEm)}</TableCell>
                    <TableCell>{p.geradoPor?.nome ?? "—"}</TableCell>
                    <TableCell className="text-right">{formatarMoeda(p.valorFinal)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button
                        render={<Link href={`/propostas/${p.id}`} target="_blank" />}
                        nativeButton={false}
                        variant="ghost"
                        size="sm"
                      >
                        PDF
                      </Button>
                      <Button
                        render={<Link href={`/api/propostas/${p.id}/word`} target="_blank" />}
                        nativeButton={false}
                        variant="ghost"
                        size="sm"
                      >
                        Word
                      </Button>
                      {podeEditar && (
                        <BotaoExcluir
                          acao={excluirProposta}
                          campos={{ propostaId: p.id }}
                          variant="ghost"
                          titulo={`Excluir a proposta ${formatarNumeroProposta(p.numero, p.ano, p.revisao)}?`}
                          descricao={
                            <>
                              Some do histórico de emissões deste orçamento, sem volta. O
                              orçamento e a oportunidade no CRM continuam como estão — só esta
                              emissão é apagada, e uma nova pode ser gerada a qualquer momento.
                            </>
                          }
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {propostas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                      Nenhuma proposta gerada ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
