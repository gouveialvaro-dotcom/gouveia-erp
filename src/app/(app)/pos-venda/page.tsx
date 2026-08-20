import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import {
  MESES_JANELA_RECORRENCIA,
  MIN_OCORRENCIAS_RECORRENCIA,
  ORDEM_COLUNA_KANBAN,
  ROTULO_COLUNA,
  colunaDoChamado,
  diferencaEmDias,
  hojeIso,
  mesesAtras,
  type ColunaKanban,
} from "@/lib/pos-venda";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatTile } from "@/components/dashboards/stat-tile";
import { CardChamado, type ChamadoCard } from "@/components/pos-venda/card-chamado";
import { BarraFiltros, type FiltrosPosVenda } from "@/components/pos-venda/filtros";
import { chamadosComNovidade } from "@/lib/notificacoes-pos-venda";

const SELECT_CHAMADO =
  "*, cliente:Cliente(id, razaoSocial), tipo:TipoProblemaPosVenda(id, nome, prazoDias, diasAlerta), responsavel:Usuario!Chamado_responsavelId_fkey(id, nome), uc:UnidadeConsumidora(id, numero, apelido, concessionaria:Concessionaria(id, nome, sigla))";

export default async function PaginaPosVenda({
  searchParams,
}: {
  searchParams: Promise<FiltrosPosVenda>;
}) {
  const { perfil, userId } = await acessoModulo("posVenda");
  const filtros = await searchParams;
  const podeEditar = podeEscrever(perfil, "posVenda");
  const hoje = hojeIso();

  let query = supabase.from("Chamado").select(SELECT_CHAMADO).order("prazoLimite");

  if (filtros.cliente) query = query.eq("clienteId", filtros.cliente);
  if (filtros.tipo) query = query.eq("tipoProblemaId", filtros.tipo);
  if (filtros.responsavel) query = query.eq("responsavelId", filtros.responsavel);
  if (filtros.de) query = query.gte("abertoEm", filtros.de);
  if (filtros.ate) query = query.lte("abertoEm", filtros.ate);

  const [
    { data: chamadosData },
    { data: clientesData },
    { data: tiposData },
    { data: usuariosData },
    { data: concessionariasData },
    { data: janelaData },
    novidades,
  ] = await Promise.all([
    query,
    // O pós-venda atende só energia solar — o filtro por cliente segue a mesma
    // base de quem pode ter chamado.
    supabase
      .from("Cliente")
      .select("id, razaoSocial")
      .eq("ramo", "energia_solar")
      .order("razaoSocial"),
    supabase
      .from("TipoProblemaPosVenda")
      .select("id, nome, prazoDias, diasAlerta")
      .eq("ativo", true)
      .order("ordem"),
    supabase.from("Usuario").select("id, nome").eq("ativo", true).order("nome"),
    supabase
      .from("Concessionaria")
      .select("id, nome")
      .eq("ativo", true)
      .order("nome"),
    // Janela de recorrência deliberadamente fora dos filtros da tela: a marca
    // "Recorrente" descreve o histórico do cliente, não o recorte visível.
    supabase
      .from("Chamado")
      .select("clienteId, tipoProblemaId")
      .gte("abertoEm", mesesAtras(MESES_JANELA_RECORRENCIA, hoje)),
    // Marca no card o que mudou desde a última vez que este usuário olhou.
    chamadosComNovidade(userId),
  ]);

  // A concessionária mora dois níveis abaixo (Chamado → UC → Concessionária).
  // Filtrar isso no PostgREST exigiria um !inner que muda a forma do retorno;
  // com o volume desta base sai mais simples e legível filtrar aqui.
  const chamados = (chamadosData ?? []).filter(
    (c) => !filtros.concessionaria || c.uc?.concessionaria?.id === filtros.concessionaria
  );

  const ocorrencias = new Map<string, number>();
  for (const c of janelaData ?? []) {
    const chave = `${c.clienteId}|${c.tipoProblemaId}`;
    ocorrencias.set(chave, (ocorrencias.get(chave) ?? 0) + 1);
  }
  const chavesRecorrentes = new Set(
    [...ocorrencias]
      .filter(([, total]) => total >= MIN_OCORRENCIAS_RECORRENCIA)
      .map(([chave]) => chave)
  );
  const clientesRecorrentes = new Set(
    [...chavesRecorrentes].map((chave) => chave.split("|")[0])
  );

  const itens = chamados.map((c) => {
    const coluna = colunaDoChamado(
      { estagio: c.estagio, prazoLimite: c.prazoLimite },
      c.tipo?.diasAlerta ?? 0,
      hoje
    );
    const card: ChamadoCard = {
      id: c.id,
      numero: c.numero,
      titulo: c.titulo,
      estagio: c.estagio,
      prioridade: c.prioridade,
      prazoLimite: c.prazoLimite,
      concluidoEm: c.concluidoEm,
      cliente: c.cliente?.razaoSocial ?? "—",
      tipo: c.tipo?.nome ?? "—",
      responsavel: c.responsavel?.nome ?? "—",
      unidade: c.uc ? (c.uc.apelido ?? c.uc.numero) : null,
      concessionaria: c.uc?.concessionaria?.sigla ?? c.uc?.concessionaria?.nome ?? null,
    };
    return {
      card,
      coluna,
      recorrente: chavesRecorrentes.has(`${c.clienteId}|${c.tipoProblemaId}`),
      novidade: novidades.has(c.id),
      diasResolucao:
        c.concluidoEm ? diferencaEmDias(c.abertoEm, c.concluidoEm) : null,
      dentroDoPrazo: c.concluidoEm ? c.concluidoEm <= c.prazoLimite : null,
      tipoNome: c.tipo?.nome ?? "—",
      prazoTipo: c.tipo?.prazoDias ?? null,
    };
  });

  const abertos = itens.filter((i) => i.card.estagio !== "concluido").length;
  const vencidos = itens.filter((i) => i.coluna === "vencido").length;
  const resolvidos = itens.filter((i) => i.diasResolucao !== null);
  const tempoMedio =
    resolvidos.length > 0
      ? resolvidos.reduce((soma, i) => soma + (i.diasResolucao ?? 0), 0) / resolvidos.length
      : null;
  const noPrazo = resolvidos.filter((i) => i.dentroDoPrazo).length;

  // Tempo médio por tipo — é onde se enxerga qual problema trava o pós-venda.
  const porTipo = new Map<
    string,
    { total: number; dias: number; noPrazo: number; prazo: number | null }
  >();
  for (const item of resolvidos) {
    const atual = porTipo.get(item.tipoNome) ?? {
      total: 0,
      dias: 0,
      noPrazo: 0,
      prazo: item.prazoTipo,
    };
    atual.total += 1;
    atual.dias += item.diasResolucao ?? 0;
    if (item.dentroDoPrazo) atual.noPrazo += 1;
    porTipo.set(item.tipoNome, atual);
  }
  const linhasPorTipo = [...porTipo]
    .map(([nome, v]) => ({ nome, ...v, media: v.dias / v.total }))
    .sort((a, b) => b.media - a.media);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pós-venda</h1>
          <p className="text-sm text-muted-foreground">
            Chamados de assistência sobre usinas entregues — {itens.length} no recorte atual
          </p>
        </div>
        {podeEditar && (
          <Button render={<Link href="/pos-venda/novo" />} nativeButton={false}>
            + Novo chamado
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Chamados abertos" value={String(abertos)} hint="fora de Concluído" />
        <StatTile
          label="Vencidos"
          value={String(vencidos)}
          tone={vencidos > 0 ? "destructive" : "default"}
          hint="prazo do SLA estourado"
        />
        <StatTile
          label="Tempo médio de resolução"
          value={tempoMedio === null ? "—" : `${tempoMedio.toFixed(1)} dias`}
          hint={
            resolvidos.length > 0
              ? `${noPrazo}/${resolvidos.length} dentro do prazo`
              : "sem chamados concluídos"
          }
        />
        <StatTile
          label="Clientes recorrentes"
          value={String(clientesRecorrentes.size)}
          tone={clientesRecorrentes.size > 0 ? "destructive" : "default"}
          hint={`${MIN_OCORRENCIAS_RECORRENCIA}+ do mesmo tipo em ${MESES_JANELA_RECORRENCIA} meses`}
        />
      </div>

      <BarraFiltros
        filtros={filtros}
        clientes={(clientesData ?? []).map((c) => ({ id: c.id, nome: c.razaoSocial }))}
        tipos={tiposData ?? []}
        responsaveis={usuariosData ?? []}
        concessionarias={concessionariasData ?? []}
      />

      <div className="flex gap-4 overflow-x-auto pb-2">
        {ORDEM_COLUNA_KANBAN.map((coluna: ColunaKanban) => {
          const daColuna = itens.filter((i) => i.coluna === coluna);
          return (
            <div key={coluna} className="flex w-64 shrink-0 flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold">{ROTULO_COLUNA[coluna]}</h2>
                <Badge variant={coluna === "vencido" && daColuna.length > 0 ? "destructive" : "outline"}>
                  {daColuna.length}
                </Badge>
              </div>

              <div className="flex flex-col gap-2">
                {daColuna.map((item) => (
                  <CardChamado
                    key={item.card.id}
                    chamado={item.card}
                    coluna={coluna}
                    hoje={hoje}
                    recorrente={item.recorrente}
                    novidade={item.novidade}
                    podeEditar={podeEditar}
                  />
                ))}
                {daColuna.length === 0 && (
                  <p className="text-xs text-muted-foreground px-1 py-4 text-center">
                    Nenhum chamado
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Tempo médio de resolução por tipo de problema</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo de problema</TableHead>
                <TableHead className="text-right">Concluídos</TableHead>
                <TableHead className="text-right">Média (dias)</TableHead>
                <TableHead className="text-right">Prazo SLA</TableHead>
                <TableHead className="text-right">Dentro do prazo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhasPorTipo.map((linha) => (
                <TableRow key={linha.nome}>
                  <TableCell className="font-medium">{linha.nome}</TableCell>
                  <TableCell className="text-right">{linha.total}</TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        linha.prazo !== null && linha.media > linha.prazo
                          ? "text-destructive font-medium"
                          : undefined
                      }
                    >
                      {linha.media.toFixed(1)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {linha.prazo !== null ? `${linha.prazo}d` : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {Math.round((linha.noPrazo / linha.total) * 100)}%
                  </TableCell>
                </TableRow>
              ))}
              {linhasPorTipo.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    Nenhum chamado concluído ainda no recorte selecionado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
