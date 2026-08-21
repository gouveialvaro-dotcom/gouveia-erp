// Integração com a uazapi — a API não oficial que atende o número corporativo
// do pós-venda. SERVER ONLY: carrega o token da instância das variáveis de
// ambiente e nunca pode ser importado por Client Component.
//
// O risco de bloqueio do número foi avaliado e aceito pelo sócio-diretor. A
// consequência de projeto é a regra que rege este arquivo inteiro: quem grava
// no banco é sempre o chamador, ANTES ou INDEPENDENTEMENTE do resultado daqui.
// Se o número cair, a empresa perde o canal, mas não o registro do que foi
// combinado com o cliente.
//
// Nada neste arquivo dispara mensagem sozinho. Não há envio ativo, campanha
// nem disparo em massa — é o caminho mais rápido para o número ser bloqueado.

import { apenasDigitos } from "@/lib/pos-venda-whatsapp";

// Cada conta da uazapi fica num servidor próprio (ex.: https://xxx.uazapi.com)
// e cada instância tem o seu token, enviado no header "token".
const URL_BASE = process.env.UAZAPI_URL ?? "";
const TOKEN = process.env.UAZAPI_TOKEN ?? "";

const TEMPO_LIMITE_MS = 15_000;

export function gatewayConfigurado() {
  return URL_BASE !== "" && TOKEN !== "";
}

type RespostaGateway = { ok: true; dados: unknown } | { ok: false; erro: string };

async function chamar(caminho: string, corpo: Record<string, unknown>): Promise<RespostaGateway> {
  if (!gatewayConfigurado()) {
    return { ok: false, erro: "Integração do WhatsApp não configurada (UAZAPI_URL/UAZAPI_TOKEN)." };
  }

  // Timeout explícito: sem ele, um gateway fora do ar deixaria a Server Action
  // pendurada até o limite da plataforma e a tela travada junto.
  const cancelar = AbortSignal.timeout(TEMPO_LIMITE_MS);

  try {
    const resposta = await fetch(`${URL_BASE.replace(/\/$/, "")}${caminho}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: TOKEN },
      body: JSON.stringify(corpo),
      signal: cancelar,
      cache: "no-store",
    });

    const texto = await resposta.text();
    let dados: unknown = texto;
    try {
      dados = JSON.parse(texto);
    } catch {
      // Gateway respondeu texto puro (costuma acontecer em erro de proxy).
    }

    if (!resposta.ok) {
      const mensagem =
        typeof dados === "object" && dados !== null && "message" in dados
          ? String((dados as { message: unknown }).message)
          : `HTTP ${resposta.status}`;
      return { ok: false, erro: mensagem };
    }

    return { ok: true, dados };
  } catch (erro) {
    return {
      ok: false,
      erro: erro instanceof Error ? erro.message : "Falha de rede ao falar com o gateway.",
    };
  }
}

/** Id que o provedor deu à mensagem — é a chave de deduplicação do webhook. */
function idExterno(dados: unknown): string | null {
  if (typeof dados !== "object" || dados === null) return null;
  const raiz = dados as Record<string, unknown>;
  const mensagem = (raiz.message ?? raiz.data ?? raiz) as Record<string, unknown>;
  for (const campo of ["id", "messageid", "messageId", "key"]) {
    const valor = mensagem?.[campo];
    if (typeof valor === "string" && valor.length > 0) return valor;
  }
  return null;
}

export type EnvioTexto = { ok: true; idExterno: string | null } | { ok: false; erro: string };

/** POST /send/text — o único envio que a Fase 1 faz. */
export async function enviarTexto(numero: string, texto: string): Promise<EnvioTexto> {
  const resposta = await chamar("/send/text", {
    number: apenasDigitos(numero),
    text: texto,
  });

  if (!resposta.ok) return { ok: false, erro: resposta.erro };
  return { ok: true, idExterno: idExterno(resposta.dados) };
}

/**
 * POST /message/download — a uazapi nem sempre entrega a mídia no corpo do
 * webhook; às vezes manda só o id e a mídia é buscada depois. Devolve a URL
 * temporária do arquivo.
 */
export async function urlDaMidia(idMensagem: string): Promise<string | null> {
  const resposta = await chamar("/message/download", { id: idMensagem });
  if (!resposta.ok || typeof resposta.dados !== "object" || resposta.dados === null) {
    return null;
  }

  const dados = resposta.dados as Record<string, unknown>;
  for (const campo of ["fileURL", "fileUrl", "url", "file"]) {
    const valor = dados[campo];
    if (typeof valor === "string" && valor.startsWith("http")) return valor;
  }
  return null;
}

/** Baixa o arquivo apontado pelo webhook para subir ao Storage. */
export async function baixarArquivo(url: string) {
  try {
    const resposta = await fetch(url, {
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      cache: "no-store",
    });
    if (!resposta.ok) return null;

    return {
      bytes: await resposta.arrayBuffer(),
      mime: resposta.headers.get("content-type"),
    };
  } catch {
    return null;
  }
}
