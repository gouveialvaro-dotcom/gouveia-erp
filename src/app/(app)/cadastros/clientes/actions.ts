"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { exigirAlgumaPermissao, exigirPermissao } from "@/lib/api-auth";
import { SLUG_POR_RAMO } from "@/lib/clientes";

// O ramo decide o formato do cadastro: energia solar tem contrato de
// manutenção e unidades geradoras/beneficiárias; redes/subestações é um
// cadastro simples com endereço.
const clienteSchema = z
  .object({
    ramo: z.enum(["energia_solar", "redes_subestacoes"]),
    razaoSocial: z.string().min(1, "Informe a razão social."),
    cnpj: z.string().min(1, "Informe o CNPJ/CPF."),
    contato: z.string().optional(),
    telefone: z.string().optional(),
    email: z.email("Informe um e-mail válido.").optional(),
    observacoes: z.string().optional(),
    endereco: z.string().optional(),
    manutencaoInicio: z.string().optional(),
    manutencaoFim: z.string().optional(),
  })
  .refine((d) => !d.manutencaoInicio === !d.manutencaoFim, {
    message: "Informe as duas datas do plano de manutenção (início e fim).",
  })
  .refine(
    (d) => !d.manutencaoInicio || !d.manutencaoFim || d.manutencaoFim >= d.manutencaoInicio,
    { message: "O fim da manutenção não pode ser anterior ao início." }
  );

export type EstadoFormCliente = { erro?: string } | undefined;

