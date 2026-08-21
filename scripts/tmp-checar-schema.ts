import { supabase } from "../src/lib/supabase";

async function main() {
  const { error: e1 } = await supabase.from("Funcao").select("id").limit(1);
  const { error: e2 } = await supabase.from("Funcionario").select("funcaoId").limit(1);
  const { error: e3 } = await supabase.from("OrcamentoMaoObra").select("funcaoId").limit(1);
  console.log("Funcao:", e1 ? `PENDENTE (${e1.message})` : "ok");
  console.log("Funcionario.funcaoId:", e2 ? `PENDENTE (${e2.message})` : "ok");
  console.log("OrcamentoMaoObra.funcaoId:", e3 ? `PENDENTE (${e3.message})` : "ok");
}

main();
