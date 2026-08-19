"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { exigirPermissao } from "@/lib/api-auth";

const orcamentoSchema = z.object({
  nomeProjeto: z.string().min(1, "Informe o nome do projeto."),
  clienteId: z.string().min(1, "Selecione o cliente."),
  tipoProposta: z.enum(["usina_solar", "redes"]),
  descricao: z.string().optional(),
  status: z.enum(["em_elaboracao", "finalizado", "revisao"]).optional(),
});

export type EstadoFormOrcamento = { erro?: string } | undefined;

export async function salvarOrcamento(
  orcamentoId: string | null,
  _estado: EstadoFormOrcamento,
  formData: FormData
): Promise<EstadoFormOrcamento> {
  const { session } = await exigirPermissao("orcamentos", "escrita");

  const dados = orcamentoSchema.safeParse({
    nomeProjeto: formData.get("nomeProjeto"),
    clienteId: formData.get("clienteId"),
    tipoProposta: formData.get("tipoProposta"),
    descricao: formData.get("descricao") || undefined,
    status: formData.get("status") || undefined,
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  let id = orcamentoId;
  if (orcamentoId) {
    const { error } = await supabase.from("Orcamento").update(dados.data).eq("id", orcamentoId);
    if (error) return { erro: "Não foi possível salvar o orçamento." };
  } else {
    const { data: criado, error } = await supabase
      .from("Orcamento")
      .insert({ ...dados.data, criadoPorId: session.user.id })
      .select("id")
      .single();
    if (error || !criado) return { erro: "Não foi possível criar o orçamento." };
    id = criado.id;
  }

  revalidatePath("/orcamentos");
  redirect(`/orcamentos/${id}`);
}
