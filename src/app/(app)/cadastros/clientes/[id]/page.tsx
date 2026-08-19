import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { formatarData } from "@/lib/format";
import { podeEscrever } from "@/lib/permissoes";
import { ROTULO_TIPO_UC } from "@/lib/pos-venda";
import { ClienteForm } from "@/components/cadastros/cliente-form";
import { UnidadeConsumidoraForm } from "@/components/cadastros/unidade-consumidora-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adicionarContato, removerContato, removerUnidadeConsumidora } from "../actions";

export default async function PaginaEditarCliente({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { perfil } = await acessoModulo("clientes");
  const { id } = await params;

  const { data: cliente } = await supabase
    .from("Cliente")
    .select("*, contatos:ContatoCliente(*), orcamentos:Orcamento(*)")
    .eq("id", id)
    .order("criadoEm", { referencedTable: "Orcamento", ascending: false })
    .maybeSingle();

  if (!cliente) notFound();

  const podeEditar = podeEscrever(perfil, "clientes");
  // UC é mantida pelo atendimento, que só lê o cadastro do cliente.
  const podeEditarUc = podeEscrever(perfil, "posVenda");
  const adicionarContatoComCliente = adicionarContato.bind(null, cliente.id);

  const [{ data: unidades }, { data: concessionarias }, { data: obras }] = await Promise.all([
    supabase
      .from("UnidadeConsumidora")
      .select(
        "*, concessionaria:Concessionaria(nome, sigla), chamados:Chamado(count)"
      )
      .eq("clienteId", cliente.id)
      .order("tipo")
      .order("numero"),
    supabase.from("Concessionaria").select("id, nome").eq("ativo", true).order("nome"),
    supabase
      .from("Obra")
      .select("id, oportunidade:Oportunidade!inner(clienteId, orcamento:Orcamento(nomeProjeto))")
      .eq("oportunidade.clienteId", cliente.id),
  ]);

  const unidadesDoCliente = unidades ?? [];
  const numeroPorId = new Map(unidadesDoCliente.map((u) => [u.id, u.numero]));

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">Cliente · {cliente.razaoSocial}</h2>
      <p className="text-sm text-muted-foreground mb-4">Edição de cadastro</p>

      {podeEditar ? (
        <ClienteForm
          cliente={{
            id: cliente.id,
            razaoSocial: cliente.razaoSocial,
            cnpj: cliente.cnpj,
            endereco: cliente.endereco,
            cidade: cliente.cidade,
            uf: cliente.uf,
            observacoes: cliente.observacoes,
          }}
        />
      ) : (
        <dl className="grid grid-cols-2 gap-3 max-w-2xl text-sm">
          <div><dt className="text-muted-foreground">Razão social</dt><dd>{cliente.razaoSocial}</dd></div>
          <div><dt className="text-muted-foreground">CNPJ</dt><dd>{cliente.cnpj}</dd></div>
          <div><dt className="text-muted-foreground">Cidade/UF</dt><dd>{cliente.cidade ?? "—"}/{cliente.uf ?? "—"}</dd></div>
          <div><dt className="text-muted-foreground">Endereço</dt><dd>{cliente.endereco ?? "—"}</dd></div>
        </dl>
      )}

      <Separator className="my-6" />

      <h3 className="font-semibold mb-3">Contatos</h3>
      <div className="rounded-md border bg-card mb-4 max-w-3xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>E-mail</TableHead>
              {podeEditar && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {cliente.contatos.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.nome}</TableCell>
                <TableCell>{c.cargo ?? "—"}</TableCell>
                <TableCell>{c.telefone ?? "—"}</TableCell>
                <TableCell>{c.email ?? "—"}</TableCell>
                {podeEditar && (
                  <TableCell className="text-right">
                    <form
                      action={async () => {
                        "use server";
                        await removerContato(cliente.id, c.id);
                      }}
                    >
                      <Button type="submit" variant="ghost" size="sm">
                        Remover
                      </Button>
                    </form>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {cliente.contatos.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                  Nenhum contato cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {podeEditar && (
        <form action={adicionarContatoComCliente} className="grid grid-cols-4 gap-3 max-w-3xl items-end mb-8">
          <Input name="nome" placeholder="Nome" required />
          <Input name="cargo" placeholder="Cargo" />
          <Input name="telefone" placeholder="Telefone" />
          <div className="flex gap-2">
            <Input name="email" placeholder="E-mail" />
            <Button type="submit" variant="secondary">+ Contato</Button>
          </div>
        </form>
      )}

      <h3 className="font-semibold mb-1">Unidades consumidoras</h3>
      <p className="text-sm text-muted-foreground mb-3">
        Base do pós-venda: é a UC que a concessionária fatura, mede e compensa. Beneficiárias
        precisam apontar para a geradora e o rateio somado não pode passar de 100%.
      </p>
      <div className="rounded-md border bg-card mb-4 max-w-4xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>UC</TableHead>
              <TableHead>Concessionária</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Geradora / rateio</TableHead>
              <TableHead className="text-right">Chamados</TableHead>
              {podeEditarUc && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {unidadesDoCliente.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">
                  {u.numero}
                  {u.apelido && (
                    <span className="text-muted-foreground font-normal"> — {u.apelido}</span>
                  )}
                </TableCell>
                <TableCell>{u.concessionaria?.sigla ?? u.concessionaria?.nome ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={u.tipo === "geradora" ? "secondary" : "outline"}>
                    {ROTULO_TIPO_UC[u.tipo]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {u.tipo === "beneficiaria"
                    ? `UC ${numeroPorId.get(u.geradoraId ?? "") ?? "?"} · ${u.percentualRateio ?? "—"}%`
                    : u.potenciaKwp
                      ? `${u.potenciaKwp} kWp`
                      : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {u.chamados[0]?.count ? (
                    <Link href={`/pos-venda?cliente=${cliente.id}`} className="hover:underline">
                      {u.chamados[0].count}
                    </Link>
                  ) : (
                    0
                  )}
                </TableCell>
                {podeEditarUc && (
                  <TableCell className="text-right">
                    <form action={removerUnidadeConsumidora.bind(null, cliente.id, u.id)}>
                      <Button type="submit" variant="ghost" size="sm">
                        Remover
                      </Button>
                    </form>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {unidadesDoCliente.length === 0 && (
              <TableRow>
                <TableCell colSpan={podeEditarUc ? 6 : 5} className="text-center text-muted-foreground py-6">
                  Nenhuma unidade consumidora cadastrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {podeEditarUc && (
        <UnidadeConsumidoraForm
          clienteId={cliente.id}
          concessionarias={concessionarias ?? []}
          geradoras={unidadesDoCliente
            .filter((u) => u.tipo === "geradora")
            .map((u) => ({
              id: u.id,
              rotulo: `${u.numero}${u.apelido ? ` — ${u.apelido}` : ""}`,
            }))}
          obras={(obras ?? []).map((o) => ({
            id: o.id,
            rotulo: o.oportunidade?.orcamento?.nomeProjeto ?? "Obra sem projeto nomeado",
          }))}
        />
      )}

      <h3 className="font-semibold mb-3">Histórico de orçamentos e propostas</h3>
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
