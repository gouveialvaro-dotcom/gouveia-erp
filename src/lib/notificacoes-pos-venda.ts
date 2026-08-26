// Distribuição das notificações do pós-venda. Só roda no servidor: usa o
// client de service role (ver src/lib/supabase.ts).

import { supabase } from "@/lib/supabase";
import {
  DIAS_SEM_MOVIMENTO_PADRAO,
  hojeIso,
  semMovimento,
  ultimaMovimentacao,
} from "@/lib/pos-venda";
import { MINUTOS_UTEIS_SEM_DONO, minutosUteisEntre } from "@/lib/pos-venda-whatsapp";
import { podeEscrever, podeLer, type Perfil } from "@/lib/permissoes";
import { formatarData } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type TipoNotificacao = Database["public"]["Enums"]["TipoNotificacaoPosVenda"];

const CHAVE_DEDUPE = "usuarioId,chamadoId,conversaId,tipo,referencia";

// O destinatário do aviso é DERIVADO do chamado — o responsável, mais os admins
// ativos onde a regra manda. Não existe mais lista de inscritos:
// Usuario.notificaPosVenda está aposentado (ver
// scripts/sql/010-chamado-responsavel.sql). Marcar gente à mão fazia o aviso
// chegar a quem não tinha o que fazer com ele e, no caso pior, não chegar a
// ninguém — porque ninguém estava marcado.
async function adminsAtivos() {
  const { data } = await supabase
    .from("Usuario")
    .select("id")
    .eq("ativo", true)
    .eq("perfil", "admin");

  return (data ?? []).map((u) => u.id);
}

async function responsavelDoChamado(chamadoId: string) {
  const { data } = await supabase
    .from("Chamado")
    .select("responsavelId")
    .eq("id", chamadoId)
    .maybeSingle();

  return data?.responsavelId ?? null;
}

/** Alcance do aviso. "somente_dono" existe para o direcionamento da abertura,
 *  que é uma atribuição pessoal e não uma notícia para a diretoria. */
export type AlcanceAviso = "somente_dono" | "dono_e_admins";

// O admin que também é o dono do chamado tem de receber UM aviso, não dois. A
// deduplicação acontece aqui, antes do upsert: a chave de conflito resolve
// linhas repetidas entre chamadas diferentes, mas duas linhas idênticas dentro
// da MESMA sentença de insert colidem entre si, e o Postgres recusa o lote
// inteiro ("ON CONFLICT DO UPDATE command cannot affect row a second time").
async function destinatariosDoChamado({
  chamadoId,
  alcance,
  extras = [],
  exceto,
}: {
  chamadoId: string;
  alcance: AlcanceAviso;
  extras?: (string | null | undefined)[];
  exceto?: string | null;
}) {
  const dono = await responsavelDoChamado(chamadoId);
  const admins = alcance === "dono_e_admins" ? await adminsAtivos() : [];

  const ids = new Set<string>();
  for (const id of [dono, ...admins, ...extras]) {
    if (id && id !== exceto) ids.add(id);
  }
  return [...ids];
}

export async function notificarPosVenda({
  chamadoId,
  tipo,
  titulo,
  detalhe,
  referencia,
  autorId,
  alcance = "dono_e_admins",
  extras,
}: {
  chamadoId: string;
  tipo: TipoNotificacao;
  titulo: string;
  detalhe?: string | null;
  // Torna o aviso único por evento. Repetir a mesma referência é o que impede
  // o mesmo fato de virar duas notificações.
  referencia: string;
  autorId?: string | null;
  alcance?: AlcanceAviso;
  /** Destinatário fora da regra — o dono ANTERIOR, na troca de responsável, que
   *  já não é o dono do chamado e não seria alcançado de outro jeito. */
  extras?: (string | null | undefined)[];
}) {
  // Quem fez a alteração não é avisado da própria alteração — inclusive quando
  // é admin e entraria na lista por esse outro caminho.
  const ids = await destinatariosDoChamado({
    chamadoId,
    alcance,
    extras,
    exceto: autorId,
  });
  if (ids.length === 0) return;

  await supabase.from("NotificacaoPosVenda").upsert(
    ids.map((usuarioId) => ({
      usuarioId,
      chamadoId,
      tipo,
      titulo,
      detalhe: detalhe ?? null,
      referencia,
      geradaPorId: autorId ?? null,
    })),
    { onConflict: CHAVE_DEDUPE, ignoreDuplicates: true }
  );
}

