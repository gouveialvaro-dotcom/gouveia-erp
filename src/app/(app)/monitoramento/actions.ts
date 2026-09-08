"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirPermissao } from "@/lib/api-auth";
import { supabase } from "@/lib/supabase";

const esquemaAlerta = z.object({ alertaId: z.string().min(1) });

/**
 * Tira o alerta da frente sem apagá-lo.
 *
 * "Ignorado" é diferente de "resolvido": resolvido é a coleta constatando que o
 * problema passou; ignorado é a equipe dizendo que já sabe e não quer ser
 * lembrada. Guardar os dois no mesmo estado apagaria a diferença entre uma
 * usina que voltou a gerar e uma que continua parada com todo mundo ciente.
 *
 * Não mexe em resolvidoEm de propósito — o alerta ignorado continua em aberto
 * para a coleta, que resolve sozinha quando o problema sair.
 */
export async function ignorarAlerta(formData: FormData) {
  await exigirPermissao("monitoramento", "escrita");
  const { alertaId } = esquemaAlerta.parse({ alertaId: formData.get("alertaId") });

  await supabase.from("AlertaUsina").update({ situacao: "ignorado" }).eq("id", alertaId);

  revalidatePath("/monitoramento");
}

export async function reabrirAlerta(formData: FormData) {
  await exigirPermissao("monitoramento", "escrita");
  const { alertaId } = esquemaAlerta.parse({ alertaId: formData.get("alertaId") });

  await supabase
    .from("AlertaUsina")
    .update({ situacao: "aberto" })
    .eq("id", alertaId)
    .eq("situacao", "ignorado");

  revalidatePath("/monitoramento");
}
