"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { exigirPermissao } from "@/lib/api-auth";

const clienteSchema = z.object({
  razaoSocial: z.string().min(1, "Informe a razão social."),
  cnpj: z.string().min(1, "Informe o CNPJ."),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().max(2).optional(),
  observacoes: z.string().optional(),
});

export type EstadoFormCliente = { erro?: string } | undefined;

export async function salvarCliente(
  clienteId: string | null,
  _estado: EstadoFormCliente,
  formData: FormData
): Promise<EstadoFormCliente> {
  const { usuarioId } = await exigirPermissao("clientes", "escrita");

  const dados = clienteSchema.safeParse({
    razaoSocial: formData.get("razaoSocial"),
    cnpj: formData.get("cnpj"),
    endereco: formData.get("endereco") || undefined,
    cidade: formData.get("cidade") || undefined,
    uf: formData.get("uf") || undefined,
    observacoes: formData.get("observacoes") || undefined,
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  let id = clienteId;
  if (clienteId) {
    const { error } = await supabase.from("Cliente").update(dados.data).eq("id", clienteId);
    if (error) return { erro: "Já existe um cliente cadastrado com esse CNPJ." };
  } else {
    const { data: criado, error } = await supabase
      .from("Cliente")
      .insert({ ...dados.data, criadoPorId: usuarioId })
      .select("id")
      .single();
    if (error || !criado) return { erro: "Já existe um cliente cadastrado com esse CNPJ." };
    id = criado.id;
  }

  revalidatePath("/cadastros/clientes");
  redirect(`/cadastros/clientes/${id}`);
}

const contatoSchema = z.object({
  nome: z.string().min(1, "Informe o nome do contato."),
  cargo: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().optional(),
});

export async function adicionarContato(clienteId: string, formData: FormData) {
  await exigirPermissao("clientes", "escrita");

  const dados = contatoSchema.parse({
    nome: formData.get("nome"),
    cargo: formData.get("cargo") || undefined,
    telefone: formData.get("telefone") || undefined,
    email: formData.get("email") || undefined,
  });

  await supabase.from("ContatoCliente").insert({ ...dados, clienteId });
  revalidatePath(`/cadastros/clientes/${clienteId}`);
}

export async function removerContato(clienteId: string, contatoId: string) {
  await exigirPermissao("clientes", "escrita");
  await supabase.from("ContatoCliente").delete().eq("id", contatoId);
  revalidatePath(`/cadastros/clientes/${clienteId}`);
}

// --- Unidades consumidoras ------------------------------------------------
// A UC é a âncora do pós-venda: é nela que a concessionária fatura, mede e
// compensa, então quase todo chamado aponta para uma.

const unidadeSchema = z
  .object({
    numero: z.string().min(1, "Informe o número da UC."),
    apelido: z.string().optional(),
    concessionariaId: z.string().min(1, "Selecione a concessionária."),
    tipo: z.enum(["geradora", "beneficiaria"]),
    geradoraId: z.string().optional(),
    percentualRateio: z.coerce.number().gt(0).max(100).optional(),
    obraId: z.string().optional(),
    titular: z.string().optional(),
    potenciaKwp: z.coerce.number().nonnegative().optional(),
    cidade: z.string().optional(),
    uf: z.string().max(2).optional(),
  })
  .refine((d) => d.tipo === "geradora" || !!d.geradoraId, {
    message: "Beneficiária precisa apontar para a UC geradora que a compensa.",
  })
  .refine((d) => d.tipo === "geradora" || d.percentualRateio !== undefined, {
    message: "Informe o percentual de rateio da beneficiária.",
  });

export type EstadoFormUnidade = { erro?: string } | undefined;

export async function adicionarUnidadeConsumidora(
  clienteId: string,
  _estado: EstadoFormUnidade,
  formData: FormData
): Promise<EstadoFormUnidade> {
  // A UC é artefato de pós-venda, ainda que apareça na tela do cliente: quem
  // mantém é o atendimento, que não tem escrita no cadastro do cliente.
  await exigirPermissao("posVenda", "escrita");

  const dados = unidadeSchema.safeParse({
    numero: formData.get("numero"),
    apelido: formData.get("apelido") || undefined,
    concessionariaId: formData.get("concessionariaId"),
    tipo: formData.get("tipo"),
    geradoraId: formData.get("geradoraId") || undefined,
    percentualRateio: formData.get("percentualRateio") || undefined,
    obraId: formData.get("obraId") || undefined,
    titular: formData.get("titular") || undefined,
    potenciaKwp: formData.get("potenciaKwp") || undefined,
    cidade: formData.get("cidade") || undefined,
    uf: formData.get("uf") || undefined,
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  // Rateio somando mais de 100% numa geradora é exatamente a origem do
  // "erro de compensação de unidade beneficiária" — barra antes de virar
  // chamado.
  if (dados.data.tipo === "beneficiaria" && dados.data.geradoraId) {
    const { data: irmas } = await supabase
      .from("UnidadeConsumidora")
      .select("percentualRateio")
      .eq("geradoraId", dados.data.geradoraId);

    const jaRateado = (irmas ?? []).reduce((s, u) => s + (u.percentualRateio ?? 0), 0);
    const total = jaRateado + (dados.data.percentualRateio ?? 0);
    if (total > 100) {
      return {
        erro: `Rateio ultrapassa 100% na geradora (${jaRateado}% já distribuídos).`,
      };
    }
  }

  const { error } = await supabase.from("UnidadeConsumidora").insert({
    clienteId,
    numero: dados.data.numero,
    apelido: dados.data.apelido ?? null,
    concessionariaId: dados.data.concessionariaId,
    tipo: dados.data.tipo,
    geradoraId: dados.data.tipo === "beneficiaria" ? (dados.data.geradoraId ?? null) : null,
    percentualRateio:
      dados.data.tipo === "beneficiaria" ? (dados.data.percentualRateio ?? null) : null,
    obraId: dados.data.obraId ?? null,
    titular: dados.data.titular ?? null,
    potenciaKwp: dados.data.potenciaKwp ?? null,
    cidade: dados.data.cidade ?? null,
    uf: dados.data.uf ?? null,
  });

  if (error) {
    return { erro: "Já existe uma UC com esse número nessa concessionária." };
  }

  revalidatePath(`/cadastros/clientes/${clienteId}`);
}

export async function removerUnidadeConsumidora(clienteId: string, unidadeId: string) {
  await exigirPermissao("posVenda", "escrita");
  await supabase.from("UnidadeConsumidora").delete().eq("id", unidadeId);
  revalidatePath(`/cadastros/clientes/${clienteId}`);
}
