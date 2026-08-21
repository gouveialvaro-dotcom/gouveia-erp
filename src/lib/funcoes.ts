// Server-only: importa o client Supabase de service role. Nunca importe isto
// de um Client Component (ver src/lib/supabase.ts).

import { supabase } from "@/lib/supabase";
import { DIAS_UTEIS_MES_PADRAO } from "@/lib/mao-obra";

// Catálogo de funções + o divisor de dias úteis, que andam sempre juntos:
// qualquer tela que ofereça uma função também mostra o custo/dia dela, e o
// custo/dia depende do parâmetro geral.
export async function carregarFuncoes({ somenteAtivas }: { somenteAtivas: boolean }) {
  const consulta = supabase
    .from("Funcao")
    .select("id, nome, salarioMensal, encargosPercent, ativo")
    .order("nome", { ascending: true });

  const [{ data: funcoes }, { data: parametros }] = await Promise.all([
    somenteAtivas ? consulta.eq("ativo", true) : consulta,
    supabase.from("ParametroGeral").select("diasUteisMes").limit(1).maybeSingle(),
  ]);

  return {
    funcoes: funcoes ?? [],
    diasUteisMes: parametros?.diasUteisMes ?? DIAS_UTEIS_MES_PADRAO,
  };
}
