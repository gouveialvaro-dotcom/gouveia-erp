// Carga de dados do monitoramento de usinas. SERVER ONLY: importa
// lib/supabase.ts, que usa a service role key e ignora RLS — nunca pode ser
// importado por Client Component.
//
// O julgamento (o que é elegível, o que é normal, o que vira alerta) fica em
// lib/monitoramento.ts, que é puro e roda também na tela. Aqui só se busca e se
// monta o que a página precisa.

import { supabase } from "@/lib/supabase";
import { situacaoManutencao, type SituacaoManutencao } from "@/lib/clientes";
import {
  dataRefBrasil,
  mesmoMesAnoAnterior,
  percentualDaReferencia,
  referenciaDeNormalidade,
  comparativoMensal,
  type ComparativoMensal,
  type JanelaColetaUsina,
  type LeituraDeReferencia,
  type MotivoInativacaoUsina,
  type Referencia,
  type SituacaoAlertaUsina,
  type TipoAlertaUsina,
  TIPOS_QUE_INVALIDAM_REFERENCIA,
} from "@/lib/monitoramento";
import { somarDias } from "@/lib/pos-venda";

// Uma linha só, e não concatenação: o supabase-js infere o tipo do resultado a
// partir do LITERAL do select. Quebrar a string em partes com `+` faz o TS
// alargar para `string`, e o retorno inteiro vira GenericStringError.
const SELECT_USINA =
  "id, psId, nomeIsolar, apelido, potenciaIsolarKwp, ativo, motivoInativacao, inativadaEm, cliente:Cliente(id, razaoSocial, ramo, manutencaoInicio, manutencaoFim), unidade:UnidadeConsumidora(id, numero, apelido, potenciaKwp)";

/** Nome de exibição: o apelido interno manda sobre o nome que vem da API. */
function nomeDaUsina(usina: { apelido: string | null; nomeIsolar: string }) {
  return usina.apelido?.trim() || usina.nomeIsolar;
}

// --- Dias que não contam para a referência --------------------------------

/**
 * Conjunto de "usinaId|dia" que a mediana precisa ignorar.
 *
 * Sem isso, uma usina parada há uma semana faria da própria parada o novo
 * normal e o alerta se apagaria sozinho justamente quando o problema persiste.
 *
 * Os alertas de dia (sem geração, sem comunicação, potência baixa) carregam a
 * dataRef na própria `referencia`, então saem de graça. O de falha não — ele é
 * chaveado por código e dispositivo —, e por isso é expandido dia a dia entre a
 * abertura e a resolução.
 */
function diasInvalidos(
  alertas: {
    usinaMonitoradaId: string;
    tipo: TipoAlertaUsina;
    referencia: string;
    abertoEm: string;
    resolvidoEm: string | null;
  }[],
  ate: string
): Set<string> {
  const dias = new Set<string>();

  for (const alerta of alertas) {
    if (!TIPOS_QUE_INVALIDAM_REFERENCIA.includes(alerta.tipo)) continue;

    if (alerta.tipo !== "falha") {
      dias.add(`${alerta.usinaMonitoradaId}|${alerta.referencia.slice(0, 10)}`);
      continue;
    }

    // Falha ativa contamina todos os dias em que ficou aberta.
    const inicio = alerta.abertoEm.slice(0, 10);
    const fim = (alerta.resolvidoEm ?? `${ate}T00:00:00Z`).slice(0, 10);
    for (let dia = inicio; dia <= fim; dia = somarDias(dia, 1)) {
      dias.add(`${alerta.usinaMonitoradaId}|${dia}`);
      // Trava de segurança: alerta com data corrompida não pode virar laço
      // infinito numa página que roda a cada carregamento.
      if (dias.size > 20_000) break;
    }
  }

  return dias;
}

// --- Painel ---------------------------------------------------------------

export type AlertaDoPainel = {
  id: string;
  tipo: TipoAlertaUsina;
  situacao: SituacaoAlertaUsina;
  mensagem: string;
  abertoEm: string;
  valorObservado: number | null;
  valorReferencia: number | null;
  chamadoId: string | null;
  usinaId: string;
  usina: string;
  cliente: string;
  clienteId: string;
};

