// Casamento entre telefone e cadastro de cliente. Só roda no servidor: usa o
// client de service role (ver src/lib/supabase.ts).
//
// O telefone mora em UM lugar só — a ficha do cliente (Cliente/ContatoCliente),
// que já é onde os contatos vivem. O módulo de WhatsApp não mantém uma segunda
// lista de números de propósito: duas listas divergem no primeiro conserto feito
// de um lado só, e aí o casamento volta a errar sem ninguém entender por quê.

import { supabase } from "@/lib/supabase";
import { chaveTelefone, mesmoTelefone } from "@/lib/pos-venda-whatsapp";

export type DonoDoTelefone = {
  clienteId: string;
  clienteNome: string;
  contatoClienteId: string | null;
  contatoNome: string | null;
};

/**
 * Quem é o dono cadastrado de um telefone — ou null se ninguém.
 *
 * A comparação é em memória, e não no SQL, porque o telefone do cadastro é
 * texto livre com máscara: não dá para comparar no banco sem normalizar os dois
 * lados antes (ver chaveTelefone). A base de telefones do ERP é pequena; se um
 * dia deixar de ser, o caminho é uma coluna normalizada com índice.
 */
export async function donoDoTelefone(telefone: string): Promise<DonoDoTelefone | null> {
  const chave = chaveTelefone(telefone);
  if (!chave) return null;

  const [{ data: clientes }, { data: contatos }] = await Promise.all([
    supabase.from("Cliente").select("id, razaoSocial, telefone").not("telefone", "is", null),
    supabase
      .from("ContatoCliente")
      .select("id, clienteId, nome, telefone, cliente:Cliente(razaoSocial)")
      .not("telefone", "is", null),
  ]);

  // O contato específico vence o telefone geral do cliente: ele identifica a
  // pessoa, e é essa informação que o atendente quer ver na conversa.
  const contato = (contatos ?? []).find((c) => mesmoTelefone(chave, c.telefone));
  if (contato) {
    return {
      clienteId: contato.clienteId,
      clienteNome: contato.cliente?.razaoSocial ?? "—",
      contatoClienteId: contato.id,
      contatoNome: contato.nome,
    };
  }

  const cliente = (clientes ?? []).find((c) => mesmoTelefone(chave, c.telefone));
  if (cliente) {
    return {
      clienteId: cliente.id,
      clienteNome: cliente.razaoSocial,
      contatoClienteId: null,
      contatoNome: null,
    };
  }

  return null;
}

/**
 * Grava o telefone na ficha do cliente, se ainda não estiver lá.
 *
 * Devolve o contatoClienteId quando o número passa a viver num contato. Não
 * sobrescreve o telefone principal já preenchido: ele costuma ser o telefone da
 * empresa, e trocá-lo pelo celular de quem mandou mensagem apagaria um dado que
 * ninguém pediu para apagar — o número novo vira contato.
 */
export async function gravarTelefoneNaFicha(
  clienteId: string,
  telefoneExibicao: string,
  nomeContato: string
): Promise<string | null> {
  const jaCadastrado = await donoDoTelefone(telefoneExibicao);
  if (jaCadastrado?.clienteId === clienteId) {
    return jaCadastrado.contatoClienteId;
  }

  const { data: cliente } = await supabase
    .from("Cliente")
    .select("id, telefone")
    .eq("id", clienteId)
    .maybeSingle();

  if (!cliente) return null;

  if (!cliente.telefone) {
    await supabase
      .from("Cliente")
      .update({ telefone: telefoneExibicao, atualizadoEm: new Date().toISOString() })
      .eq("id", clienteId);
    return null;
  }

  const { data: contato } = await supabase
    .from("ContatoCliente")
    .insert({ clienteId, nome: nomeContato, telefone: telefoneExibicao })
    .select("id")
    .single();

  return contato?.id ?? null;
}

/**
 * Liga a conversas órfãs os telefones que passaram a existir no cadastro.
 *
 * Sem isso, cadastrar o número na ficha do cliente só valeria para conversas
 * futuras: a que já está aberta em "Sem cliente" continuaria órfã para sempre,
 * porque o casamento automático só acontece quando a conversa nasce.
 *
 * Roda quando alguém abre a página, mesmo desenho de sincronizarVencidos: não
 * existe evento de escrita no módulo de WhatsApp quando um telefone é cadastrado
 * do lado do cadastro de clientes. Só preenche o que está nulo — vínculo feito à
 * mão nunca é tocado.
 */
export async function reconciliarConversasSemCliente() {
  const { data: orfas } = await supabase
    .from("ConversaWhatsapp")
    .select("id, telefone, telefoneExibicao")
    .is("clienteId", null);

  if (!orfas?.length) return 0;

  let ligadas = 0;
  for (const conversa of orfas) {
    const dono = await donoDoTelefone(conversa.telefoneExibicao || conversa.telefone);
    if (!dono) continue;

    await supabase
      .from("ConversaWhatsapp")
      .update({
        clienteId: dono.clienteId,
        contatoClienteId: dono.contatoClienteId,
        atualizadoEm: new Date().toISOString(),
      })
      .eq("id", conversa.id)
      .is("clienteId", null);

    ligadas++;
  }

  return ligadas;
}
