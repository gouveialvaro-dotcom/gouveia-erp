import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { formatarData } from "@/lib/format";
import { podeEscrever } from "@/lib/permissoes";
import {
  ROTULO_RAMO,
  ROTULO_SITUACAO_MANUTENCAO,
  listaDoRamo,
  situacaoManutencao,
  vigenciaManutencao,
} from "@/lib/clientes";
import { ClienteForm } from "@/components/cadastros/cliente-form";
import { UnidadeForm } from "@/components/cadastros/unidade-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { removerUnidade } from "../actions";

type UnidadeLinha = {
  id: string;
  numero: string;
  endereco: string | null;
  tipo: "geradora" | "beneficiaria";
  concessionaria: { nome: string; sigla: string | null } | null;
  chamados: { count: number }[];
};

// Uma tabela por tipo de unidade: geradora e beneficiária são listas
// independentes dentro do cadastro do cliente solar.
function TabelaUnidades({
  linhas,
  tipo,
  clienteId,
  podeEditar,
}: {
  linhas: UnidadeLinha[];
  tipo: "geradora" | "beneficiaria";
  clienteId: string;
  podeEditar: boolean;
}) {
  return (
    <div className="rounded-md border bg-card mb-4 max-w-4xl">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número da unidade</TableHead>
            <TableHead>Endereço</TableHead>
            <TableHead>Concessionária</TableHead>
            <TableHead className="text-right">Chamados</TableHead>
            {podeEditar && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhas.map((u) => {
            const chamados = u.chamados[0]?.count ?? 0;
            return (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.numero}</TableCell>
                <TableCell>{u.endereco ?? "—"}</TableCell>
                <TableCell>{u.concessionaria?.sigla ?? u.concessionaria?.nome ?? "—"}</TableCell>
                <TableCell className="text-right">
                  {chamados ? (
                    <Link href={`/pos-venda?cliente=${clienteId}`} className="hover:underline">
                      {chamados}
                    </Link>
                  ) : (
                    0
                  )}
                </TableCell>
                {podeEditar && (
                  <TableCell className="text-right">
                    {chamados ? (
                      // Excluir deixaria os chamados sem a unidade de origem.
                      <span className="text-xs text-muted-foreground">Em uso no pós-venda</span>
                    ) : (
                      <form action={removerUnidade.bind(null, clienteId, u.id)}>
                        <Button type="submit" variant="ghost" size="sm">
                          Excluir
                        </Button>
                      </form>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
          {linhas.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={podeEditar ? 5 : 4}
                className="text-center text-muted-foreground py-6"
              >
                Nenhuma unidade {tipo === "geradora" ? "geradora" : "beneficiária"} cadastrada.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export default async function PaginaEditarCliente({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { perfil } = await acessoModulo("clientes");
  const { id } = await params;

  const { data: cliente } = await supabase
    .from("Cliente")
    .select("*, orcamentos:Orcamento(*)")
    .eq("id", id)
    .order("criadoEm", { referencedTable: "Orcamento", ascending: false })
    .maybeSingle();

  if (!cliente) notFound();

  const solar = cliente.ramo === "energia_solar";
  const podeEditar = podeEscrever(perfil, "clientes");
  // As UGs/UBs alimentam o chamado: o atendimento também mantém essa lista,
  // ainda que só leia o resto do cadastro.
  const podeEditarUnidade = podeEditar || podeEscrever(perfil, "posVenda");

  const [{ data: unidades }, { data: concessionarias }] = await Promise.all([
    supabase
      .from("UnidadeConsumidora")
      .select("id, numero, endereco, tipo, concessionaria:Concessionaria(nome, sigla), chamados:Chamado(count)")
      .eq("clienteId", cliente.id)
      .order("numero"),
    supabase.from("Concessionaria").select("id, nome").eq("ativo", true).order("nome"),
  ]);

  const todas: UnidadeLinha[] = unidades ?? [];
  const geradoras = todas.filter((u) => u.tipo === "geradora");
  const beneficiarias = todas.filter((u) => u.tipo === "beneficiaria");
  const situacao = ROTULO_SITUACAO_MANUTENCAO[situacaoManutencao(cliente)];
  const vigencia = vigenciaManutencao(cliente);

  return (
    <div className="flex flex-col gap-1">
      <Link href={listaDoRamo(cliente.ramo)} className="text-sm text-muted-foreground hover:underline w-fit">
        ← {ROTULO_RAMO[cliente.ramo]}
      </Link>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">Cliente · {cliente.razaoSocial}</h2>
        <Badge variant="outline">{ROTULO_RAMO[cliente.ramo]}</Badge>
        {solar && <Badge variant={situacao.variant}>{situacao.texto}</Badge>}
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {solar && vigencia
          ? `Contrato de manutenção vigente de ${vigencia}.`
          : solar
            ? "Sem período de manutenção cadastrado — o pós-venda não aceita abrir chamado deste cliente."
            : "Edição de cadastro."}
      </p>

      {podeEditar ? (
        <ClienteForm
          ramo={cliente.ramo}
          cliente={{
            id: cliente.id,
            ramo: cliente.ramo,
            razaoSocial: cliente.razaoSocial,
            cnpj: cliente.cnpj,
            contato: cliente.contato,
            telefone: cliente.telefone,
            email: cliente.email,
            endereco: cliente.endereco,
            observacoes: cliente.observacoes,
            manutencaoInicio: cliente.manutencaoInicio,
            manutencaoFim: cliente.manutencaoFim,
          }}
        />
      ) : (
        <dl className="grid grid-cols-2 gap-3 max-w-2xl text-sm">
          <div>
            <dt className="text-muted-foreground">Razão social</dt>
            <dd>{cliente.razaoSocial}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">CNPJ / CPF</dt>
            <dd>{cliente.cnpj}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Contato</dt>
            <dd>
              {cliente.contato ?? "—"}
              {cliente.telefone ? ` · ${cliente.telefone}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">E-mail</dt>
            <dd>{cliente.email ?? "—"}</dd>
          </div>
          {solar ? (
            <div>
              <dt className="text-muted-foreground">Manutenção</dt>
              <dd>{vigencia ?? "sem período cadastrado"}</dd>
            </div>
          ) : (
            <div>
              <dt className="text-muted-foreground">Endereço</dt>
              <dd>{cliente.endereco ?? "—"}</dd>
            </div>
          )}
          <div className="col-span-2">
            <dt className="text-muted-foreground">Observações</dt>
            <dd className="whitespace-pre-line">{cliente.observacoes ?? "—"}</dd>
          </div>
        </dl>
      )}

      {solar && (
        <>
          <Separator className="my-6" />

          <h3 className="font-semibold mb-1">Unidades geradoras</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Onde fica a usina. É a unidade que gera os créditos compensados nas beneficiárias.
          </p>
          <TabelaUnidades
            linhas={geradoras}
            tipo="geradora"
            clienteId={cliente.id}
            podeEditar={podeEditarUnidade}
          />
          {podeEditarUnidade && (
            <UnidadeForm
              clienteId={cliente.id}
              tipo="geradora"
              concessionarias={concessionarias ?? []}
            />
          )}

          <h3 className="font-semibold mb-1">Unidades beneficiárias</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Unidades que recebem os créditos da geradora — cada uma com seu número e endereço.
          </p>
          <TabelaUnidades
            linhas={beneficiarias}
            tipo="beneficiaria"
            clienteId={cliente.id}
            podeEditar={podeEditarUnidade}
          />
          {podeEditarUnidade && (
            <UnidadeForm
              clienteId={cliente.id}
              tipo="beneficiaria"
              concessionarias={concessionarias ?? []}
            />
          )}

          <Separator className="my-2" />
        </>
      )}

      <h3 className="font-semibold mb-3 mt-4">Histórico de orçamentos e propostas</h3>
      <div className="rounded-md border bg-card max-w-3xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Projeto</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cliente.orcamentos.map((o) => (
              <TableRow key={o.id}>
                <TableCell>{o.nomeProjeto}</TableCell>
                <TableCell>{o.tipoProposta === "usina_solar" ? "Usina Solar" : "Redes"}</TableCell>
                <TableCell>{o.status}</TableCell>
                <TableCell>{formatarData(o.criadoEm)}</TableCell>
              </TableRow>
            ))}
            {cliente.orcamentos.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                  Nenhum orçamento vinculado ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
