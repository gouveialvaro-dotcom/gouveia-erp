// Regras do monitoramento de usinas fotovoltaicas. Vive fora de actions.ts
// porque um arquivo "use server" só pode exportar funções async — mesma razão
// de lib/pos-venda.ts e lib/clientes.ts. Nada aqui toca o banco nem a API do
// iSolarCloud: pode ser importado por Client Component sem arrastar o client de
// service role junto, e é a MESMA função que decide na tela e no servidor.
//
// A coleta em si (cliente HTTP, upsert de leitura, motor de alerta) fica em
// arquivos server-only à parte. Aqui só mora o julgamento: o que é elegível, o
// que é normal, o que vira alerta e o que já foi avisado.

import { situacaoManutencao, type PlanoManutencao, type RamoCliente } from "@/lib/clientes";
import type { Database } from "@/lib/database.types";
import { formatarData } from "@/lib/format";
import { diferencaEmDias } from "@/lib/pos-venda";

type Enums = Database["public"]["Enums"];
export type JanelaColetaUsina = Enums["JanelaColetaUsina"];
export type TipoAlertaUsina = Enums["TipoAlertaUsina"];
export type SituacaoAlertaUsina = Enums["SituacaoAlertaUsina"];
export type MotivoInativacaoUsina = Enums["MotivoInativacaoUsina"];

type Variante = "default" | "secondary" | "outline" | "destructive";

// --- Rótulos --------------------------------------------------------------

export const JANELAS: JanelaColetaUsina[] = ["manha", "meio_dia", "fim_tarde"];

export const ROTULO_JANELA: Record<JanelaColetaUsina, string> = {
  manha: "Manhã",
  meio_dia: "Meio-dia",
  fim_tarde: "Fim de tarde",
};

export const ROTULO_TIPO_ALERTA: Record<TipoAlertaUsina, { texto: string; variant: Variante }> = {
  falha: { texto: "Falha no equipamento", variant: "destructive" },
  sem_comunicacao: { texto: "Sem comunicação", variant: "destructive" },
  sem_geracao: { texto: "Sem geração no dia", variant: "destructive" },
  potencia_baixa: { texto: "Potência abaixo do padrão", variant: "default" },
  plano_a_vencer: { texto: "Plano a vencer", variant: "secondary" },
};

export const ROTULO_SITUACAO_ALERTA: Record<SituacaoAlertaUsina, string> = {
  aberto: "Em aberto",
  resolvido: "Resolvido",
  ignorado: "Ignorado",
};

export const ROTULO_MOTIVO_INATIVACAO: Record<MotivoInativacaoUsina, string> = {
  plano_encerrado: "Plano de manutenção encerrado",
  manual: "Desativada manualmente",
};

// --- Fuso -----------------------------------------------------------------
// O dia solar é o dia em Natal (UTC−3), não o dia do servidor. A Vercel roda em
// UTC: sem fixar o fuso, a coleta das 18h locais cairia no dia seguinte e a
// geração do dia inteiro seria gravada na data errada — erro que só apareceria
// no comparativo, semanas depois, como um dia zerado e um dia dobrado.
//
// Por isso NÃO se reaproveita hojeIso() de pos-venda.ts: aquele usa o fuso local
// do processo, o que é correto no navegador do usuário e errado no cron.

const FUSO = "America/Sao_Paulo";

/** Dia solar ("YYYY-MM-DD") do instante, em horário do Brasil. */
export function dataRefBrasil(instante: Date = new Date()) {
  return instante.toLocaleDateString("sv-SE", { timeZone: FUSO });
}

/** Minutos desde a meia-noite em Brasília — para a janela de envio. */
export function minutosDoDiaBrasil(instante: Date = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instante);
  const pegar = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value ?? 0);
  return pegar("hour") * 60 + pegar("minute");
}

/** Minutos desde a meia-noite de uma coluna `time` do Postgres ("HH:MM[:SS]"). */
export function minutosDeHora(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + (m || 0);
}

// --- Elegibilidade --------------------------------------------------------
// Só se monitora quem paga por isso. O contrato de manutenção é o que autoriza
// a Gouveia a acompanhar a usina, exatamente como autoriza a abrir chamado.