export type UsinaDoPainel = {
  id: string;
  nome: string;
  cliente: string;
  clienteId: string;
  unidade: string;
  potenciaInstaladaKwp: number | null;
  /** Divergência entre o cadastro e o que a API informa, quando existe. */
  potenciaIsolarKwp: number | null;
  situacaoPlano: SituacaoManutencao;
  /** null = a coleta do dia não aconteceu. É "sem dado", não "usina parada". */
  energiaHojeKwh: number | null;
  ultimaColetaEm: string | null;
  ultimaJanela: JanelaColetaUsina | null;
  potenciaKw: number | null;
  /** Data da potência exibida — fora do horário de sol é a do último meio-dia. */
  potenciaDataRef: string | null;
  referencia: Referencia | null;
  percentualDaReferencia: number | null;
  alertasAbertos: number;
};

export type Painel = {
  usinas: UsinaDoPainel[];
  alertas: AlertaDoPainel[];
  /** Coleta mais recente entre todas as usinas — o carimbo do topo da tela. */
  atualizadoEm: string | null;
  hoje: string;
};

export async function carregarPainel(hoje = dataRefBrasil()): Promise<Painel> {
  const { data: usinasData } = await supabase
    .from("UsinaMonitorada")
    .select(SELECT_USINA)
    .eq("ativo", true);

  const usinas = usinasData ?? [];
  if (!usinas.length) {
    return { usinas: [], alertas: [], atualizadoEm: null, hoje };
  }

  const ids = usinas.map((u) => u.id);
  // Uma folga além dos 7 dias da janela de referência: dias descartados por
  // alerta não contam, então buscar exatamente 7 devolveria menos que o mínimo
  // sempre que a usina tivesse tido um dia ruim.
  const desde = somarDias(hoje, -20);

  const [{ data: leiturasData }, { data: alertasData }] = await Promise.all([
    supabase
      .from("LeituraUsina")
      .select(
        "usinaMonitoradaId, dataRef, janela, coletadoEm, comunicando, potenciaInstantaneaKw, energiaDiaKwh"
      )
      .in("usinaMonitoradaId", ids)
      .gte("dataRef", desde)
      .order("dataRef", { ascending: false }),
    supabase
      .from("AlertaUsina")
      .select(
        "id, usinaMonitoradaId, tipo, situacao, mensagem, referencia, valorObservado, valorReferencia, abertoEm, resolvidoEm, chamadoId"
      )
      .in("usinaMonitoradaId", ids)
      .gte("abertoEm", `${desde}T00:00:00Z`),
  ]);

  const leituras = leiturasData ?? [];
  const alertas = alertasData ?? [];
  const invalidos = diasInvalidos(alertas, hoje);

  const painelUsinas: UsinaDoPainel[] = usinas.map((usina) => {
    const minhas = leituras.filter((l) => l.usinaMonitoradaId === usina.id);

    // Geração do dia: a janela do fim de tarde é a que fecha o dia; antes dela,
    // vale a coleta mais recente de hoje, que ainda é parcial.
    const deHoje = minhas.filter((l) => l.dataRef === hoje);
    const fechamento = deHoje.find((l) => l.janela === "fim_tarde") ?? deHoje[0] ?? null;

    // Potência: só a de meio-dia significa alguma coisa. Fora do horário de sol
    // mostra-se a do último meio-dia COM a data, e nunca zero — zero passaria a
    // impressão de usina parada às 19h de um dia perfeitamente normal.
    const meioDia = minhas
      .filter((l) => l.janela === "meio_dia")
      .sort((a, b) => b.dataRef.localeCompare(a.dataRef));
    const potenciaAtual = meioDia[0] ?? null;

    const paraReferencia: LeituraDeReferencia[] = meioDia.map((l) => ({
      dataRef: l.dataRef,
      comunicando: l.comunicando,
      valor: l.potenciaInstantaneaKw,
      diaComAlerta: invalidos.has(`${usina.id}|${l.dataRef}`),
    }));
    const referencia = referenciaDeNormalidade(paraReferencia);

    const ultima = minhas.sort((a, b) => b.coletadoEm.localeCompare(a.coletadoEm))[0] ?? null;

    return {
      id: usina.id,
      nome: nomeDaUsina(usina),
      cliente: usina.cliente?.razaoSocial ?? "—",
      clienteId: usina.cliente?.id ?? "",
      unidade: usina.unidade?.apelido?.trim() || usina.unidade?.numero || "—",
      // A fonte de verdade da potência instalada é o cadastro da UC, não a API.
      potenciaInstaladaKwp: usina.unidade?.potenciaKwp ?? null,
      potenciaIsolarKwp: usina.potenciaIsolarKwp,
      situacaoPlano: usina.cliente
        ? situacaoManutencao(usina.cliente, hoje)
        : "sem_plano",
      energiaHojeKwh: fechamento?.energiaDiaKwh ?? null,
      ultimaColetaEm: ultima?.coletadoEm ?? null,
      ultimaJanela: ultima?.janela ?? null,
      potenciaKw: potenciaAtual?.potenciaInstantaneaKw ?? null,
      potenciaDataRef: potenciaAtual?.dataRef ?? null,
      referencia,
      percentualDaReferencia: percentualDaReferencia(
        potenciaAtual?.potenciaInstantaneaKw ?? null,
        referencia
      ),
      alertasAbertos: alertas.filter(
        (a) => a.usinaMonitoradaId === usina.id && a.situacao === "aberto"
      ).length,
    };
  });

  const porId = new Map(usinas.map((u) => [u.id, u]));
  const abertos: AlertaDoPainel[] = alertas
    .filter((a) => a.situacao === "aberto")
    .map((a) => {
      const usina = porId.get(a.usinaMonitoradaId);
      return {
        id: a.id,
        tipo: a.tipo,
        situacao: a.situacao,
        mensagem: a.mensagem,
        abertoEm: a.abertoEm,
        valorObservado: a.valorObservado,
        valorReferencia: a.valorReferencia,
        chamadoId: a.chamadoId,
        usinaId: a.usinaMonitoradaId,
        usina: usina ? nomeDaUsina(usina) : "—",
        cliente: usina?.cliente?.razaoSocial ?? "—",
        clienteId: usina?.cliente?.id ?? "",
      };
    });

  const atualizadoEm =
    painelUsinas
      .map((u) => u.ultimaColetaEm)
      .filter((v): v is string => v !== null)
      .sort()
      .at(-1) ?? null;

  return { usinas: painelUsinas, alertas: abertos, atualizadoEm, hoje };
}

