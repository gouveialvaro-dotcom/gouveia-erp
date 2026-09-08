// Rotina de coleta das usinas monitoradas. SERVER ONLY: importa lib/supabase.ts
// (service role) e lib/isolarcloud.ts (credenciais da API).
//
// ESTA ROTINA NÃO ABRE ALERTA. É de propósito, e é o passo 5 do escopo: coletar
// por 7 a 10 dias antes de ligar qualquer alerta, para (a) formar a base de
// referência de cada usina e (b) conferir se os números batem com o que o
// iSolarCloud mostra na tela. Ligar alerta sem base e sem conferência é a
// receita para a equipe perder a confiança no painel na primeira semana.
//
// O que ela faz hoje: grava leitura e tira do monitoramento a usina cujo plano
// de manutenção venceu.

import { supabase } from "@/lib/supabase";
import type { Json } from "@/lib/database.types";
import { acusaFalha, estaComunicando, listarUsinas, type UsinaIsolar } from "@/lib/isolarcloud";
import {
  dataRefBrasil,
  deveInativarPorPlanoEncerrado,
  elegivelParaColeta,
  motivoInelegibilidade,
  type JanelaColetaUsina,
} from "@/lib/monitoramento";

export type ResultadoColeta = {
  janela: JanelaColetaUsina;
  dataRef: string;
  /** Usinas ativas e com plano vigente no momento da coleta. */
  elegiveis: number;
  /** Leituras gravadas (inseridas ou atualizadas). */
  gravadas: number;
  /** Usinas que saíram do monitoramento nesta passada, por plano vencido. */
  inativadas: number;
  /** Cadastradas aqui que a conta do iSolarCloud não devolveu. */
  semRetorno: string[];
  /**
   * FALHA DE COLETA — API fora do ar, credencial recusada, rede. Nunca deve ser
   * lida como usina em falha: quando isto vem preenchido, NENHUMA leitura foi
   * gravada e o painel mostra "sem dado", que é diferente de usina parada.
   */
  erro: string | null;
};

const SELECT_USINA_COLETA =
  "id, psId, ativo, motivoInativacao, clienteId, cliente:Cliente(id, ramo, manutencaoInicio, manutencaoFim)";

/**
 * Deriva a janela do horário do Brasil, quando o chamador não disser qual é.
 *
 * O cron manda a janela explícita na URL — derivar do relógio faria uma
 * execução atrasada por fila da plataforma ser gravada na janela errada, e a
 * mediana de referência compararia meio-dia com fim de tarde.
 */
export function janelaDoHorario(instante = new Date()): JanelaColetaUsina {
  const hora = Number(
    instante.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hour12: false,
    })
  );
  if (hora < 10) return "manha";
  if (hora < 15) return "meio_dia";
  return "fim_tarde";
}

/**
 * Executa uma janela de coleta.
 *
 * É idempotente: a LeituraUsina tem unique em (usina, dataRef, janela) e a
 * gravação é upsert. Rodar a mesma janela de novo — o que a retentativa de 15
 * minutos faz — atualiza a linha em vez de duplicar. Sem isso, uma segunda
 * tentativa depois de timeout dobraria o dia na mediana de referência.
 */