export type ClienteDaUsina = PlanoManutencao & {
  ramo: RamoCliente;
  razaoSocial?: string;
};

export type UsinaParaColeta = {
  ativo: boolean;
  motivoInativacao?: MotivoInativacaoUsina | null;
};

/**
 * Texto do motivo pelo qual a usina não é coletada — null quando é elegível.
 *
 * Mesmo desenho de impedimentoDeAbertura(): a MESMA função explica na tela por
 * que a usina sumiu do painel e barra a coleta no servidor. Duas versões
 * divergiriam no primeiro ajuste, e a tela passaria a mentir sobre o que o cron
 * está fazendo.
 *
 * A situação do plano vem de situacaoManutencao() e NÃO é reimplementada aqui:
 * é a mesma regra que rege o pós-venda.
 */
export function motivoInelegibilidade(
  usina: UsinaParaColeta,
  cliente: ClienteDaUsina,
  data = dataRefBrasil()
): string | null {
  if (!usina.ativo) {
    const motivo = usina.motivoInativacao
      ? ROTULO_MOTIVO_INATIVACAO[usina.motivoInativacao].toLowerCase()
      : "usina inativa";
    return `Usina fora do monitoramento: ${motivo}.`;
  }

  if (cliente.ramo !== "energia_solar") {
    return "Usina fora do monitoramento: o módulo acompanha apenas clientes de energia solar.";
  }

  const situacao = situacaoManutencao(cliente, data);
  if (situacao === "ativo") return null;

  if (situacao === "sem_plano") {
    return (
      "Usina fora do monitoramento: o cliente não tem período de manutenção cadastrado. " +
      "Informe a vigência no cadastro do cliente."
    );
  }

  const explicacao = situacao === "a_iniciar" ? "ainda não começou" : "já se encerrou";
  return (
    `Usina fora do monitoramento: o plano de manutenção não está ativo em ` +
    `${formatarData(data)} — a vigência ${explicacao}.`
  );
}

export function elegivelParaColeta(
  usina: UsinaParaColeta,
  cliente: ClienteDaUsina,
  data = dataRefBrasil()
) {
  return motivoInelegibilidade(usina, cliente, data) === null;
}

/**
 * Impedimento para VINCULAR a usina a um cliente e a uma UC, na tela de
 * administração. Além do plano, checa a coerência do par cliente × UC: a UC
 * precisa ser do mesmo cliente e ser a geradora.
 *
 * Essa checagem não vive em constraint do banco porque depende de duas tabelas.
 * Vive aqui, e a Server Action a chama — a tela esconder o botão não é garantia
 * de nada. Vincular a UC errada é alertar sobre a usina do cliente errado.
 */
export function impedimentoDeVinculo(
  cliente: ClienteDaUsina & { id: string },
  unidade: { clienteId: string; tipo: "geradora" | "beneficiaria"; ativo: boolean },
  data = dataRefBrasil()
): string | null {
  if (unidade.clienteId !== cliente.id) {
    return "A unidade consumidora escolhida pertence a outro cliente.";
  }
  if (unidade.tipo !== "geradora") {
    return "A unidade consumidora precisa ser do tipo geradora — é ela que tem a usina.";
  }
  if (!unidade.ativo) {
    return "A unidade consumidora está inativa no cadastro.";
  }
  return motivoInelegibilidade({ ativo: true }, cliente, data);
}

// --- Ciclo de vida do plano ----------------------------------------------

/** Aviso comercial, com folga para renovar antes de a usina sair do painel. */
export const DIAS_AVISO_PLANO_A_VENCER = 30;

/** Dias que faltam para o fim do plano. Negativo = já venceu. */
export function diasAteFimDoPlano(cliente: PlanoManutencao, data = dataRefBrasil()) {
  const fim = cliente.manutencaoFim?.slice(0, 10);
  if (!fim) return null;
  return diferencaEmDias(data, fim);
}

export function planoAVencer(cliente: ClienteDaUsina, data = dataRefBrasil()) {
  if (situacaoManutencao(cliente, data) !== "ativo") return false;
  const restantes = diasAteFimDoPlano(cliente, data);
  return restantes !== null && restantes <= DIAS_AVISO_PLANO_A_VENCER;
}

