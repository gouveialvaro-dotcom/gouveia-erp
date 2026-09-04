import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { ParametrosForm } from "@/components/cadastros/parametros-form";

export default async function PaginaParametros() {
  const { perfil } = await acessoModulo("cadastrosGerais");

  const { data: parametros } = await supabase.from("ParametroGeral").select("*").limit(1).maybeSingle();

  const valores = {
    bdiPadrao: parametros?.bdiPadrao.toString() ?? "25",
    encargosSociais: parametros?.encargosSociais.toString() ?? "80",
    impostos: parametros?.impostos.toString() ?? "6",
    margemMinima: parametros?.margemMinima.toString() ?? "15",
    validadePropostaPadraoDias: parametros?.validadePropostaPadraoDias ?? 15,
    diasUteisMes: parametros?.diasUteisMes ?? 22,
    tetoDiarioAvisosProgramacao: parametros?.tetoDiarioAvisosProgramacao ?? 60,
    textoImpostosPadrao: parametros?.textoImpostosPadrao ?? "",
  };

  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-muted-foreground mb-4">
        Valores padrão aplicados a novos orçamentos
        {perfil !== "admin" && " (somente leitura — só administradores editam)"}
      </p>
      <ParametrosForm parametros={valores} somenteLeitura={perfil !== "admin"} />
    </div>
  );
}
