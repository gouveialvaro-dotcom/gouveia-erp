import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { coletarJanela, janelaDoHorario } from "@/lib/monitoramento-coleta";
import { JANELAS, type JanelaColetaUsina } from "@/lib/monitoramento";

// Coleta agendada das usinas monitoradas.
//
// Esta rota NÃO passa pelo middleware: o matcher de src/proxy.ts exclui "api",
// e o cron não tem sessão de usuário para apresentar. Quem protege é o segredo
// próprio conferido abaixo — sem ele, qualquer um na internet dispararia coleta
// contra a conta do iSolarCloud à vontade, que é o caminho para estourar o
// limite de requisição da conta inteira.
//
// AGENDAMENTO (vercel.json, que é JSON e não aceita comentário). O Vercel Cron
// roda em UTC e Natal é UTC−3, então o horário local vira:
//
//   manhã      08:00 local → 11:00 UTC   (comunicação e falhas ativas)
//   meio-dia   12:00 local → 15:00 UTC   (única hora em que comparar potência
//                                         instantânea faz sentido)
//   fim tarde  18:00 local → 21:00 UTC   (fecha o dia: energia gerada)
//
// Cada janela tem uma segunda entrada 15 minutos depois: é a retentativa da
// seção 6.3 do escopo. Ela não duplica nada porque a gravação é upsert pela
// unique (usina, dataRef, janela) — a segunda passada atualiza a linha da
// primeira, ou grava o que a primeira não conseguiu.
//
// São 6 entradas de cron. O plano Hobby da Vercel permite 2 e só diário; isto
// exige o plano Pro. Sem ele, a alternativa é um agendador externo chamando
// esta mesma rota com o header x-cron-secret.

const SEGREDO = process.env.CRON_SECRET ?? "";

// Comparação em tempo constante, mesmo motivo do webhook do WhatsApp: comparar
// com === vaza, pelo tempo de resposta, quantos caracteres o atacante acertou.
function segredoConfere(recebido: string | null) {
  if (!SEGREDO || !recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(SEGREDO);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** O Vercel Cron manda "Bearer <CRON_SECRET>"; a chamada manual manda o header direto. */
function segredoDaRequisicao(request: Request) {
  const autorizacao = request.headers.get("authorization");
  if (autorizacao?.startsWith("Bearer ")) return autorizacao.slice(7);
  return request.headers.get("x-cron-secret");
}

function ehJanela(valor: string | null): valor is JanelaColetaUsina {
  return valor !== null && (JANELAS as string[]).includes(valor);
}

export async function GET(request: Request) {
  if (!segredoConfere(segredoDaRequisicao(request))) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const parametro = url.searchParams.get("janela");

  // A janela vem explícita do cron. Derivar do relógio é só o plano B: uma
  // execução atrasada pela fila da plataforma seria gravada na janela errada, e
  // a mediana de referência passaria a comparar meio-dia com fim de tarde.
  const janela = ehJanela(parametro) ? parametro : janelaDoHorario();

  const resultado = await coletarJanela(janela);

  // Revalida o painel para o carimbo de "última coleta" não ficar velho na tela.
  revalidatePath("/monitoramento");

  // 200 mesmo com falha de coleta, e o erro vai no corpo: um 5xx faria o Vercel
  // marcar o cron como quebrado e alertar a equipe toda vez que o iSolarCloud
  // desse instabilidade — o que é justamente o caso que a rotina já trata
  // sozinha, com a retentativa e o "sem dado" no painel.
  return NextResponse.json(resultado);
}
