// Integração com a API do iSolarCloud (Sungrow). SERVER ONLY: carrega appkey,
// secret e senha das variáveis de ambiente e nunca pode ser importado por
// Client Component.
//
// REGRA QUE REGE ESTE ARQUIVO INTEIRO: falha de rede e erro da API são FALHA DE
// COLETA, nunca "usina em falha". São coisas diferentes, e confundi-las gera
// alerta falso em massa toda vez que o iSolarCloud sair do ar — que é o jeito
// mais rápido de a equipe deixar de confiar no painel. Por isso nenhuma função
// aqui lança exceção nem devolve valor "vazio": todas devolvem Resultado<T>,
// e quem chama é obrigado a distinguir os dois casos.
//
// Campo ausente é "sem dado", NUNCA zero. Zero é o que dispara alerta de usina
// parada.
//
// --- O CONTRATO ABAIXO FOI DESCOBERTO CONTRA A CONTA REAL, NÃO ASSUMIDO ------
//
// 1. Gateway: gateway.isolarcloud.com.hk (internacional). Os outros três
//    (China, Europa, Austrália) recusam o appkey com er_invalid_appkey — o
//    appkey só vale no gateway da região da conta.
//
// 2. Autenticação: modo V1. POST /openapi/login com appkey no corpo e o secret
//    no header x-access-key devolve result_data.token, e esse token vai NO
//    CORPO das chamadas seguintes. Não há Bearer.
//
// 3. Namespace: /openapi/<metodo>, e NÃO /openapi/platform/<metodo>. O
//    namespace platform responde 401 "Invalid access token: null" para
//    qualquer token de login — ele é do fluxo OAuth2, que esta aplicação não
//    usa.
//
// 4. Paginação: o parâmetro é `curPage`, não `page`. Com `page` a API responde
//    009 er_missing_parameter:curPage.
//
// 5. Grandezas vêm como {"unit":"kW","value":"7.865"} e A UNIDADE VARIA POR
//    PLANTA — foram vistos kW e W na mesma conta, e MWh e GWh para energia
//    total. Ler o `value` sem olhar o `unit` faria uma planta que reporta em W
//    parecer gerar mil vezes mais, e o alerta de potência baixa nunca dispararia
//    para ela. Ver converter().

const BASE_URL = (process.env.ISOLARCLOUD_BASE_URL ?? "").replace(/\/$/, "");
const APP_KEY = process.env.ISOLARCLOUD_APP_KEY ?? "";
const ACCESS_KEY = process.env.ISOLARCLOUD_ACCESS_KEY ?? "";
const USUARIO = process.env.ISOLARCLOUD_USUARIO ?? "";
const SENHA = process.env.ISOLARCLOUD_SENHA ?? "";

// A resposta vem em chinês quando o idioma não é pedido explicitamente.
const IDIOMA = "_en_US";

const TEMPO_LIMITE_MS = 20_000;

/**
 * Espaçamento mínimo entre chamadas.
 *
 * O limite de requisição da conta não está documentado no portal. Como a lista
 * de plantas já traz potência e geração de todas as usinas de uma vez, a coleta
 * inteira cabe em 2 chamadas para 150 usinas — então ir devagar não custa nada.
 */
const INTERVALO_ENTRE_CHAMADAS_MS = Number(process.env.ISOLARCLOUD_INTERVALO_MS ?? 400);

/**
 * Validade do token no cache.
 *
 * O /openapi/login não devolve expiração, então o cache é por tempo fixo com
 * margem folgada, e uma resposta de token inválido derruba o cache e refaz o
 * login uma vez. Pedir token novo a cada chamada seria um login por janela por
 * planta — volume que chama atenção de qualquer antiabuso.
 */
const VALIDADE_TOKEN_MS = 30 * 60_000;

export function integracaoConfigurada() {
  return BASE_URL !== "" && APP_KEY !== "" && ACCESS_KEY !== "";
}

/** O que falta preencher no .env — para a tela dizer isso em vez de "erro". */
export function credenciaisFaltando(): string[] {
  const faltando: string[] = [];
  if (!BASE_URL) faltando.push("ISOLARCLOUD_BASE_URL");
  if (!APP_KEY) faltando.push("ISOLARCLOUD_APP_KEY");
  if (!ACCESS_KEY) faltando.push("ISOLARCLOUD_ACCESS_KEY");
  if (!USUARIO) faltando.push("ISOLARCLOUD_USUARIO");
  if (!SENHA) faltando.push("ISOLARCLOUD_SENHA");
  return faltando;
}