/**
 * Plano vencido: a usina sai do monitoramento sozinha.
 *
 * situacaoManutencao() já devolve "encerrado" só a partir do dia SEGUINTE ao
 * manutencaoFim (a comparação é `data > fim`), que é o comportamento pedido —
 * no último dia de vigência a usina ainda é monitorada.
 *
 * A volta NÃO é automática de propósito: renovação de contrato passa por
 * conferência humana, e reativar sozinho a partir de uma data digitada por
 * engano faria a Gouveia acompanhar usina que não está mais sob contrato.
 */
export function deveInativarPorPlanoEncerrado(
  usina: UsinaParaColeta,
  cliente: ClienteDaUsina,
  data = dataRefBrasil()
) {
  return usina.ativo && situacaoManutencao(cliente, data) === "encerrado";
}

// --- Referência de normalidade -------------------------------------------
// O padrão de cada usina é ela mesma, e não a potência de placa: sombreamento,
// inclinação e clima local fazem duas usinas de mesma potência gerarem
// diferente, todo dia, sem que nenhuma esteja com problema.

export const DIAS_JANELA_REFERENCIA = 7;

/**
 * Abaixo disso não há referência confiável — o alerta de potência baixa
 * simplesmente NÃO é avaliado. Usina recém-cadastrada não deve alertar nas
 * primeiras semanas: alerta falso na primeira semana é o jeito mais rápido de a
 * equipe deixar de olhar o painel.
 */
export const MIN_LEITURAS_REFERENCIA = 5;

/**
 * Dias com qualquer um destes alertas abertos não entram na referência. Sem
 * essa exclusão, uma usina parada há uma semana faria da própria parada o novo
 * normal, e o alerta se apagaria sozinho justamente quando o problema piorou.
 */
export const TIPOS_QUE_INVALIDAM_REFERENCIA: TipoAlertaUsina[] = [
  "falha",
  "sem_comunicacao",
  "sem_geracao",
  "potencia_baixa",
];

export type LeituraDeReferencia = {
  dataRef: string;
  comunicando: boolean;
  /** Nulo = a API não devolveu o ponto de medição. Nunca tratar como zero. */
  valor: number | null;
  /** Havia alerta de TIPOS_QUE_INVALIDAM_REFERENCIA aberto naquele dia. */
  diaComAlerta: boolean;
};

export function leituraValida(leitura: LeituraDeReferencia) {
  return leitura.comunicando && leitura.valor !== null && !leitura.diaComAlerta;
}

/**
 * Mediana, e não média: um único dia atípico — um domingo nublado, uma limpeza
 * de painel no meio da tarde — desloca a média o bastante para calar o alerta
 * no dia seguinte. A mediana ignora o ponto fora da curva.
 */
export function mediana(valores: number[]): number | null {
  if (!valores.length) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 1
    ? ordenados[meio]
    : (ordenados[meio - 1] + ordenados[meio]) / 2;
}

export type Referencia = { mediana: number; amostras: number };

/**
 * Referência da usina para uma janela. Recebe as leituras JÁ filtradas por
 * janela e ordenadas da mais recente para a mais antiga; devolve null quando
 * não há amostra suficiente.
 */
export function referenciaDeNormalidade(
  leituras: LeituraDeReferencia[],
  minimo = MIN_LEITURAS_REFERENCIA
): Referencia | null {
  const validas = leituras
    .filter(leituraValida)
    .slice(0, DIAS_JANELA_REFERENCIA)
    .map((l) => l.valor as number);

  if (validas.length < minimo) return null;

  const central = mediana(validas);
  return central === null ? null : { mediana: central, amostras: validas.length };
}

// --- Limiares dos alertas -------------------------------------------------

/** Abaixo de metade do próprio padrão, ao meio-dia, alguma coisa está errada. */
export const FATOR_POTENCIA_BAIXA = 0.5;

/**
 * Um pouco acima de zero porque inversor ligado consome e reporta frações de
 * kWh mesmo sem gerar: exigir exatamente 0 deixaria passar a usina parada que
 * registrou 0,3 kWh de autoconsumo.
 */