/**
 * Nem o vencimento nem a parada têm evento de escrita para disparar o aviso — o
 * chamado simplesmente atravessa a data, ou deixa de receber registro. Cada
 * destinatário gera os seus ao abrir o app.
 *
 * As duas varreduras vivem na MESMA função de propósito: percorrem exatamente o
 * mesmo conjunto (chamados não concluídos que interessam a este usuário) e o
 * sino bate a cada minuto — separadas, seriam duas idas ao banco por batida,
 * pelas mesmas linhas.
 *
 * A chave de deduplicação é o que faz cada aviso ser único por evento:
 * - vencido carrega o prazoLimite que estourou, então prorrogar o prazo e
 *   vencer de novo produz um aviso NOVO;
 * - parado carrega a data da última movimentação, então registrar uma interação
 *   e parar outra vez também produz um aviso novo.
 */
export async function sincronizarChamados(usuarioId: string) {
  const { data: usuario } = await supabase
    .from("Usuario")
    .select("ativo, perfil")
    .eq("id", usuarioId)
    .maybeSingle();

  if (!usuario?.ativo) return;
  if (!podeLer(usuario.perfil as Perfil, "posVenda")) return;

  const ehAdmin = usuario.perfil === "admin";

  const { data: parametros } = await supabase
    .from("ParametroGeral")
    .select("diasSemMovimentoChamado")
    .limit(1)
    .maybeSingle();

  const diasLimite = parametros?.diasSemMovimentoChamado ?? DIAS_SEM_MOVIMENTO_PADRAO;

  // Dono sempre; admin recebe de todos. Ninguém mais entra — quem não é dono
  // nem admin não tem por que ser cobrado por um chamado parado.
  let query = supabase
    .from("Chamado")
    .select(
      "id, numero, titulo, estagio, abertoEm, prazoLimite, cliente:Cliente(razaoSocial), interacoes:InteracaoChamado(data)"
    )
    .neq("estagio", "concluido");

  if (!ehAdmin) query = query.eq("responsavelId", usuarioId);

  const { data: chamados } = await query;
  if (!chamados?.length) return;

  const hoje = hojeIso();
  const linhas: {
    usuarioId: string;
    chamadoId: string;
    tipo: TipoNotificacao;
    titulo: string;
    detalhe: string;
    referencia: string;
  }[] = [];

  for (const c of chamados) {
    const cliente = c.cliente?.razaoSocial ?? "—";

    if (c.prazoLimite < hoje) {
      linhas.push({
        usuarioId,
        chamadoId: c.id,
        tipo: "chamado_vencido",
        titulo: `Chamado #${c.numero} venceu o prazo`,
        detalhe: `${cliente} · ${c.titulo}`,
        referencia: c.prazoLimite,
      });
    }

    // A última interação sai em memória, e não com um order/limit por chamado:
    // seriam N consultas para uma lista que já veio inteira no mesmo select.
    const datas = (c.interacoes ?? []).map((i) => i.data.slice(0, 10)).sort();
    const movimento = {
      estagio: c.estagio,
      abertoEm: c.abertoEm,
      ultimaInteracaoEm: datas.at(-1) ?? null,
    };

    if (semMovimento(movimento, diasLimite, hoje)) {
      const parado = ultimaMovimentacao(movimento);
      linhas.push({
        usuarioId,
        chamadoId: c.id,
        tipo: "chamado_sem_movimento",
        titulo: `Chamado #${c.numero} está parado`,
        detalhe: `${cliente} · sem registro novo desde ${formatarData(parado)}`,
        referencia: parado,
      });
    }
  }

  if (!linhas.length) return;

  await supabase
    .from("NotificacaoPosVenda")
    .upsert(linhas, { onConflict: CHAVE_DEDUPE, ignoreDuplicates: true });
}

/** Ids dos chamados com aviso não lido — marca o card no Kanban. */
export async function chamadosComNovidade(usuarioId: string) {
  const { data } = await supabase
    .from("NotificacaoPosVenda")
    .select("chamadoId")
    .eq("usuarioId", usuarioId)
    .is("lidaEm", null);

  return new Set((data ?? []).map((n) => n.chamadoId));
}