export async function coletarJanela(
  janela: JanelaColetaUsina,
  hoje = dataRefBrasil()
): Promise<ResultadoColeta> {
  const resultado: ResultadoColeta = {
    janela,
    dataRef: hoje,
    elegiveis: 0,
    gravadas: 0,
    inativadas: 0,
    semRetorno: [],
    erro: null,
  };

  const { data: cadastradas } = await supabase
    .from("UsinaMonitorada")
    .select(SELECT_USINA_COLETA)
    .eq("ativo", true);

  const usinas = cadastradas ?? [];
  if (!usinas.length) return resultado;

  // 1. Ciclo de vida do plano, ANTES de coletar: usina cujo contrato venceu não
  //    deve nem gerar leitura nova. A volta é sempre manual (ver
  //    deveInativarPorPlanoEncerrado).
  const vencidas = usinas.filter(
    (u) => u.cliente && deveInativarPorPlanoEncerrado(u, u.cliente, hoje)
  );

  if (vencidas.length) {
    const ids = vencidas.map((u) => u.id);
    await supabase
      .from("UsinaMonitorada")
      .update({ ativo: false, motivoInativacao: "plano_encerrado", inativadaEm: hoje })
      .in("id", ids);

    // Alerta de usina que saiu do monitoramento não tem mais quem trate — e
    // continuaria renotificando a cada 3 dias para sempre.
    await supabase
      .from("AlertaUsina")
      .update({ situacao: "resolvido", resolvidoEm: new Date().toISOString() })
      .in("usinaMonitoradaId", ids)
      .eq("situacao", "aberto");

    resultado.inativadas = vencidas.length;
  }

  const inativadas = new Set(vencidas.map((u) => u.id));
  const elegiveis = usinas.filter(
    (u) => !inativadas.has(u.id) && u.cliente && elegivelParaColeta(u, u.cliente, hoje)
  );
  resultado.elegiveis = elegiveis.length;
  if (!elegiveis.length) return resultado;

  // 2. UMA chamada traz potência, geração do dia e alarmes de TODAS as plantas
  //    da conta. É por isso que a coleta não faz uma chamada por usina: além de
  //    mais rápida, é o que mantém o consumo longe de qualquer limite.
  const resposta = await listarUsinas();
  if (!resposta.ok) {
    // FALHA DE COLETA. Não grava nada e não abre alerta nenhum: a usina não tem
    // culpa de a API estar fora do ar. O painel mostra "sem dado".
    resultado.erro = resposta.erro;
    return resultado;
  }

  const porPsId = new Map(resposta.dados.map((p) => [p.psId, p]));

  // 3. Energia do mês. A API não devolve acumulado mensal — só do dia e o total
  //    histórico —, então o mês sai da soma dos dias já coletados. Uma consulta
  //    só para todas as usinas; 150 consultas separadas seriam absurdas aqui.
  const acumuladoMes = await somarEnergiaDoMes(
    elegiveis.map((u) => u.id),
    hoje
  );

  const agora = new Date().toISOString();
  const linhas = [];

  for (const usina of elegiveis) {
    const planta = porPsId.get(usina.psId);

    // Cadastrada aqui e ausente na conta do iSolarCloud. Isso é problema de
    // CADASTRO (planta removida, transferida, ps_id errado), não usina parada —
    // então não vira leitura de "não comunicando", que alimentaria alerta.
    if (!planta) {
      resultado.semRetorno.push(usina.psId);
      continue;
    }

    const energiaDia = planta.energiaDiaKwh;
    linhas.push({
      usinaMonitoradaId: usina.id,
      dataRef: hoje,
      janela,
      coletadoEm: agora,
      comunicando: estaComunicando(planta),
      potenciaInstantaneaKw: planta.potenciaAtualKw,
      energiaDiaKwh: energiaDia,
      energiaMesKwh: somaComDiaDeHoje(acumuladoMes.get(usina.id) ?? null, energiaDia),
      // Sempre 'planta': o getPowerStationList devolve a potência consolidada.
      // A soma por inversor não é usada, e é por isso que a coluna existe —
      // para o número na tela não ficar ambíguo depois.
      fontePotencia: "planta",
      payload: payloadEnxuto(planta),
    });
  }

  if (linhas.length) {
    const { error } = await supabase
      .from("LeituraUsina")
      .upsert(linhas, { onConflict: "usinaMonitoradaId,dataRef,janela" });

    if (error) {
      resultado.erro = `Falha ao gravar as leituras: ${error.message}`;
      return resultado;
    }
    resultado.gravadas = linhas.length;
  }

  return resultado;
}

