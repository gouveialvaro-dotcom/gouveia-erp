import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { formatarData } from "@/lib/format";
import { podeEscrever } from "@/lib/permissoes";
import { ClienteForm } from "@/components/cadastros/cliente-form";
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
import { adicionarContato, removerContato } from "../actions";

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
  const adicionarContatoComCliente = adicionarContato.bind(null, cliente.id);

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