export type Resultado<T> =
  | { ok: true; dados: T }
  | {
      ok: false;
      /** Texto para a tela e para o registro da falha de coleta. */
      erro: string;
      /** Código devolvido pela API, quando houve resposta. */
      codigo?: string;
    };

// --- Espaçamento ----------------------------------------------------------
// Fila em série no módulo: uma chamada por vez, com intervalo entre elas.
// Rajada paralela contra a mesma conta é o padrão que qualquer gateway lê como
// abuso, e a coleta não tem pressa nenhuma.

let ultimaChamada = 0;
let fila: Promise<unknown> = Promise.resolve();

function enfileirar<T>(tarefa: () => Promise<T>): Promise<T> {
  const proxima = fila.then(async () => {
    const espera = INTERVALO_ENTRE_CHAMADAS_MS - (Date.now() - ultimaChamada);
    if (espera > 0) await new Promise((r) => setTimeout(r, espera));
    ultimaChamada = Date.now();
    return tarefa();
  });
  // A fila não pode morrer por causa de uma falha: sem este catch, o primeiro
  // erro deixaria todas as chamadas seguintes penduradas na promise rejeitada.
  fila = proxima.catch(() => undefined);
  return proxima;
}

// --- Envelope da API ------------------------------------------------------

type Envelope = {
  result_code?: string;
  result_msg?: string;
  result_data?: unknown;
};

/** A API responde 200 com result_code de erro; só "1" é sucesso. */
const CODIGO_SUCESSO = "1";

