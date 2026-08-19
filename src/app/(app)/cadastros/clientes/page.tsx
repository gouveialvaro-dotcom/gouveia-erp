import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function PaginaClientes({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { perfil } = await acessoModulo("clientes");
  const { q } = await searchParams;

  let query = supabase
    .from("Cliente")
    .select("*, contatos:ContatoCliente(nome, telefone), orcamentos:Orcamento(count)")
    .order("razaoSocial", { ascending: true });

  if (q) {
    query = query.or(`razaoSocial.ilike.%${q}%,cnpj.ilike.%${q}%`);
  }

  const { data } = await query;
  const clientes = data ?? [];

  const podeEditar = podeEscrever(perfil, "clientes");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-muted-foreground">
            {clientes.length} cliente(s) cadastrado(s)
          </p>
        </div>
        {podeEditar && (
          <Button render={<Link href="/cadastros/clientes/novo" />} nativeButton={false}>+ Novo cliente</Button>
        )}
      </div>

      <form className="max-w-sm">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nome ou CNPJ..."
        />
      </form>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Razão social</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Cidade/UF</TableHead>
              <TableHead>Contato principal</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead className="text-right">Orçamentos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientes.map((c) => (
              <TableRow key={c.id} className="cursor-pointer">
                <TableCell className="font-medium">
                  <Link href={`/cadastros/clientes/${c.id}`} className="hover:underline">
                    {c.razaoSocial}
                  </Link>
                </TableCell>
                <TableCell>{c.cnpj}</TableCell>
                <TableCell>
                  {c.cidade ? `${c.cidade}${c.uf ? "/" + c.uf : ""}` : "—"}
                </TableCell>
                <TableCell>{c.contatos[0]?.nome ?? "—"}</TableCell>
                <TableCell>{c.contatos[0]?.telefone ?? "—"}</TableCell>
                <TableCell className="text-right">{c.orcamentos[0]?.count ?? 0}</TableCell>
              </TableRow>
            ))}
            {clientes.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhum cliente encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
