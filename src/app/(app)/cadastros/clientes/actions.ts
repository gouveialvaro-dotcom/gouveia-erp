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