// --- Usinas inativas ------------------------------------------------------

export type UsinaInativa = {
  id: string;
  nome: string;
  cliente: string;
  unidade: string;
  motivoInativacao: MotivoInativacaoUsina | null;
  inativadaEm: string | null;
};

export async function carregarInativas(): Promise<UsinaInativa[]> {
  const { data } = await supabase
    .from("UsinaMonitorada")
    .select(SELECT_USINA)
    .eq("ativo", false)
    .order("inativadaEm", { ascending: false });

  return (data ?? []).map((usina) => ({
    id: usina.id,
    nome: nomeDaUsina(usina),
    cliente: usina.cliente?.razaoSocial ?? "—",
    unidade: usina.unidade?.apelido?.trim() || usina.unidade?.numero || "—",
    motivoInativacao: usina.motivoInativacao,
    inativadaEm: usina.inativadaEm,
  }));
}

// --- Detalhe --------------------------------------------------------------

export type DiaDeGeracao = { dataRef: string; energiaDiaKwh: number | null };

export type DetalheUsina = {
  id: string;
  nome: string;
  nomeIsolar: string;
  psId: string;
  cliente: string;
  clienteId: string;
  unidade: string;
  unidadeId: string;
  potenciaInstaladaKwp: number | null;
  potenciaIsolarKwp: number | null;
  ativo: boolean;
  motivoInativacao: MotivoInativacaoUsina | null;
  situacaoPlano: SituacaoManutencao;
  manutencaoInicio: string | null;
  manutencaoFim: string | null;
  geracao30Dias: DiaDeGeracao[];
  referenciaMeioDia: Referencia | null;
  comparativo: ComparativoMensal | null;
  energiaMesKwh: number | null;
  energiaMesAnoAnteriorKwh: number | null;
  falhas: {
    id: string;
    codigo: string;
    descricao: string;
    dispositivo: string | null;
    severidade: string | null;
    detectadaEm: string;
    encerradaEm: string | null;
  }[];
  alertas: AlertaDoPainel[];
};