export async function salvarCliente(
  clienteId: string | null,
  _estado: EstadoFormCliente,
  formData: FormData
): Promise<EstadoFormCliente> {
  const { usuarioId } = await exigirPermissao("clientes", "escrita");

  const dados = clienteSchema.safeParse({
    ramo: formData.get("ramo"),
    razaoSocial: formData.get("razaoSocial"),
    cnpj: formData.get("cnpj"),
    contato: formData.get("contato") || undefined,
    telefone: formData.get("telefone") || undefined,
    email: formData.get("email") || undefined,
    observacoes: formData.get("observacoes") || undefined,
    endereco: formData.get("endereco") || undefined,
    manutencaoInicio: formData.get("manutencaoInicio") || undefined,
    manutencaoFim: formData.get("manutencaoFim") || undefined,
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { ramo, endereco, manutencaoInicio, manutencaoFim, ...comum } = dados.data;

  // Cada ramo grava só os campos do seu formulário — o endereço do cliente
  // solar são os das UGs/UBs, e o cliente de redes não tem manutenção.
  const registro =
    ramo === "energia_solar"
      ? {
          ...comum,
          ramo,
          contato: comum.contato ?? null,
          telefone: comum.telefone ?? null,
          email: comum.email ?? null,
          observacoes: comum.observacoes ?? null,
          manutencaoInicio: manutencaoInicio ?? null,
          manutencaoFim: manutencaoFim ?? null,
        }
      : {
          ...comum,
          ramo,
          contato: comum.contato ?? null,
          telefone: comum.telefone ?? null,
          email: comum.email ?? null,
          observacoes: comum.observacoes ?? null,
          endereco: endereco ?? null,
        };

  // Reclassificar para redes/subestações esconderia as UGs/UBs e tiraria o
  // cliente do pós-venda — com unidade ou chamado no histórico, isso é perda
  // silenciosa de informação.
  if (clienteId && ramo === "redes_subestacoes") {
    const [{ count: unidades }, { count: chamados }] = await Promise.all([
      supabase
        .from("UnidadeConsumidora")
        .select("id", { count: "exact", head: true })
        .eq("clienteId", clienteId),
      supabase
        .from("Chamado")
        .select("id", { count: "exact", head: true })
        .eq("clienteId", clienteId),
    ]);

    if ((unidades ?? 0) > 0 || (chamados ?? 0) > 0) {
      return {
        erro:
          "Cliente tem unidades ou chamados de energia solar. Exclua-os antes de mudar o ramo " +
          "para redes/subestações.",
      };
    }
  }

  let id = clienteId;
  if (clienteId) {
    const { error } = await supabase.from("Cliente").update(registro).eq("id", clienteId);
    if (error) return { erro: "Já existe um cliente cadastrado com esse CNPJ/CPF." };
  } else {
    const { data: criado, error } = await supabase
      .from("Cliente")
      .insert({ ...registro, criadoPorId: usuarioId })
      .select("id")
      .single();
    if (error || !criado) return { erro: "Já existe um cliente cadastrado com esse CNPJ/CPF." };
    id = criado.id;
  }

  revalidatePath(`/cadastros/clientes/${SLUG_POR_RAMO[ramo]}`);
  revalidatePath("/pos-venda");
  redirect(`/cadastros/clientes/${id}`);
}

// --- Exclusão -------------------------------------------------------------

// Mesmo bucket usado pelos anexos de chamado (ver pos-venda/actions.ts): a
// exclusão em cascata também precisa limpar os arquivos de lá.
const BUCKET_ANEXOS_POS_VENDA = "pos-venda";

/** `podeForcar` liga o botão de cascata no diálogo (ver components/ui/botao-excluir). */
export type EstadoExclusaoCliente = { erro?: string; podeForcar?: boolean } | undefined;

export async function excluirCliente(
  _estado: EstadoExclusaoCliente,
  formData: FormData
): Promise<EstadoExclusaoCliente> {
  const { perfil } = await exigirPermissao("clientes", "escrita");

  const clienteId = String(formData.get("clienteId") ?? "");
  // O botão "Excluir tudo mesmo assim" manda cascata=1. Arrastar chamado,
  // orçamento e obra junto é decisão de administrador — comercial só exclui
  // cliente que ainda não tem histórico.
  const cascata = formData.get("cascata") === "1" && perfil === "admin";

  const { data: cliente } = await supabase
    .from("Cliente")
    .select("ramo")
    .eq("id", clienteId)
    .maybeSingle();

  if (!cliente) return { erro: "Cliente não encontrado." };

  // Chamado, orçamento e oportunidade apontam para o cliente e o banco recusa
  // a exclusão (RESTRICT). Contar antes troca um erro cru de chave estrangeira
  // por um aviso que diz o que está no caminho. Unidades e contatos não entram
  // na conta: esses o banco apaga junto (CASCADE).
  const [{ count: chamados }, { count: orcamentos }, { count: oportunidades }] =
    await Promise.all([
      supabase
        .from("Chamado")
        .select("id", { count: "exact", head: true })
        .eq("clienteId", clienteId),
      supabase
        .from("Orcamento")
        .select("id", { count: "exact", head: true })
        .eq("clienteId", clienteId),
      supabase
        .from("Oportunidade")
        .select("id", { count: "exact", head: true })
        .eq("clienteId", clienteId),
    ]);

  const vinculos = [
    { rotulo: "chamado(s) no pós-venda", total: chamados ?? 0 },
    { rotulo: "orçamento(s)", total: orcamentos ?? 0 },
    { rotulo: "oportunidade(s) no CRM", total: oportunidades ?? 0 },
  ].filter((v) => v.total > 0);

  if (vinculos.length > 0 && !cascata) {
    const lista = vinculos.map((v) => `${v.total} ${v.rotulo}`).join(", ");
    return {
      erro:
        perfil === "admin"
          ? `Cliente não pode ser excluído: tem ${lista}. Exclua esses registros antes — ou use "Excluir tudo mesmo assim" para apagar cliente e histórico de uma vez.`
          : `Cliente não pode ser excluído: tem ${lista}. Exclua esses registros antes.`,
      // Só administrador enxerga a saída em cascata.
      podeForcar: perfil === "admin",
    };
  }

  if (cascata) {
    // Os arquivos dos anexos precisam ser lidos antes: depois da exclusão não
    // existe mais linha apontando para eles, e ficariam perdidos no bucket.
    const { data: chamadosDoCliente } = await supabase
      .from("Chamado")
      .select("id")
      .eq("clienteId", clienteId);

    const idsChamados = (chamadosDoCliente ?? []).map((c) => c.id);
    let caminhos: string[] = [];

    if (idsChamados.length > 0) {
      const { data: anexos } = await supabase
        .from("AnexoChamado")
        .select("caminho")
        .in("chamadoId", idsChamados);
      caminhos = (anexos ?? []).map((a) => a.caminho);
    }

    // Tudo-ou-nada: a função roda os deletes na ordem certa, numa transação só.
    const { error } = await supabase.rpc("excluir_cliente_cascata", {
      p_cliente_id: clienteId,
    });

    if (error) {
      console.error("Falha na exclusão em cascata:", error);
      return { erro: `Não foi possível excluir: ${error.message}` };
    }

    if (caminhos.length > 0) {
      await supabase.storage.from(BUCKET_ANEXOS_POS_VENDA).remove(caminhos);
    }

    revalidatePath(`/cadastros/clientes/${SLUG_POR_RAMO[cliente.ramo]}`);
    revalidatePath("/pos-venda");
    revalidatePath("/crm");
    revalidatePath("/orcamentos");
    revalidatePath("/obras");
    redirect(`/cadastros/clientes/${SLUG_POR_RAMO[cliente.ramo]}`);
  }

  const { error } = await supabase.from("Cliente").delete().eq("id", clienteId);
  if (error) return { erro: "Não foi possível excluir o cliente." };

  revalidatePath(`/cadastros/clientes/${SLUG_POR_RAMO[cliente.ramo]}`);
  revalidatePath("/pos-venda");
  redirect(`/cadastros/clientes/${SLUG_POR_RAMO[cliente.ramo]}`);
}

// --- Unidades geradoras e beneficiárias -----------------------------------
// Ficam dentro do cadastro do cliente de energia solar, e são também a âncora
// do pós-venda: é na UC que a concessionária fatura, mede e compensa.

const unidadeSchema = z.object({
  numero: z.string().min(1, "Informe o número da unidade."),
  endereco: z.string().min(1, "Informe o endereço da unidade."),
  tipo: z.enum(["geradora", "beneficiaria"]),
  concessionariaId: z.string().optional(),
});

export type EstadoFormUnidade = { erro?: string } | undefined;

export async function adicionarUnidade(
  clienteId: string,
  tipo: "geradora" | "beneficiaria",
  _estado: EstadoFormUnidade,
  formData: FormData
): Promise<EstadoFormUnidade> {
  // A UC é insumo do chamado, mas mora no cadastro do cliente: quem mantém é o
  // comercial (dono do cadastro) ou o atendimento (dono do pós-venda).
  await exigirAlgumaPermissao(["clientes", "posVenda"], "escrita");

  const dados = unidadeSchema.safeParse({
    numero: formData.get("numero"),
    endereco: formData.get("endereco"),
    tipo,
    concessionariaId: formData.get("concessionariaId") || undefined,
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { error } = await supabase.from("UnidadeConsumidora").insert({
    clienteId,
    numero: dados.data.numero,
    endereco: dados.data.endereco,
    tipo: dados.data.tipo,
    concessionariaId: dados.data.concessionariaId ?? null,
  });

  if (error) {
    return { erro: "Já existe uma unidade com esse número neste cliente." };
  }

  revalidatePath(`/cadastros/clientes/${clienteId}`);
  revalidatePath("/pos-venda");
}

export async function removerUnidade(clienteId: string, unidadeId: string) {
  await exigirAlgumaPermissao(["clientes", "posVenda"], "escrita");

  // Chamado aponta para a UC (FK com ON DELETE SET NULL): excluir uma unidade
  // já usada deixaria o histórico do atendimento sem referência. A tela também
  // esconde o botão nesse caso; aqui é a trava de fato.
  const { count } = await supabase
    .from("Chamado")
    .select("id", { count: "exact", head: true })
    .eq("unidadeConsumidoraId", unidadeId);

  if (count && count > 0) return;

  await supabase.from("UnidadeConsumidora").delete().eq("id", unidadeId);
  revalidatePath(`/cadastros/clientes/${clienteId}`);
  revalidatePath("/pos-venda");
}
