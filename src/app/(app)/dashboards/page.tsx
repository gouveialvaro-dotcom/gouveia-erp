import Link from "next/link";
import { Calculator, HardHat, Kanban } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeLer } from "@/lib/permissoes";
import { formatarData, formatarMoeda } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ORDEM_ESTAGIO_KANBAN, ROTULO_ESTAGIO } from "@/lib/crm";
import { clienteDaObra } from "@/lib/obras";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/dashboards/stat-tile";
import { GraficoPipeline, type ItemPipeline } from "@/components/dashboards/pipeline-chart";
import { GraficoCustoObras, type ItemCustoObra } from "@/components/dashboards/custo-obras-chart";
import { TituloPagina } from "@/components/titulo-pagina";

const ROTULO_STATUS_ORCAMENTO: Record<string, string> = {
  em_elaboracao: "Em elaboração",
  revisao: "Em revisão",
  finalizado: "Finalizado",
};

export default async function PaginaDashboards() {
  const { perfil } = await acessoModulo("dashboards");

  const acessoCrm = podeLer(perfil, "crm");
  const acessoObras = podeLer(perfil, "obras");
  const acessoOrcamentos = podeLer(perfil, "orcamentos");

  const hoje = new Date().toLocaleDateString("sv-SE");

  const [{ data: oportunidadesData }, { data: obrasData }, { data: orcamentosData }] =
    await Promise.all([
      acessoCrm
        ? supabase
            .from("Oportunidade")
            .select("id, estagio, valorEstimado, proximaAcaoData, cliente:Cliente(razaoSocial)")
        : Promise.resolve({ data: null }),
      // Só obra que veio do funil entra nos dashboards. A obra manual não tem
      // orçamento por trás, então o custo orçado dela não é comparável com o
      // resto e sujaria o desvio de custo e a contagem por status.
      acessoObras
        ? supabase
            .from("Obra")
            .select(
              "id, status, custoOrcado, custoRealizado, dataPrevistaConclusao, oportunidade:Oportunidade(cliente:Cliente(razaoSocial), orcamento:Orcamento(nomeProjeto))"
            )
            .eq("origem", "funil")
        : Promise.resolve({ data: null }),
      acessoOrcamentos
        ? supabase.from("Orcamento").select("id, status")
        : Promise.resolve({ data: null }),
    ]);

  // ---- CRM ----
  const oportunidades = oportunidadesData ?? [];
  const abertas = oportunidades.filter((o) => o.estagio !== "aprovada" && o.estagio !== "perdida");
  const pipelineAtivo = abertas.reduce((soma, o) => soma + (o.valorEstimado ?? 0), 0);
  const aprovadas = oportunidades.filter((o) => o.estagio === "aprovada").length;
  const perdidas = oportunidades.filter((o) => o.estagio === "perdida").length;
  const taxaConversao = aprovadas + perdidas > 0 ? (aprovadas / (aprovadas + perdidas)) * 100 : null;

  const pipelinePorEstagio: ItemPipeline[] = ORDEM_ESTAGIO_KANBAN.filter(
    (estagio) => estagio !== "perdida"
  ).map((estagio) => {
    const itens = oportunidades.filter((o) => o.estagio === estagio);
    return {
      estagio,
      rotulo: ROTULO_ESTAGIO[estagio],
      valor: itens.reduce((soma, o) => soma + (o.valorEstimado ?? 0), 0),
      quantidade: itens.length,
    };
  });

  const acoesAtrasadas = abertas
    .filter((o) => !!o.proximaAcaoData && o.proximaAcaoData.slice(0, 10) < hoje)
    .sort((a, b) => (a.proximaAcaoData ?? "").localeCompare(b.proximaAcaoData ?? ""))
    .slice(0, 5);

  // ---- Obras ----
  const obras = (obrasData ?? []).map((obra) => ({
    ...obra,
    atrasada:
      obra.status === "atrasada" ||
      (obra.status !== "concluida" &&
        !!obra.dataPrevistaConclusao &&
        obra.dataPrevistaConclusao.slice(0, 10) < hoje),
  }));

  const emAndamentoCount = obras.filter((o) => !o.atrasada && o.status === "em_andamento").length;
  const atrasadasCount = obras.filter((o) => o.atrasada).length;
  const concluidasCount = obras.filter((o) => !o.atrasada && o.status === "concluida").length;

  const obrasAtivas = obras.filter((o) => o.status !== "concluida");
  const totalOrcadoAtivas = obrasAtivas.reduce((soma, o) => soma + o.custoOrcado, 0);
  const totalRealizadoAtivas = obrasAtivas.reduce((soma, o) => soma + o.custoRealizado, 0);
  const desvioCusto =
    totalOrcadoAtivas > 0 ? ((totalRealizadoAtivas - totalOrcadoAtivas) / totalOrcadoAtivas) * 100 : null;

  const custoPorObra: ItemCustoObra[] = [...obrasAtivas]
    .sort((a, b) => b.custoRealizado - a.custoRealizado)
    .slice(0, 6)
    .map((o) => ({
      id: o.id,
      label: clienteDaObra(o),
      orcado: o.custoOrcado,
      realizado: o.custoRealizado,
    }));

  const obrasAtrasadasLista = obras
    .filter((o) => o.atrasada)
    .sort((a, b) => (a.dataPrevistaConclusao ?? "").localeCompare(b.dataPrevistaConclusao ?? ""))
    .slice(0, 5);

  // ---- Orçamentos ----
  const orcamentos = orcamentosData ?? [];
  const orcamentosPorStatus = ["em_elaboracao", "revisao", "finalizado"].map((status) => ({
    status,
    rotulo: ROTULO_STATUS_ORCAMENTO[status],
    quantidade: orcamentos.filter((o) => o.status === status).length,
  }));

  const semAcesso = !acessoCrm && !acessoObras && !acessoOrcamentos;

  return (
    <div className="flex flex-col gap-6">
      <TituloPagina titulo="Dashboards" subtitulo="Indicadores comerciais e de obras" />

      {semAcesso && (
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Nenhum indicador disponível</CardTitle>
          </CardHeader>
        </Card>
      )}

      {(acessoCrm || acessoObras) && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {acessoCrm && (
            <>
              <StatTile
                label="Pipeline ativo"
                value={formatarMoeda(pipelineAtivo)}
                hint={`${abertas.length} oportunidade${abertas.length === 1 ? "" : "s"} em aberto`}
              />
              <StatTile
                label="Taxa de conversão"
                value={taxaConversao === null ? "—" : `${taxaConversao.toFixed(0)}%`}
                hint={`${aprovadas} aprovada${aprovadas === 1 ? "" : "s"} · ${perdidas} perdida${perdidas === 1 ? "" : "s"}`}
              />
            </>
          )}
          {acessoObras && (
            <>
              <StatTile
                label="Obras em andamento"
                value={String(emAndamentoCount)}
                hint={`${atrasadasCount} atrasada${atrasadasCount === 1 ? "" : "s"}`}
                tone={atrasadasCount > 0 ? "destructive" : "default"}
              />
              <StatTile
                label="Desvio de custo"
                value={desvioCusto === null ? "—" : `${desvioCusto >= 0 ? "+" : ""}${desvioCusto.toFixed(1)}%`}
                hint="Realizado vs. orçado (obras ativas)"
                tone={desvioCusto !== null && desvioCusto > 0 ? "destructive" : "default"}
              />
            </>
          )}
        </div>
      )}

      <div
        className={cn(
          "grid grid-cols-1 gap-6",
          acessoCrm && acessoObras ? "lg:grid-cols-2" : "lg:grid-cols-1"
        )}
      >
        {acessoCrm && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Kanban className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">CRM / Propostas</h2>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Valor em pipeline por estágio</CardTitle>
              </CardHeader>
              <CardContent>
                {pipelinePorEstagio.some((item) => item.quantidade > 0) ? (
                  <GraficoPipeline dados={pipelinePorEstagio} />
                ) : (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Nenhuma oportunidade cadastrada.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Próximas ações atrasadas</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {acoesAtrasadas.map((o) => (
                  <Link
                    key={o.id}
                    href={`/crm/${o.id}`}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 -mx-2 text-sm hover:bg-muted"
                  >
                    <span>{o.cliente?.razaoSocial ?? "—"}</span>
                    <Badge variant="destructive">{formatarData(o.proximaAcaoData!)}</Badge>
                  </Link>
                ))}
                {acoesAtrasadas.length === 0 && (
                  <p className="text-sm text-muted-foreground py-2 text-center">
                    Nenhuma ação atrasada.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {acessoObras && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <HardHat className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Obras</h2>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <StatTile label="Em andamento" value={String(emAndamentoCount)} />
              <StatTile
                label="Atrasadas"
                value={String(atrasadasCount)}
                tone={atrasadasCount > 0 ? "destructive" : "default"}
              />
              <StatTile label="Concluídas" value={String(concluidasCount)} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Custo orçado vs. realizado</CardTitle>
              </CardHeader>
              <CardContent>
                {custoPorObra.length > 0 ? (
                  <GraficoCustoObras dados={custoPorObra} />
                ) : (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Nenhuma obra ativa no momento.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Obras atrasadas</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {obrasAtrasadasLista.map((o) => (
                  <Link
                    key={o.id}
                    href={`/obras/${o.id}`}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 -mx-2 text-sm hover:bg-muted"
                  >
                    <span>{clienteDaObra(o)}</span>
                    <Badge variant="destructive">
                      {o.dataPrevistaConclusao ? formatarData(o.dataPrevistaConclusao) : "—"}
                    </Badge>
                  </Link>
                ))}
                {obrasAtrasadasLista.length === 0 && (
                  <p className="text-sm text-muted-foreground py-2 text-center">
                    Nenhuma obra atrasada.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {acessoOrcamentos && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Orçamentos</h2>
          </div>
          <div className="grid grid-cols-3 gap-3 max-w-2xl">
            {orcamentosPorStatus.map((item) => (
              <StatTile key={item.status} label={item.rotulo} value={String(item.quantidade)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