export const LIMIAR_SEM_GERACAO_KWH = 1;

/**
 * Cada tipo de alerta só é avaliado na janela em que a medida significa alguma
 * coisa. Avaliar geração de manhã acusaria toda usina do Brasil todo dia, e
 * comparar potência instantânea às 18h compararia crepúsculo com meio-dia.
 */
export const JANELA_DE_AVALIACAO: Record<
  Exclude<TipoAlertaUsina, "plano_a_vencer">,
  JanelaColetaUsina | "todas"
> = {
  falha: "todas",
  sem_comunicacao: "manha",
  sem_geracao: "fim_tarde",
  potencia_baixa: "meio_dia",
};

export function avaliadoNaJanela(
  tipo: Exclude<TipoAlertaUsina, "plano_a_vencer">,
  janela: JanelaColetaUsina
) {
  const alvo = JANELA_DE_AVALIACAO[tipo];
  return alvo === "todas" || alvo === janela;
}

/** Sem geração no dia. Valor nulo é "sem dado" e NÃO dispara alerta. */
export function semGeracao(energiaDiaKwh: number | null) {
  return energiaDiaKwh !== null && energiaDiaKwh < LIMIAR_SEM_GERACAO_KWH;
}

/** Potência ao meio-dia contra a mediana. Sem referência, não se avalia. */
export function potenciaBaixa(potenciaKw: number | null, referencia: Referencia | null) {
  if (potenciaKw === null || referencia === null) return false;
  return potenciaKw <= referencia.mediana * FATOR_POTENCIA_BAIXA;
}

/** Percentual da potência atual sobre a referência — para o painel. */
export function percentualDaReferencia(potenciaKw: number | null, referencia: Referencia | null) {
  if (potenciaKw === null || referencia === null || referencia.mediana === 0) return null;
  return Math.round((potenciaKw / referencia.mediana) * 100);
}

/**
 * Coletas seguidas sem o alarme para dar a falha por encerrada. Uma só não
 * basta: a API do iSolarCloud oscila, e fechar na primeira ausência faria a
 * mesma falha abrir e fechar em ciclo, notificando a cada volta.
 */
export const COLETAS_SEM_ALARME_PARA_ENCERRAR = 2;

// --- Chave de deduplicação ------------------------------------------------

/**
 * A `referencia` do alerta, e é ela que faz o módulo inteiro funcionar.
 *
 * Ela precisa ser estável enquanto o problema é o mesmo — senão a usina parada
 * abriria um alerta a cada coleta, três por dia — e precisa MUDAR quando o
 * problema reaparece depois de resolvido, senão a segunda queda ficaria muda
 * porque a primeira já ocupou a chave única.
 *
 * Por isso quase todas carregam a dataRef: o problema de hoje é outro problema.
 * A de falha carrega o código, o dispositivo e a detecção, porque duas strings
 * diferentes com o mesmo defeito são dois alertas. A de plano carrega o
 * manutencaoFim — prorrogar o contrato gera aviso novo na nova data, e não
 * ressuscita o antigo.
 */
export function referenciaAlerta(
  tipo: TipoAlertaUsina,
  dados: {
    dataRef?: string;
    codigo?: string;
    dispositivo?: string | null;
    detectadaEm?: string;
    manutencaoFim?: string | null;
  }
): string {
  switch (tipo) {
    case "falha":
      return [dados.codigo ?? "sem-codigo", dados.dispositivo ?? "planta", dados.detectadaEm ?? ""]
        .join("|");
    case "plano_a_vencer":
      return dados.manutencaoFim?.slice(0, 10) ?? "sem-vigencia";
    default:
      return dados.dataRef ?? "";
  }
}

// --- Repetição ------------------------------------------------------------

/**
 * Alerta em aberto renotifica a cada 3 dias. Não a cada coleta: seriam três
 * avisos por dia da mesma usina parada, e o aviso vira ruído que a equipe
 * aprende a ignorar — que é o oposto do que o módulo existe para fazer.
 */
export const DIAS_ENTRE_RENOTIFICACOES = 3;

export type AlertaParaNotificar = {
  situacao: SituacaoAlertaUsina;
  ultimaNotificacaoEm: string | null;
};

