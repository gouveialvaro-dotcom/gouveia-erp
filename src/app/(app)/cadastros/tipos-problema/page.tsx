import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { TipoProblemaForm } from "@/components/cadastros/tipo-problema-form";
import { BotaoExcluir } from "@/components/ui/botao-excluir";
import {
  atualizarTipoProblema,
  alternarTipoProblema,
  excluirTipoProblema,
} from "./actions";

// Grade em <div> e não <table>: cada linha é um <form> próprio, e um form não
// pode envolver várias <td> sem quebrar a tabela.
//
// Cabeçalho e linhas são grids independentes, então nenhuma trilha pode ser
// dimensionada pelo conteúdo: com `auto` na última coluna o cabeçalho medía só
// a palavra "Chamados", enquanto a linha medía os botões Salvar/Desativar.
// Sobrava largura para o `1fr` do cabeçalho e todos os títulos escorregavam
// para a direita das caixas que rotulam. Largura fixa em tudo menos no nome dá
// a mesma régua para os dois.
const COLUNAS = "md:grid-cols-[minmax(0,1fr)_6rem_6rem_5rem_15rem]";

export default async function PaginaTiposProblema() {
  const { perfil } = await acessoModulo("posVenda");
  const podeEditar = podeEscrever(perfil, "posVenda");

  const { data } = await supabase
    .from("TipoProblemaPosVenda")
    .select("*, chamados:Chamado(count)")
    .order("ordem")
    .order("nome");

  const tipos = data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Catálogo de problemas do pós-venda. O prazo cadastrado aqui é o SLA aplicado no momento
        em que um chamado desse tipo é aberto — chamados já abertos mantêm o prazo com que
        nasceram, para não alterar um atendimento em andamento.
      </p>

      <div className="rounded-md border bg-card divide-y">
        <div
          className={cn(
            "hidden md:grid gap-3 px-3 py-2 text-xs text-muted-foreground items-end",
            COLUNAS
          )}
        >
          <span>Tipo de problema</span>
          <span>Prazo (dias)</span>
          <span>Alertar com</span>
          <span className="text-right">Chamados</span>
          {/* Coluna das ações: sem título, mas precisa existir para a grade do
              cabeçalho ter o mesmo número de trilhas da grade das linhas. */}
          <span />
        </div>

        {tipos.map((t) => (
          <form
            key={t.id}
            action={atualizarTipoProblema.bind(null, t.id)}
            className={cn(
              "grid gap-3 px-3 py-2 items-center",
              COLUNAS,
              !t.ativo && "opacity-50"
            )}
          >
            {podeEditar ? (
              <>
                <Input name="nome" defaultValue={t.nome} required aria-label="Nome" />
                <Input
                  name="prazoDias"
                  type="number"
                  min="1"
                  defaultValue={t.prazoDias}
                  required
                  aria-label="Prazo em dias"
                />
                <Input
                  name="diasAlerta"
                  type="number"
                  min="0"
                  defaultValue={t.diasAlerta}
                  required
                  aria-label="Dias de alerta"
                />
                <span className="text-sm text-muted-foreground md:text-right">
                  <span className="md:hidden">Chamados: </span>
                  {t.chamados[0]?.count ?? 0}
                </span>
                <div className="flex items-center justify-end gap-1">
                  <Button type="submit" variant="outline" size="sm">
                    Salvar
                  </Button>
                  {/* <button> nativo: só ele aceita formAction com uma Server
                      Action, e assim o botão vive dentro do mesmo <form> da
                      linha sem precisar de um segundo formulário aninhado. */}
                  <button
                    type="submit"
                    formAction={alternarTipoProblema.bind(null, t.id, t.ativo)}
                    className={buttonVariants({ variant: "ghost", size: "sm" })}
                  >
                    {t.ativo ? "Desativar" : "Ativar"}
                  </button>
                  <BotaoExcluir
                    acao={excluirTipoProblema}
                    campos={{ tipoId: t.id }}
                    variant="ghost"
                    titulo={`Excluir "${t.nome}"?`}
                    descricao={
                      <>
                        O tipo some do catálogo, sem volta. Se já houver chamado usando este
                        tipo, a exclusão é recusada — nesse caso use Desativar, que tira o tipo
                        da lista de escolha e preserva o histórico.
                      </>
                    }
                  />
                </div>
              </>
            ) : (
              <>
                <span className="font-medium text-sm">{t.nome}</span>
                <span className="text-sm">{t.prazoDias}</span>
                <span className="text-sm">{t.diasAlerta}</span>
                <span className="text-sm text-muted-foreground md:text-right">
                  <span className="md:hidden">Chamados: </span>
                  {t.chamados[0]?.count ?? 0}
                </span>
                {/* Sem ações para quem só lê, mas a trilha precisa ser ocupada
                    para as colunas casarem com o cabeçalho. */}
                <span />
              </>
            )}
          </form>
        ))}

        {tipos.length === 0 && (
          <p className="text-center text-muted-foreground py-8 text-sm">
            Nenhum tipo de problema cadastrado.
          </p>
        )}
      </div>

      {podeEditar && (
        <>
          <Separator />
          <h3 className="font-semibold">Novo tipo de problema</h3>
          <TipoProblemaForm />
        </>
      )}
    </div>
  );
}
