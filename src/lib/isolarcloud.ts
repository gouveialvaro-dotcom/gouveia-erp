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
// Campo ausente na resposta é "sem dado", NUNCA zero. Zero é o que dispara
// alerta de usina parada.
//
// A API é imatura: os pontos de medição variam por modelo de inversor e a
// resposta às vezes volta em chinês mesmo pedindo inglês. Nada aqui assume que
// um campo existe.

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
 * O limite de requisição da conta não está documentado no portal e não foi
 * confirmado (ponto 12.3 do escopo). Até saber, o intervalo é conservador: a
 * coleta roda 3x ao dia sobre poucas dezenas de usinas, então ir devagar não
 * custa nada e estourar cota custa a coleta do dia inteiro.
 */
const INTERVALO_ENTRE_CHAMADAS_MS = Number(process.env.ISOLARCLOUD_INTERVALO_MS ?? 400);

/**
 * Validade do token no cache.
 *
 * O /openapi/login não devolve expiração confiável, então o cache é por tempo
 * fixo com margem folgada, e qualquer resposta de token inválido derruba o
 * cache e refaz o login uma vez. Pedir token novo a cada chamada seria um
 * login por planta por janela — volume que chama atenção de qualquer antiabuso.
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
          // O secret vai no header, não no corpo.
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
          erro: `iSolarCloud respondeu HTTP ${resposta.status}: ${texto.slice(0, 300)}`,
        };
      }

      let envelope: Envelope;
      try {
        envelope = JSON.parse(texto) as Envelope;
      } catch {
        return { ok: false, erro: `Resposta ilegível do iSolarCloud: ${texto.slice(0, 300)}` };
      }

      if (envelope.result_code !== CODIGO_SUCESSO) {
        return {
          ok: false,
          codigo: envelope.result_code,
          erro: `iSolarCloud recusou a chamada ${caminho} (${envelope.result_code}): ${
            envelope.result_msg ?? "sem mensagem"
          }`,
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

/**
 * Modo de autenticação: aplicação V1 (appkey + secret + login do usuário).
 *
 * O portal também oferece OAuth2, com fluxo de authorization code e redirect —
 * que não dá para completar sem interação humana e sem uma URL de callback
 * registrada. Se a aplicação 1908 tiver sido aprovada em OAuth2, o login abaixo
 * é recusado pela API e a mensagem de erro diz isso; a saída é pedir a troca
 * para V1 no portal, ou implementar o fluxo de código à parte.
 */
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
 * A checagem é pela MENSAGEM e não só pelo código porque a API reaproveita
 * códigos genéricos: uma sonda contra o gateway internacional devolveu
 * `E00000 / er_invalid_appkey`, ou seja, o mesmo E00000 serve para credencial
 * errada e para qualquer outra recusa. Confiar só no código faria a integração
 * ou nunca renovar o token, ou entrar em laço de login quando o problema é
 * outro.
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
  if (primeira.ok || !tokenExpirou(primeira.codigo, primeira.erro)) {
    return primeira;
  }

  const novo = await obterToken(true);
  if (!novo.ok) return novo;
  return chamar<T>(caminho, { ...corpo, token: novo.dados });
}

// --- Utilidades de leitura ------------------------------------------------

/**
 * Número a partir do que a API mandou. String vazia, "--", null e texto não
 * numérico viram null — nunca zero, porque zero dispara alerta de usina parada.
 */
function numero(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor !== "string") return null;
  const limpo = valor.trim();
  if (limpo === "" || limpo === "--") return null;
  const convertido = Number(limpo);
  return Number.isFinite(convertido) ? convertido : null;
}

function texto(valor: unknown): string | null {
  if (typeof valor === "string" && valor.trim() !== "") return valor.trim();
  if (typeof valor === "number") return String(valor);
  return null;
}

type Registro = Record<string, unknown>;

function comoLista(valor: unknown): Registro[] {
  return Array.isArray(valor) ? (valor.filter((i) => typeof i === "object" && i) as Registro[]) : [];
}

/**
 * Primeiro campo presente entre vários nomes possíveis.
 *
 * Existe porque os nomes de ponto variam por modelo de inversor e por versão da
 * API — a mesma grandeza aparece ora como `ps_capacity_kw`, ora como
 * `total_capcity` (com o erro de digitação que a Sungrow mantém). Escolher um
 * só nome faria a integração funcionar numa usina e falhar calada na seguinte.
 */
function primeiroPresente(registro: Registro, ...nomes: string[]): unknown {
  for (const nome of nomes) {
    if (registro[nome] !== undefined && registro[nome] !== null) return registro[nome];
  }
  return null;
}

// --- Plantas --------------------------------------------------------------

export type UsinaIsolar = {
  psId: string;
  nome: string;
  potenciaKwp: number | null;
  /** Como a API descreve a situação da planta. Texto livre, sem tradução. */
  situacao: string | null;
};

const TAMANHO_PAGINA = 100;

/**
 * Todas as plantas visíveis para a conta, paginando até o fim.
 *
 * Teto de páginas para não virar laço infinito se a API devolver sempre a
 * mesma página — comportamento já visto em gateway com paginação quebrada.
 */