async function chamar<T>(caminho: string, corpo: Record<string, unknown>): Promise<Resultado<T>> {
  if (!integracaoConfigurada()) {
    return {
      ok: false,
      erro: `Integração do iSolarCloud não configurada (falta ${credenciaisFaltando().join(", ")}).`,
    };
  }

  return enfileirar(async () => {
    // Timeout explícito: sem ele, um gateway fora do ar deixaria a coleta
    // pendurada até o limite da plataforma e a janela inteira se perderia.
    const cancelar = AbortSignal.timeout(TEMPO_LIMITE_MS);

    try {
      const resposta = await fetch(`${BASE_URL}${caminho}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // O secret vai no header; o appkey e o token vão no corpo.
          "x-access-key": ACCESS_KEY,
        },
        body: JSON.stringify({ appkey: APP_KEY, lang: IDIOMA, ...corpo }),
        signal: cancelar,
        cache: "no-store",
      });

      const texto = await resposta.text();

      if (!resposta.ok) {
        return {
          ok: false,
          codigo: String(resposta.status),
          erro: `iSolarCloud respondeu HTTP ${resposta.status} em ${caminho}: ${texto.slice(0, 300)}`,
        };
      }

      let envelope: Envelope;
      try {
        envelope = JSON.parse(texto) as Envelope;
      } catch {
        return { ok: false, erro: `Resposta ilegível do iSolarCloud: ${texto.slice(0, 300)}` };
      }

      if (envelope.result_code !== CODIGO_SUCESSO) {
        // E900 é "sua aplicação não tem permissão para esta interface", e não
        // "deu erro agora": a liberação é por interface no portal do
        // desenvolvedor. Vale dizer isso na mensagem, senão o diagnóstico manda
        // procurar no lugar errado.
        const dica =
          envelope.result_msg === "Unauthorized access"
            ? " — a interface não está liberada para esta aplicação no portal do desenvolvedor."
            : "";
        return {
          ok: false,
          codigo: envelope.result_code,
          erro: `iSolarCloud recusou ${caminho} (${envelope.result_code}): ${
            envelope.result_msg ?? "sem mensagem"
          }${dica}`,
        };
      }

      return { ok: true, dados: envelope.result_data as T };
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      return { ok: false, erro: `Falha de rede ao chamar o iSolarCloud: ${mensagem}` };
    }
  });
}

// --- Token ----------------------------------------------------------------

let tokenEmCache: { token: string; expiraEm: number } | null = null;

async function obterToken(forcarNovo = false): Promise<Resultado<string>> {
  if (!forcarNovo && tokenEmCache && tokenEmCache.expiraEm > Date.now()) {
    return { ok: true, dados: tokenEmCache.token };
  }

  if (!USUARIO || !SENHA) {
    return {
      ok: false,
      erro: "Integração do iSolarCloud sem usuário/senha (ISOLARCLOUD_USUARIO, ISOLARCLOUD_SENHA).",
    };
  }

  const resultado = await chamar<{ token?: string; user_id?: string | number }>("/openapi/login", {
    user_account: USUARIO,
    user_password: SENHA,
  });

  if (!resultado.ok) return resultado;

  const token = resultado.dados?.token;
  if (!token) {
    return { ok: false, erro: "O iSolarCloud aceitou o login mas não devolveu token." };
  }

  tokenEmCache = { token, expiraEm: Date.now() + VALIDADE_TOKEN_MS };
  return { ok: true, dados: token };
}

/**
 * "Seu token não vale mais" é diferente de "deu erro" — o primeiro se resolve
 * refazendo o login, o segundo não.
 *
 * A checagem olha a mensagem além do código porque a API reaproveita códigos
 * genéricos: E00000 serve tanto para appkey inválido quanto para outras
 * recusas. Confiar só no código faria a integração ou nunca renovar o token, ou
 * entrar em laço de login quando o problema é outro.
 */
function tokenExpirou(codigo: string | undefined, mensagem: string) {
  if (codigo === "401") return true;
  const texto = mensagem.toLowerCase();
  return texto.includes("token") && (texto.includes("invalid") || texto.includes("expire"));
}

/**
 * Chamada autenticada, com uma — e só uma — retentativa quando o token expira.
 *
 * Uma só de propósito: se o login em si estiver quebrado (senha trocada,
 * aplicação suspensa), repetir vira laço de login contra a conta.
 */
async function chamarAutenticado<T>(
  caminho: string,
  corpo: Record<string, unknown>
): Promise<Resultado<T>> {
  const token = await obterToken();
  if (!token.ok) return token;

  const primeira = await chamar<T>(caminho, { ...corpo, token: token.dados });
  if (primeira.ok || !tokenExpirou(primeira.codigo, primeira.erro)) return primeira;

  const novo = await obterToken(true);
  if (!novo.ok) return novo;
  return chamar<T>(caminho, { ...corpo, token: novo.dados });
}

// --- Leitura de grandezas -------------------------------------------------

type Registro = Record<string, unknown>;

/**
 * Fatores para a unidade base de cada grandeza (kW, kWh, kWp).
 *
 * Existe porque a unidade VARIA POR PLANTA na mesma conta — a sondagem achou
 * curr_power em kW e em W, e total_energy em MWh e em GWh. Uma unidade
 * desconhecida devolve null (sem dado), e nunca o número cru: número certo com
 * unidade errada é pior que dado faltando, porque passa despercebido.
 */
const FATOR_PARA_BASE: Record<string, number> = {
  w: 0.001,
  kw: 1,
  mw: 1000,
  gw: 1_000_000,
  wh: 0.001,
  kwh: 1,
  mwh: 1000,
  gwh: 1_000_000,
  wp: 0.001,
  kwp: 1,
  mwp: 1000,
};

function numeroCru(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor !== "string") return null;
  const limpo = valor.trim();
  if (limpo === "" || limpo === "--") return null;
  const convertido = Number(limpo);
  return Number.isFinite(convertido) ? convertido : null;
}

/**
 * Grandeza {unit, value} convertida para a unidade base (kW / kWh / kWp).
 * Aceita também número solto, para os campos que não vêm embrulhados.
 */
function converter(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null;

  if (typeof valor === "object") {
    const registro = valor as Registro;
    const numero = numeroCru(registro.value);
    if (numero === null) return null;
    const unidade = typeof registro.unit === "string" ? registro.unit.trim().toLowerCase() : "";
    if (unidade === "") return numero;
    const fator = FATOR_PARA_BASE[unidade];
    return fator === undefined ? null : numero * fator;
  }

  return numeroCru(valor);
}

function texto(valor: unknown): string | null {
  if (typeof valor === "string" && valor.trim() !== "") return valor.trim();
  if (typeof valor === "number") return String(valor);
  return null;
}

function comoLista(valor: unknown): Registro[] {
  return Array.isArray(valor) ? (valor.filter((i) => typeof i === "object" && i) as Registro[]) : [];
}

function inteiro(valor: unknown): number | null {
  const n = numeroCru(valor);
  return n === null ? null : Math.trunc(n);
}

// --- Plantas --------------------------------------------------------------

/**
 * ps_fault_status = 3 é o estado normal: 146 das 150 plantas da conta estavam
 * nele na sondagem, e as outras quatro em 1 ou 2. O significado exato de cada
 * código não está documentado, então o valor cru vai junto e a decisão de
 * "está em falha" se apoia em alarmes/falhas contados, que são inequívocos.
 */
const FALHA_NORMAL = 3;

export type UsinaIsolar = {
  psId: string;
  nome: string;
  potenciaKwp: number | null;
  /** kW, já normalizado a partir do unit da própria planta. */
  potenciaAtualKw: number | null;
  energiaDiaKwh: number | null;
  energiaTotalKwh: number | null;
  /**
   * Instante em que a planta atualizou a potência, COMO A API MANDOU (com
   * offset, normalmente +08:00). Não converter aqui: quem grava a leitura é
   * que decide o dia solar em horário do Brasil.
   */
  atualizadoEm: string | null;
  /** ps_status cru. 0 e 1 aparecem na conta; 1 é a maioria. */
  status: number | null;
  /** ps_fault_status cru. */
  statusFalha: number | null;
  alarmes: number;
  falhas: number;
  /** Resposta bruta da planta — vai para o payload de depuração da leitura. */
  bruto: Registro;
};

const TAMANHO_PAGINA = 100;

/**
 * Todas as plantas da conta.
 *
 * Esta única chamada já traz potência instantânea, geração do dia e contagem de
 * alarme de TODAS as usinas — 150 delas cabem em duas páginas. É por isso que a
 * coleta não precisa de uma chamada por usina: além de mais rápido, é o que
 * mantém o consumo longe de qualquer limite de requisição.
 */
export async function listarUsinas(): Promise<Resultado<UsinaIsolar[]>> {
  const usinas: UsinaIsolar[] = [];
  const vistos = new Set<string>();

  // Teto de páginas para não virar laço infinito se a API devolver sempre a
  // mesma página — comportamento já visto em gateway com paginação quebrada.
  for (let pagina = 1; pagina <= 30; pagina++) {
    const resposta = await chamarAutenticado<Registro>("/openapi/getPowerStationList", {
      // `curPage`, não `page`: com `page` a API responde er_missing_parameter.
      curPage: pagina,
      size: TAMANHO_PAGINA,
    });

    if (!resposta.ok) return resposta;

    const lista = comoLista(resposta.dados?.pageList);
    if (!lista.length) break;

    let novas = 0;
    for (const item of lista) {
      const psId = texto(item.ps_id);
      if (!psId || vistos.has(psId)) continue;
      vistos.add(psId);
      novas++;

      usinas.push({
        psId,
        nome: texto(item.ps_name) ?? psId,
        // "total_capcity" está escrito errado na API mesmo; é o nome real.
        potenciaKwp: converter(item.total_capcity),
        potenciaAtualKw: converter(item.curr_power),
        energiaDiaKwh: converter(item.today_energy),
        energiaTotalKwh: converter(item.total_energy),
        atualizadoEm: texto(item.curr_power_update_time),
        status: inteiro(item.ps_status),
        statusFalha: inteiro(item.ps_fault_status),
        alarmes: inteiro(item.alarm_count) ?? 0,
        falhas: inteiro(item.fault_count) ?? 0,
        bruto: item,
      });
    }

    if (novas === 0 || lista.length < TAMANHO_PAGINA) break;
  }

  return { ok: true, dados: usinas };
}

/** A planta está reportando. Só isso — não diz se está gerando bem. */
export function estaComunicando(usina: UsinaIsolar) {
  return usina.status === 1;
}

/**
 * A planta acusa problema. Combina as duas fontes disponíveis: a contagem de
 * alarme/falha (inequívoca) e o ps_fault_status fora do valor normal.
 */
export function acusaFalha(usina: UsinaIsolar) {
  if (usina.alarmes > 0 || usina.falhas > 0) return true;
  return usina.statusFalha !== null && usina.statusFalha !== FALHA_NORMAL;
}

// --- Detalhe --------------------------------------------------------------

export type DetalheIsolar = {
  psId: string;
  nome: string | null;
  potenciaKwp: number | null;
  localizacao: string | null;
  dataInstalacao: string | null;
  bruto: Registro;
};

export async function carregarDetalheUsina(psId: string): Promise<Resultado<DetalheIsolar>> {
  const resposta = await chamarAutenticado<Registro>("/openapi/getPowerStationDetail", {
    ps_id: psId,
  });
  if (!resposta.ok) return resposta;

  const dados = resposta.dados ?? {};
  return {
    ok: true,
    dados: {
      psId,
      nome: texto(dados.ps_name),
      potenciaKwp: converter(dados.design_capacity ?? dados.total_capcity),
      localizacao: texto(dados.ps_location),
      dataInstalacao: texto(dados.install_date),
      bruto: dados,
    },
  };
}

// --- Dispositivos ---------------------------------------------------------

/**
 * ATENÇÃO — A LISTA DE ALARMES NÃO ESTÁ DISPONÍVEL.
 *
 * Os cinco nomes candidatos de endpoint de alarme (getAlarmList,
 * getPowerStationAlarmList, getFaultList, getPsAlarmList, getAlarmInfoList)
 * respondem E900 "Unauthorized access" — a interface não está liberada para
 * esta aplicação no portal do desenvolvedor. Enquanto ela não for liberada, o
 * sinal de falha disponível é o de PLANTA (alarm_count / fault_count /
 * ps_fault_status, ver acusaFalha) e o de DISPOSITIVO abaixo, que dizem QUE há
 * problema mas não QUAL — sem código nem descrição do alarme.
 *
 * Consequência para o módulo: o alerta de falha consegue nascer, mas a
 * FalhaUsina não tem código nem descrição de verdade até a liberação.
 */
export type DispositivoIsolar = {
  psId: string;
  psKey: string | null;
  uuid: string | null;
  nome: string | null;
  tipo: number | null;
  modelo: string | null;
  numeroSerie: string | null;
  /** dev_fault_status cru, sem tradução: a escala varia por modelo. */
  statusFalha: number | null;
  status: string | null;
};

export async function listarDispositivos(psId: string): Promise<Resultado<DispositivoIsolar[]>> {
  const resposta = await chamarAutenticado<Registro>("/openapi/getDeviceList", {
    ps_id: psId,
    curPage: 1,
    size: TAMANHO_PAGINA,
  });
  if (!resposta.ok) return resposta;

  const dispositivos = comoLista(resposta.dados?.pageList).map((item) => ({
    psId,
    psKey: texto(item.ps_key),
    uuid: texto(item.uuid),
    nome: texto(item.device_name),
    tipo: inteiro(item.device_type),
    modelo: texto(item.device_model_code),
    numeroSerie: texto(item.device_sn),
    statusFalha: inteiro(item.dev_fault_status),
    status: texto(item.dev_status),
  }));

  return { ok: true, dados: dispositivos };
}

// --- Diagnóstico ----------------------------------------------------------

export type Diagnostico = {
  configurada: boolean;
  faltando: string[];
  baseUrl: string;
  loginOk: boolean;
  usinasEncontradas: number | null;
  erro: string | null;
};

/**
 * Testa a integração de ponta a ponta e devolve o erro cru.
 *
 * Foi assim que se descobriu o gateway certo e o namespace certo: em vez de
 * adivinhar, a tela mostra exatamente o que a API respondeu — o que permite
 * corrigir o .env sem um ciclo de deploy por tentativa.
 */
export async function diagnosticar(): Promise<Diagnostico> {
  const base: Diagnostico = {
    configurada: integracaoConfigurada(),
    faltando: credenciaisFaltando(),
    baseUrl: BASE_URL || "(não definida)",
    loginOk: false,
    usinasEncontradas: null,
    erro: null,
  };

  if (base.faltando.length) {
    return { ...base, erro: `Falta preencher no .env: ${base.faltando.join(", ")}.` };
  }

  // Token novo de propósito: um cache válido esconderia justamente o problema
  // de credencial que se quer diagnosticar.
  const token = await obterToken(true);
  if (!token.ok) return { ...base, erro: token.erro };

  const usinas = await listarUsinas();
  if (!usinas.ok) return { ...base, loginOk: true, erro: usinas.erro };

  return { ...base, loginOk: true, usinasEncontradas: usinas.dados.length };
}