export function deveNotificar(alerta: AlertaParaNotificar, agora = Date.now()) {
  if (alerta.situacao !== "aberto") return false;
  if (!alerta.ultimaNotificacaoEm) return true;
  const decorridos = agora - new Date(alerta.ultimaNotificacaoEm).getTime();
  return decorridos >= DIAS_ENTRE_RENOTIFICACOES * 86_400_000;
}

/**
 * Sufixo do ciclo na referência da NotificacaoMonitoramento. A referência do
 * alerta sozinha esbarraria no upsert na segunda rodada, e a renotificação de 3
 * dias não apareceria para ninguém.
 */
export function referenciaNotificacao(referenciaDoAlerta: string, data = dataRefBrasil()) {
  return `${referenciaDoAlerta}#${data}`;
}

// --- WhatsApp -------------------------------------------------------------
// O número é o MESMO do atendimento ao cliente. Se ele cair, cai o atendimento
// junto — risco registrado e aceito pelo sócio-diretor. Tudo aqui existe para
// reduzir a chance de bloqueio, e nada disso é opcional.

/**
 * ATENÇÃO — CONFLITO NO ESCOPO, resolvido pelo lado mais restritivo. A seção 2
 * ("decisões já tomadas") manda só falha e 0 kWh; a seção 9.2 acrescenta sem
 * comunicação. Vale a seção 2, porque é a lista de decisões fechadas e porque
 * menos mensagem é menos exposição do número. Se o Álvaro quiser sem_comunicacao
 * no WhatsApp, é acrescentar aqui — e em lugar nenhum mais.
 *
 * Potência baixa e plano a vencer NUNCA vão: a primeira é diagnóstico que pede
 * análise, a segunda é assunto comercial. Nenhuma das duas é urgente o
 * bastante para justificar uma mensagem no número do atendimento.
 */
export const TIPOS_ALERTA_WHATSAPP: TipoAlertaUsina[] = ["falha", "sem_geracao"];

export function vaiParaWhatsapp(tipo: TipoAlertaUsina) {
  return TIPOS_ALERTA_WHATSAPP.includes(tipo);
}

export type JanelaEnvio = {
  horaInicioAvisoMonitoramento: string;
  horaFimAvisoMonitoramento: string;
};

/**
 * Alerta gerado fora da janela ESPERA a próxima — não é descartado. A coleta do
 * fim de tarde pode terminar depois das 20h num dia de API lenta, e mensagem de
 * madrugada é o padrão de uso que mais chama atenção do antispam da Meta.
 */
export function dentroDaJanelaDeEnvio(janela: JanelaEnvio, instante: Date = new Date()) {
  const agora = minutosDoDiaBrasil(instante);
  return (
    agora >= minutosDeHora(janela.horaInicioAvisoMonitoramento) &&
    agora < minutosDeHora(janela.horaFimAvisoMonitoramento)
  );
}

/**
 * Acima disso, a mesma execução manda UMA mensagem consolidada por
 * destinatário em vez de várias. Quatro mensagens seguidas para o mesmo número
 * em segundos é exatamente a assinatura de disparo em massa.
 */
export const MAX_ALERTAS_ANTES_DE_AGRUPAR = 3;

export function deveAgrupar(quantidadeDeAlertas: number) {
  return quantidadeDeAlertas > MAX_ALERTAS_ANTES_DE_AGRUPAR;
}

/** Tentativas de envio antes de desistir. Repetir sem fim castiga o número. */
export const MAX_TENTATIVAS_ENVIO = 2;

// --- Ordenação do painel --------------------------------------------------
// Falha e sem comunicação primeiro: são as únicas em que a usina pode estar
// parada agora, perdendo geração a cada hora que passa.

const GRAVIDADE: Record<TipoAlertaUsina, number> = {
  falha: 0,
  sem_comunicacao: 1,
  sem_geracao: 2,
  potencia_baixa: 3,
  plano_a_vencer: 4,
};

export type AlertaOrdenavel = { tipo: TipoAlertaUsina; abertoEm: string };

