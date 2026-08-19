"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { auth } from "@/auth";

const parametrosSchema = z.object({
  bdiPadrao: z.coerce.number().min(0),
  encargosSociais: z.coerce.number().min(0),
  impostos: z.coerce.number().min(0),
  margemMinima: z.coerce.number().min(0),
  validadePropostaPadraoDias: z.coerce.number().int().positive(),
  diasUteisMes: z.coerce.number().int().positive(),
  textoImpostosPadrao: z.string().min(1),
});

export type EstadoFormParametros = { erro?: string; sucesso?: boolean } | undefined;

export async function salvarParametros(
  _estado: EstadoFormParametros,
  formData: FormData
): Promise<EstadoFormParametros> {
  const session = await auth();
  if (!session?.user || session.user.perfil !== "admin") {
    return { erro: "Apenas administradores podem editar os parâmetros gerais." };
  }

  const dados = parametrosSchema.safeParse({
    bdiPadrao: formData.get("bdiPadrao"),
    encargosSociais: formData.get("encargosSociais"),
    impostos: formData.get("impostos"),
    margemMinima: formData.get("margemMinima"),
    validadePropostaPadraoDias: formData.get("validadePropostaPadraoDias"),
    diasUteisMes: formData.get("diasUteisMes"),
    textoImpostosPadrao: formData.get("textoImpostosPadrao"),
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { data: existente } = await supabase.from("ParametroGeral").select("id").limit(1).maybeSingle();
  if (existente) {
    await supabase
      .from("ParametroGeral")
      .update({ ...dados.data, atualizadoPorId: session.user.id })
      .eq("id", existente.id);
  } else {
    await supabase.from("ParametroGeral").insert({ ...dados.data, atualizadoPorId: session.user.id });
  }

  revalidatePath("/cadastros/parametros");
  return { sucesso: true };
}