/**
 * Soma de energiaDiaKwh dos dias já coletados do mês corrente, por usina, SEM
 * o dia de hoje.
 *
 * O valor de cada dia é o MAIOR entre as janelas daquele dia: energiaDiaKwh é
 * acumulada ao longo do dia, então a leitura do fim de tarde é o total. Somar
 * as três janelas contaria o mesmo dia três vezes.
 */
async function somarEnergiaDoMes(
  usinaIds: string[],
  hoje: string
): Promise<Map<string, number>> {
  const primeiroDia = `${hoje.slice(0, 7)}-01`;
  const soma = new Map<string, number>();
  if (hoje === primeiroDia) return soma;

  const { data } = await supabase
    .from("LeituraUsina")
    .select("usinaMonitoradaId, dataRef, energiaDiaKwh")
    .in("usinaMonitoradaId", usinaIds)
    .gte("dataRef", primeiroDia)
    .lt("dataRef", hoje)
    .not("energiaDiaKwh", "is", null);

  const porDia = new Map<string, number>();
  for (const linha of data ?? []) {
    const chave = `${linha.usinaMonitoradaId}|${linha.dataRef}`;
    const valor = linha.energiaDiaKwh ?? 0;
    porDia.set(chave, Math.max(porDia.get(chave) ?? 0, valor));
  }

  for (const [chave, valor] of porDia) {
    const usinaId = chave.split("|")[0];
    soma.set(usinaId, (soma.get(usinaId) ?? 0) + valor);
  }

  return soma;
}

/** Mês só existe se houver ao menos um dos dois números — senão é "sem dado". */
function somaComDiaDeHoje(acumulado: number | null, hoje: number | null): number | null {
  if (acumulado === null && hoje === null) return null;
  return (acumulado ?? 0) + (hoje ?? 0);
}

/**
 * O payload guarda o que serve para depurar leitura suspeita, e não a resposta
 * inteira: a lista traz dezenas de campos de receita, CO2 e carimbos de
 * atualização que só engordariam a tabela — e a retenção do payload é de 30
 * dias justamente porque ele é ferramenta de investigação, não histórico.
 */
function payloadEnxuto(planta: UsinaIsolar): Json {
  const bruto = planta.bruto;
  // O cast é seguro por construção: `bruto` é o objeto que saiu do JSON.parse
  // da resposta da API, então todo valor dentro dele já é Json. O tipo se perde
  // porque o cliente trabalha com Record<string, unknown> para não fingir que
  // conhece campos que a API pode mudar.
  return {
    ps_id: bruto.ps_id,
    ps_status: bruto.ps_status,
    ps_fault_status: bruto.ps_fault_status,
    alarm_count: bruto.alarm_count,
    fault_count: bruto.fault_count,
    curr_power: bruto.curr_power,
    today_energy: bruto.today_energy,
    total_energy: bruto.total_energy,
    total_capcity: bruto.total_capcity,
    curr_power_update_time: bruto.curr_power_update_time,
    // Derivados que a coleta usou para decidir, gravados junto para que uma
    // leitura estranha possa ser explicada sem reprocessar nada.
    _comunicando: estaComunicando(planta),
    _acusaFalha: acusaFalha(planta),
  } as Json;
}

/**
 * Motivo pelo qual cada usina cadastrada ficou de fora — para a tela de
 * administração explicar em vez de a usina simplesmente sumir do painel.
 */
export async function inelegiveisAgora(hoje = dataRefBrasil()) {
  const { data } = await supabase.from("UsinaMonitorada").select(SELECT_USINA_COLETA);

  return (data ?? [])
    .map((usina) => ({
      psId: usina.psId,
      motivo: usina.cliente
        ? motivoInelegibilidade(usina, usina.cliente, hoje)
        : "Usina sem cliente vinculado.",
    }))
    .filter((item) => item.motivo !== null);
}