export function ordenarAlertas<T extends AlertaOrdenavel>(alertas: T[]): T[] {
  return [...alertas].sort((a, b) => {
    const porGravidade = GRAVIDADE[a.tipo] - GRAVIDADE[b.tipo];
    if (porGravidade !== 0) return porGravidade;
    // Empate: o mais antigo primeiro — é o que está sem resposta há mais tempo.
    return a.abertoEm.localeCompare(b.abertoEm);
  });
}

// --- Comparativo mensal ---------------------------------------------------
// Existe porque a referência de 7 dias tem um ponto cego: degradação lenta
// (painel sujando, string desconectada, inversor perdendo rendimento) arrasta a
// mediana para baixo junto, e o alerta nunca dispara. A comparação contra o
// mesmo mês do ano anterior é o que enxerga esse tipo de problema.
//
// NÃO notifica: é indicador de análise, e transformá-lo em alerta encheria o
// painel de aviso em todo mês mais chuvoso que o do ano passado.

export const QUEDA_MENSAL_PARA_DESTAQUE = 0.15;

/** "YYYY-MM" do mesmo mês no ano anterior. */
export function mesmoMesAnoAnterior(dataRef: string) {
  const [ano, mes] = dataRef.slice(0, 7).split("-");
  return `${Number(ano) - 1}-${mes}`;
}

export type ComparativoMensal = {
  variacao: number;
  destacar: boolean;
};

/**
 * Devolve null quando não há base — no primeiro ano de operação a tela mostra
 * "sem histórico", e não uma queda de 100%.
 */
export function comparativoMensal(
  energiaMesKwh: number | null,
  energiaMesmoMesAnoAnterior: number | null
): ComparativoMensal | null {
  if (
    energiaMesKwh === null ||
    energiaMesmoMesAnoAnterior === null ||
    energiaMesmoMesAnoAnterior === 0
  ) {
    return null;
  }
  const variacao = (energiaMesKwh - energiaMesmoMesAnoAnterior) / energiaMesmoMesAnoAnterior;
  return { variacao, destacar: variacao <= -QUEDA_MENSAL_PARA_DESTAQUE };
}

// --- Texto do alerta ------------------------------------------------------

export type DadosDoAlerta = {
  tipo: TipoAlertaUsina;
  usina: string;
  cliente: string;
  valorObservado?: number | null;
  valorReferencia?: number | null;
  detalhe?: string | null;
};

/** Uma linha, para o card do painel, o sino e o WhatsApp. */
export function mensagemDoAlerta(dados: DadosDoAlerta): string {
  const alvo = `${dados.usina} (${dados.cliente})`;
  switch (dados.tipo) {
    case "falha":
      return `${alvo}: ${dados.detalhe ?? "falha ativa no equipamento"}.`;
    case "sem_comunicacao":
      return `${alvo}: a usina não está reportando ao iSolarCloud.`;
    case "sem_geracao":
      return `${alvo}: nenhuma geração registrada no dia (${formatarKwh(dados.valorObservado)}).`;
    case "potencia_baixa":
      return (
        `${alvo}: potência ao meio-dia em ${formatarKw(dados.valorObservado)}, ` +
        `contra ${formatarKw(dados.valorReferencia)} de padrão da própria usina.`
      );
    case "plano_a_vencer":
      return `${alvo}: o plano de manutenção vence em ${dados.detalhe ?? "breve"}.`;
  }
}

/**
 * Descrição que já vai preenchida no formulário de chamado. O alerta não abre
 * chamado sozinho — a decisão é humana —, mas quem decide abrir não deve ter de
 * redigitar o que o painel já sabe.
 */
export function descricaoInicialChamado(dados: DadosDoAlerta, dataRef = dataRefBrasil()) {
  const linhas = [
    `Aberto a partir do monitoramento em ${formatarData(dataRef)}.`,
    `Alerta: ${ROTULO_TIPO_ALERTA[dados.tipo].texto}.`,
    mensagemDoAlerta(dados),
  ];
  return linhas.join("\n");
}

function formatarKw(valor: number | null | undefined) {
  return valor === null || valor === undefined ? "—" : `${valor.toFixed(1)} kW`;
}

function formatarKwh(valor: number | null | undefined) {
  return valor === null || valor === undefined ? "sem dado" : `${valor.toFixed(1)} kWh`;
}