/**
 * Avisa sobre conversa de WhatsApp pendente e sem dono há mais de duas horas
 * úteis.
 *
 * Duas diferenças deliberadas em relação ao resto do módulo:
 *
 * 1. O destinatário NÃO é o flag notificaPosVenda, e sim todo mundo com escrita
 *    em posVenda. Fila parada é problema do time, não de um responsável
 *    nomeado — se dependesse de alguém marcado para receber, o caso de ninguém
 *    ter assumido seria justamente o caso em que ninguém é avisado. O admin
 *    desliga por usuário em notificaWhatsappSemDono, para o canal não virar um
 *    aviso que ninguém consegue silenciar.
 *
 * 2. O aviso não tem chamado. Por isso NotificacaoPosVenda.chamadoId virou
 *    nulável e ganhou conversaId (migração 008).
 *
 * Como no vencimento de chamado, não existe evento de escrita quando o tempo
 * estoura — a conversa só atravessa o limite. A verificação roda quando cada
 * destinatário abre o app. A referência carrega o instante da última mensagem,
 * então uma mensagem nova do cliente produz um aviso novo, e a mesma espera não
 * repete aviso.
 */
export async function sincronizarConversasSemDono(usuarioId: string) {
  const { data: usuario } = await supabase
    .from("Usuario")
    .select("ativo, perfil, notificaWhatsappSemDono")
    .eq("id", usuarioId)
    .maybeSingle();

  if (!usuario?.ativo || !usuario.notificaWhatsappSemDono) return;
  if (!podeEscrever(usuario.perfil as Perfil, "posVenda")) return;

  const { data: parametros } = await supabase
    .from("ParametroGeral")
    .select("horaInicioComercial, horaFimComercial, diasSemanaComercial")
    .limit(1)
    .maybeSingle();

  if (!parametros) return;

  const { data: paradas } = await supabase
    .from("ConversaWhatsapp")
    .select("id, telefoneExibicao, ultimaMensagemEm, cliente:Cliente(razaoSocial)")
    .eq("pendente", true)
    .is("donoId", null)
    .is("arquivadaEm", null)
    .not("ultimaMensagemEm", "is", null);

  if (!paradas?.length) return;

  const agora = new Date();
  const estouradas = paradas.filter(
    (c) =>
      minutosUteisEntre(new Date(c.ultimaMensagemEm!), agora, parametros) >=
      MINUTOS_UTEIS_SEM_DONO
  );

  if (!estouradas.length) return;

  await supabase.from("NotificacaoPosVenda").upsert(
    estouradas.map((c) => ({
      usuarioId,
      chamadoId: null,
      conversaId: c.id,
      tipo: "conversa_sem_dono" as const,
      titulo: "Conversa sem dono há mais de 2h",
      detalhe: `${c.cliente?.razaoSocial ?? c.telefoneExibicao} aguarda resposta`,
      referencia: c.ultimaMensagemEm!,
    })),
    { onConflict: CHAVE_DEDUPE, ignoreDuplicates: true }
  );
}

/** Aviso dirigido a um usuário sobre uma conversa — sem chamado envolvido. */
export async function notificarConversa({
  usuarioId,
  conversaId,
  tipo,
  titulo,
  detalhe,
  referencia,
  autorId,
}: {
  usuarioId: string;
  conversaId: string;
  tipo: TipoNotificacao;
  titulo: string;
  detalhe?: string | null;
  referencia: string;
  autorId?: string | null;
}) {
  // Quem faz a alteração não é avisado da própria alteração — mesma regra do
  // resto do módulo. O admin que atribui a si mesmo não recebe aviso.
  if (autorId && autorId === usuarioId) return;

  await supabase.from("NotificacaoPosVenda").upsert(
    [
      {
        usuarioId,
        chamadoId: null,
        conversaId,
        tipo,
        titulo,
        detalhe: detalhe ?? null,
        referencia,
        geradaPorId: autorId ?? null,
      },
    ],
    { onConflict: CHAVE_DEDUPE, ignoreDuplicates: true }
  );
}