export async function listarUsinas(): Promise<Resultado<UsinaIsolar[]>> {
  const usinas: UsinaIsolar[] = [];
  const vistos = new Set<string>();

  for (let pagina = 1; pagina <= 20; pagina++) {
    const resposta = await chamarAutenticado<Registro>(
      "/openapi/platform/queryPowerStationList",
      { page: pagina, size: TAMANHO_PAGINA }
    );

    if (!resposta.ok) return resposta;

    const lista = comoLista(resposta.dados?.pageList);
    if (!lista.length) break;

    let novas = 0;
    for (const item of lista) {
      const psId = texto(primeiroPresente(item, "ps_id", "psId"));
      if (!psId || vistos.has(psId)) continue;
      vistos.add(psId);
      novas++;
      usinas.push({
        psId,
        nome: texto(primeiroPresente(item, "ps_name", "psName")) ?? psId,
        potenciaKwp: numero(
          // "total_capcity" está escrito errado na API mesmo; é o nome real.
          primeiroPresente(item, "ps_capacity_kw", "total_capcity", "ps_capacity", "design_capacity")
        ),
        situacao: texto(primeiroPresente(item, "ps_status_text", "ps_status", "ps_fault_status")),
      });
    }

    if (novas === 0 || lista.length < TAMANHO_PAGINA) break;
  }

  return { ok: true, dados: usinas };
}

// --- Tempo real -----------------------------------------------------------

export type FontePotencia = "planta" | "soma_inversores";

export type TempoRealUsina = {
  psId: string;
  /** false = a planta não está reportando. Erro de rede NÃO cai aqui. */
  comunicando: boolean;
  potenciaInstantaneaKw: number | null;
  /**
   * De onde saiu a potência. Muda a interpretação do número — a soma por
   * inversor ignora perda no ponto de conexão —, então é gravada na leitura e
   * não fica implícita no código (ponto 12.4 do escopo).
   */
  fontePotencia: FontePotencia | null;
  energiaDiaKwh: number | null;
  energiaMesKwh: number | null;
  /** Resposta bruta da planta, para o payload de depuração da LeituraUsina. */
  bruto: Registro;
};

// Nomes de ponto confirmados na resposta do getPowerStationRealTimeData. A
// ordem importa: o primeiro presente vence.
const PONTOS_POTENCIA = ["p83022", "inverter_ac_power", "curr_power", "ps_power"];
const PONTOS_ENERGIA_DIA = ["p83025", "daily_yield", "today_energy", "day_energy"];
const PONTOS_ENERGIA_MES = ["p83024", "monthly_yield", "month_energy"];

export async function carregarTempoReal(psIds: string[]): Promise<Resultado<TempoRealUsina[]>> {
  if (!psIds.length) return { ok: true, dados: [] };

  const resposta = await chamarAutenticado<Registro>(
    "/openapi/platform/getPowerStationRealTimeData",
    { ps_id_list: psIds, is_get_point_dict: "1" }
  );

  if (!resposta.ok) return resposta;

  const lista = comoLista(
    primeiroPresente(resposta.dados ?? {}, "device_point_list", "pageList", "data_list")
  );

  const porPs = new Map<string, Registro>();
  for (const item of lista) {
    const dados = (item.device_point as Registro | undefined) ?? item;
    const psId = texto(primeiroPresente(dados, "ps_id", "psId")) ?? texto(item.ps_id);
    if (psId) porPs.set(psId, dados);
  }

  const leituras: TempoRealUsina[] = psIds.map((psId) => {
    const dados = porPs.get(psId);

    // Planta que não veio na resposta não está reportando. Isso É informação da
    // usina, e não falha de coleta: a chamada funcionou para as outras.
    if (!dados) {
      return {
        psId,
        comunicando: false,
        potenciaInstantaneaKw: null,
        fontePotencia: null,
        energiaDiaKwh: null,
        energiaMesKwh: null,
        bruto: {},
      };
    }

    const potencia = numero(primeiroPresente(dados, ...PONTOS_POTENCIA));

    return {
      psId,
      comunicando: true,
      potenciaInstantaneaKw: potencia,
      // Aqui a potência é sempre a consolidada da planta. A soma por inversor
      // vive em carregarPotenciaPorInversor(), usada só quando esta vem nula.
      fontePotencia: potencia === null ? null : "planta",
      energiaDiaKwh: numero(primeiroPresente(dados, ...PONTOS_ENERGIA_DIA)),
      energiaMesKwh: numero(primeiroPresente(dados, ...PONTOS_ENERGIA_MES)),
      bruto: dados,
    };
  });

  return { ok: true, dados: leituras };
}

// --- Inversores -----------------------------------------------------------

export type DispositivoIsolar = {
  deviceId: string | null;
  psKey: string | null;
  nome: string | null;
  tipo: string | null;
  /** Como a API reporta falha do dispositivo. Texto livre, sem tradução. */
  situacaoFalha: string | null;
};

/** device_type 1 = inversor no catálogo da Sungrow. */
const TIPO_INVERSOR = 1;

export async function listarInversores(psId: string): Promise<Resultado<DispositivoIsolar[]>> {
  const resposta = await chamarAutenticado<Registro>(
    "/openapi/platform/getDeviceListByPsId",
    { ps_id: psId, page: 1, size: TAMANHO_PAGINA, device_type_list: [TIPO_INVERSOR] }
  );

  if (!resposta.ok) return resposta;

  const dispositivos = comoLista(resposta.dados?.pageList).map((item) => ({
    deviceId: texto(primeiroPresente(item, "device_id", "deviceId")),
    psKey: texto(primeiroPresente(item, "ps_key", "psKey")),
    nome: texto(primeiroPresente(item, "device_name", "dev_name", "deviceName")),
    tipo: texto(primeiroPresente(item, "device_type", "deviceType")),
    situacaoFalha: texto(primeiroPresente(item, "dev_fault_status", "device_fault_status")),
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
 * Existe porque três coisas do escopo só o portal da Sungrow responde: o modo
 * de autenticação aprovado para a aplicação, o gateway da região da conta e o
 * limite de requisições. Em vez de adivinhar, a tela roda isto e mostra
 * exatamente o que a API respondeu — que é o que permite corrigir o .env sem
 * um ciclo de deploy a cada tentativa.
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
