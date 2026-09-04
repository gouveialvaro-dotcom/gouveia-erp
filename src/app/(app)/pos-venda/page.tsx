import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { acessoModulo, usuarioIdAtual } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import {
  DIAS_SEM_MOVIMENTO_PADRAO,
  MESES_JANELA_RECORRENCIA,
  MIN_OCORRENCIAS_RECORRENCIA,
  PERFIS_RESPONSAVEL_CHAMADO,
  colunaDoChamado,
  diasSemMovimento,
  diferencaEmDias,
  hojeIso,
  mesesAtras,
  semMovimento,
} from "@/lib/pos-venda";
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
import type { ChamadoCard } from "@/components/pos-venda/card-chamado";
import { QuadroChamados, type ItemQuadro } from "@/components/pos-venda/quadro-chamados";
import { BarraFiltros, type FiltrosPosVenda } from "@/components/pos-venda/filtros";
import { chamadosComNovidade } from "@/lib/notificacoes-pos-venda";
import { TituloPagina } from "@/components/titulo-pagina";

// interacoes(data) vem junto porque "sem movimento" é estado derivado: a data
// da última movimentação não fica gravada em Chamado, sai da linha do tempo.
const SELECT_CHAMADO =
  "*, cliente:Cliente(id, razaoSocial), tipo:TipoProblemaPosVenda(id, nome, prazoDias, diasAlerta), responsavel:Usuario!Chamado_responsavelId_fkey(id, nome), uc:UnidadeConsumidora(id, numero, apelido, concessionaria:Concessionaria(id, nome, sigla)), interacoes:InteracaoChamado(data)";

export default async function PaginaPosVenda({
  searchParams,
}: {
  searchParams: Promise<FiltrosPosVenda>;
}) {
  const { perfil } = await acessoModulo("posVenda");
  // Id conferido no banco, não o do JWT: é ele que responde pelo dono do chamado
  // e pelas notificações, então é ele que o filtro "Meus chamados" compara.
  const meuId = await usuarioIdAtual();
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
    { data: janelaData },
    { data: parametros },
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
    // Mesmo recorte do campo Responsável na abertura: o filtro não oferece
    // quem nem pode ser dono de chamado.
    supabase
      .from("Usuario")
      .select("id, nome")
      .eq("ativo", true)
      .in("perfil", PERFIS_RESPONSAVEL_CHAMADO)
      .order("nome"),
    // Janela de recorrência deliberadamente fora dos filtros da tela: a marca
    // "Recorrente" descreve o histórico do cliente, não o recorte visível.
    supabase
      .from("Chamado")
      .select("clienteId, tipoProblemaId")
      .gte("abertoEm", mesesAtras(MESES_JANELA_RECORRENCIA, hoje)),
    supabase
      .from("ParametroGeral")
      .select("diasSemMovimentoChamado")
      .limit(1)
      .maybeSingle(),
    // Marca no card o que mudou desde a última vez que este usuário olhou.
    chamadosComNovidade(meuId),
  ]);

  const chamados = chamadosData ?? [];

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

  // Prazo do destaque de parada, calibrável em ParametroGeral — nunca cravado
  // no código.
  const diasLimiteParado =
    parametros?.diasSemMovimentoChamado ?? DIAS_SEM_MOVIMENTO_PADRAO;

  const itens = chamados.map((c) => {
    const coluna = colunaDoChamado(
      { estagio: c.estagio, prazoLimite: c.prazoLimite },
      c.tipo?.diasAlerta ?? 0,
      hoje
    );
    // A última interação sai em memória: a lista já veio no mesmo select, e um
    // order/limit por chamado seria uma consulta por card.
    const movimento = {
      estagio: c.estagio,
      abertoEm: c.abertoEm,
      ultimaInteracaoEm:
        (c.interacoes ?? []).map((i) => i.data.slice(0, 10)).sort().at(-1) ?? null,
    };
    const card: ChamadoCard = {
      id: c.id,
      numero: c.numero,
      responsavelId: c.responsavelId,
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
      parado: semMovimento(movimento, diasLimiteParado, hoje),
      diasParado: diasSemMovimento(movimento, hoje),
      diasResolucao:
        c.concluidoEm ? diferencaEmDias(c.abertoEm, c.concluidoEm) : null,
      dentroDoPrazo: c.concluidoEm ? c.concluidoEm <= c.prazoLimite : null,
      tipoNome: c.tipo?.nome ?? "—",
      prazoTipo: c.tipo?.prazoDias ?? null,
    };
  });

  const abertos = itens.filter((i) => i.card.estagio !== "concluido").length;
  const vencidos = itens.filter((i) => i.coluna === "vencido").length;
  const parados = itens.filter((i) => i.parado).length;
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
      <TituloPagina
        titulo="Pós-venda"
        subtitulo={`Chamados de assistência sobre usinas entregues — ${itens.length} no recorte atual`}
      />

      {/* O quadro é componente de cliente por causa do filtro "Meus chamados":
          é recorte de leitura, resolvido na hora e sem ida ao servidor. É ele
          também que gruda o cabeçalho no topo, junto do próprio botão — daí
          indicadores e filtros entrarem por `cabecalho`. */}
      <QuadroChamados
        cabecalho={
          <>
            {podeEditar && (
              <div className="flex justify-end">
                <Button render={<Link href="/pos-venda/novo" />} nativeButton={false}>
                  + Novo chamado
                </Button>
              </div>
            )}

            {/* Cinco indicadores agora: em telas médias eles quebram em três por
                linha em vez de espremer todos, que era o que empurrava a largura. */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <StatTile label="Chamados abertos" value={String(abertos)} hint="fora de Concluído" />
              <StatTile
                label="Vencidos"
                value={String(vencidos)}
                tone={vencidos > 0 ? "destructive" : "default"}
                hint="prazo do SLA estourado"
              />
              <StatTile
                label="Parados"
                value={String(parados)}
                tone={parados > 0 ? "destructive" : "default"}
                hint={`${diasLimiteParado}+ dias sem registro novo`}
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
            />
          </>
        }
        itens={itens.map(
          ({ card, coluna, recorrente, novidade, parado, diasParado }): ItemQuadro => ({
            card,
            coluna,
            recorrente,
            novidade,
            parado,
            diasParado,
          })
        )}
        hoje={hoje}
        podeEditar={podeEditar}
        meuId={meuId}
      />

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