export async function carregarDetalheUsina(
  id: string,
  hoje = dataRefBrasil()
): Promise<DetalheUsina | null> {
  const { data: usina } = await supabase
    .from("UsinaMonitorada")
    .select(SELECT_USINA)
    .eq("id", id)
    .maybeSingle();

  if (!usina) return null;

  const desde = somarDias(hoje, -30);
  const mesAtual = hoje.slice(0, 7);
  const mesAnterior = mesmoMesAnoAnterior(hoje);

  const [{ data: leiturasData }, { data: falhasData }, { data: alertasData }, { data: anoPassado }] =
    await Promise.all([
      supabase
        .from("LeituraUsina")
        .select("dataRef, janela, comunicando, potenciaInstantaneaKw, energiaDiaKwh, energiaMesKwh")
        .eq("usinaMonitoradaId", id)
        .gte("dataRef", desde)
        .order("dataRef", { ascending: false }),
      supabase
        .from("FalhaUsina")
        .select("id, codigo, descricao, dispositivo, severidade, detectadaEm, encerradaEm")
        .eq("usinaMonitoradaId", id)
        .order("detectadaEm", { ascending: false })
        .limit(50),
      supabase
        .from("AlertaUsina")
        .select(
          "id, usinaMonitoradaId, tipo, situacao, mensagem, referencia, valorObservado, valorReferencia, abertoEm, resolvidoEm, chamadoId"
        )
        .eq("usinaMonitoradaId", id)
        .order("abertoEm", { ascending: false })
        .limit(100),
      // O acumulado do mesmo mês no ano anterior. Pega-se a MAIOR leitura do
      // mês porque energiaMesKwh é acumulada: a última do mês é o total, e
      // ordenar por data devolveria a mesma coisa com mais chance de erro se
      // faltar a coleta do último dia.
      supabase
        .from("LeituraUsina")
        .select("energiaMesKwh")
        .eq("usinaMonitoradaId", id)
        .gte("dataRef", `${mesAnterior}-01`)
        .lte("dataRef", `${mesAnterior}-31`)
        .order("energiaMesKwh", { ascending: false, nullsFirst: false })
        .limit(1),
    ]);

  const leituras = leiturasData ?? [];
  const alertas = alertasData ?? [];
  const invalidos = diasInvalidos(alertas, hoje);

  const meioDia = leituras.filter((l) => l.janela === "meio_dia");
  const referenciaMeioDia = referenciaDeNormalidade(
    meioDia.map((l) => ({
      dataRef: l.dataRef,
      comunicando: l.comunicando,
      valor: l.potenciaInstantaneaKw,
      diaComAlerta: invalidos.has(`${id}|${l.dataRef}`),
    }))
  );

  // Um ponto por dia: o fechamento do fim de tarde, ou a coleta mais recente
  // que houver do dia.
  const porDia = new Map<string, DiaDeGeracao>();
  for (const leitura of leituras) {
    const atual = porDia.get(leitura.dataRef);
    if (!atual || leitura.janela === "fim_tarde") {
      porDia.set(leitura.dataRef, {
        dataRef: leitura.dataRef,
        energiaDiaKwh: leitura.energiaDiaKwh,
      });
    }
  }

  const energiaMesKwh =
    leituras
      .filter((l) => l.dataRef.startsWith(mesAtual) && l.energiaMesKwh !== null)
      .map((l) => l.energiaMesKwh as number)
      .sort((a, b) => b - a)[0] ?? null;
  const energiaMesAnoAnteriorKwh = anoPassado?.[0]?.energiaMesKwh ?? null;

  return {
    id: usina.id,
    nome: nomeDaUsina(usina),
    nomeIsolar: usina.nomeIsolar,
    psId: usina.psId,
    cliente: usina.cliente?.razaoSocial ?? "—",
    clienteId: usina.cliente?.id ?? "",
    unidade: usina.unidade?.apelido?.trim() || usina.unidade?.numero || "—",
    unidadeId: usina.unidade?.id ?? "",
    potenciaInstaladaKwp: usina.unidade?.potenciaKwp ?? null,
    potenciaIsolarKwp: usina.potenciaIsolarKwp,
    ativo: usina.ativo,
    motivoInativacao: usina.motivoInativacao,
    situacaoPlano: usina.cliente ? situacaoManutencao(usina.cliente, hoje) : "sem_plano",
    manutencaoInicio: usina.cliente?.manutencaoInicio ?? null,
    manutencaoFim: usina.cliente?.manutencaoFim ?? null,
    geracao30Dias: [...porDia.values()].sort((a, b) => a.dataRef.localeCompare(b.dataRef)),
    referenciaMeioDia,
    comparativo: comparativoMensal(energiaMesKwh, energiaMesAnoAnteriorKwh),
    energiaMesKwh,
    energiaMesAnoAnteriorKwh,
    falhas: falhasData ?? [],
    alertas: alertas.map((a) => ({
      id: a.id,
      tipo: a.tipo,
      situacao: a.situacao,
      mensagem: a.mensagem,
      abertoEm: a.abertoEm,
      valorObservado: a.valorObservado,
      valorReferencia: a.valorReferencia,
      chamadoId: a.chamadoId,
      usinaId: a.usinaMonitoradaId,
      usina: nomeDaUsina(usina),
      cliente: usina.cliente?.razaoSocial ?? "—",
      clienteId: usina.cliente?.id ?? "",
    })),
  };
}
