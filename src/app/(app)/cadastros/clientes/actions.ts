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
  const { session } = await exigirPermissao("clientes", "escrita");

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
      .insert({ ...dados.data, criadoPorId: session.user.id })
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
