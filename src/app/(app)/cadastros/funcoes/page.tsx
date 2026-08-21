import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { cn } from "@/lib/utils";
import { formatarMoeda } from "@/lib/format";
import {
  custoDiarioMaoObra,
  custoMensalMaoObra,
  DIAS_UTEIS_MES_PADRAO,
} from "@/lib/mao-obra";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { FuncaoForm } from "@/components/cadastros/funcao-form";
import { atualizarFuncao, alternarFuncao } from "./actions";

// Grade em <div> e não <table>: cada linha é um <form> próprio, e um form não
// pode envolver várias <td> sem quebrar a tabela. Todas as trilhas têm largura
// fixa menos a do nome — cabeçalho e linhas são grids independentes, então
// qualquer trilha dimensionada pelo conteúdo mediria diferente nos dois e
// desalinharia os títulos das caixas que eles rotulam.
const COLUNAS = "md:grid-cols-[minmax(0,1fr)_8rem_7rem_7rem_7rem_11rem]";

export default async function PaginaFuncoes() {
  const { perfil } = await acessoModulo("cadastrosGerais");
  const podeEditar = podeEscrever(perfil, "cadastrosGerais");

  const [{ data }, { data: parametros }] = await Promise.all([
    supabase
      .from("Funcao")
      .select("*")
      .order("nome", { ascending: true }),
    supabase.from("ParametroGeral").select("diasUteisMes").limit(1).maybeSingle(),
  ]);

  const funcoes = data ?? [];
  const diasUteisMes = parametros?.diasUteisMes ?? DIAS_UTEIS_MES_PADRAO;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Catálogo de custo de mão de obra por função, vindo da planilha de custo da empresa. O
        salário é o total (base + adicional) e os encargos embutem FGTS, refeição,
        vale-transporte, provisões de férias, terço, 13º, plano de saúde, PLR e cesta do
        sindicato — por isso o custo mensal abaixo bate com a coluna &quot;custo total&quot; da
        planilha. É daqui que o cadastro de funcionários e a alocação de mão de obra em
        orçamentos puxam os valores.
      </p>

      <div className="rounded-md border bg-card divide-y">
        <div
          className={cn(
            "hidden md:grid gap-3 px-3 py-2 text-xs text-muted-foreground items-end",
            COLUNAS
          )}
        >
          <span>Função</span>
          <span>Salário mensal</span>
          <span>Encargos (%)</span>
          <span className="text-right">Custo/mês</span>
          <span className="text-right">Custo/dia</span>
          {/* Coluna das ações: sem título, mas precisa existir para o cabeçalho
              ter o mesmo número de trilhas das linhas. */}
          <span />
        </div>

        {funcoes.map((f) => (
          <form
            key={f.id}
            action={atualizarFuncao.bind(null, f.id)}
            className={cn(
              "grid gap-3 px-3 py-2 items-center",
              COLUNAS,
              !f.ativo && "opacity-50"
            )}
          >
            {podeEditar ? (
              <>
                <Input name="nome" defaultValue={f.nome} required aria-label="Nome da função" />
                <Input
                  name="salarioMensal"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={f.salarioMensal}
                  required
                  aria-label="Salário mensal"
                />
                <Input
                  name="encargosPercent"
                  type="number"
                  step="0.0001"
                  min="0"
                  defaultValue={f.encargosPercent}
                  required
                  aria-label="Encargos em percentual"
                />
              </>
            ) : (
              <>
                <span className="font-medium text-sm">{f.nome}</span>
                <span className="text-sm">{formatarMoeda(f.salarioMensal)}</span>
                <span className="text-sm">{f.encargosPercent}%</span>
              </>
            )}

            {/* Derivados do que está na linha: recalculam ao salvar, então não
                há número guardado que possa divergir do salário/encargos. */}
            <span className="text-sm md:text-right">
              <span className="md:hidden text-muted-foreground">Custo/mês: </span>
              {formatarMoeda(custoMensalMaoObra(f))}
            </span>
            <span className="text-sm font-medium md:text-right">
              <span className="md:hidden text-muted-foreground">Custo/dia: </span>
              {formatarMoeda(custoDiarioMaoObra(f, diasUteisMes))}
            </span>

            {podeEditar ? (
              <div className="flex items-center justify-end gap-1">
                <Button type="submit" variant="outline" size="sm">
                  Salvar
                </Button>
                {/* <button> nativo: só ele aceita formAction com uma Server
                    Action, e assim o botão vive dentro do mesmo <form> da linha
                    sem precisar de um segundo formulário aninhado. */}
                <button
                  type="submit"
                  formAction={alternarFuncao.bind(null, f.id, f.ativo)}
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  {f.ativo ? "Desativar" : "Ativar"}
                </button>
              </div>
            ) : (
              <span />
            )}
          </form>
        ))}

        {funcoes.length === 0 && (
          <p className="text-center text-muted-foreground py-8 text-sm">
            Nenhuma função cadastrada.
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Custo/dia = custo mensal ÷ {diasUteisMes} dias úteis (Parâmetros gerais).
      </p>

      {podeEditar && (
        <>
          <Separator />
          <h3 className="font-semibold">Nova função</h3>
          <FuncaoForm />
        </>
      )}
    </div>
  );
}
