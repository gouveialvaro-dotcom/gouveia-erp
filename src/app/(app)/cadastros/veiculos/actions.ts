"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { exigirPermissao } from "@/lib/api-auth";
import { normalizarPlaca, placaValida } from "@/lib/programacao";

const veiculoSchema = z.object({
  placa: z.string().trim().min(1, "Informe a placa."),
  modelo: z.string().trim().min(1, "Informe o modelo."),
  tipo: z.enum(["caminhonete", "van", "munck", "caminhao", "carro_passeio", "outro"]),
  identificacao: z.string().trim().optional(),
  ativo: z.coerce.boolean(),
});

export type EstadoFormVeiculo = { erro?: string } | undefined;

export async function salvarVeiculo(
  veiculoId: string | null,
  _estado: EstadoFormVeiculo,
  formData: FormData
): Promise<EstadoFormVeiculo> {
  const { usuarioId } = await exigirPermissao("veiculos", "escrita");

  const dados = veiculoSchema.safeParse({
    placa: formData.get("placa"),
    modelo: formData.get("modelo"),
    tipo: formData.get("tipo"),
    identificacao: String(formData.get("identificacao") ?? "").trim() || undefined,
    ativo: formData.get("ativo") === "on" || formData.get("ativo") === "true",
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  if (!placaValida(dados.data.placa)) {
    return { erro: "Placa fora do padrão brasileiro (AAA1234 ou AAA1A23)." };
  }

  // Normalizada ANTES de gravar, num lugar só. Se "PGA-1A23" e "pga1a23"
  // entrassem como dois veículos, a trava de duplicidade da programação
  // deixaria o mesmo carro sair para dois destinos no mesmo dia.
  const registro = {
    placa: normalizarPlaca(dados.data.placa),
    modelo: dados.data.modelo,
    tipo: dados.data.tipo,
    identificacao: dados.data.identificacao ?? null,
    ativo: dados.data.ativo,
  };

  const { error } = veiculoId
    ? await supabase.from("Veiculo").update(registro).eq("id", veiculoId)
    : await supabase.from("Veiculo").insert({ ...registro, criadoPorId: usuarioId });

  if (error) {
    if (error.code === "23505") return { erro: "Já existe um veículo com esta placa." };
    return { erro: error.message };
  }

  revalidatePath("/cadastros/veiculos");
  revalidatePath("/programacao");
  redirect("/cadastros/veiculos");
}
