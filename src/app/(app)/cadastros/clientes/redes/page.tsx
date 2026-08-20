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

export default async function PaginaClientesRedes({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { perfil } = await acessoModulo("clientes");
  const { q } = await searchParams;

  let query = supabase
    .from("Cliente")
    .select("*, orcamentos:Orcamento(count)")
    .eq("ramo", "redes_subestacoes")
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
        <p className="text-sm text-muted-foreground">
          {clientes.length} cliente(s) de redes/subestações
        </p>
        {podeEditar && (
          <Button
            render={<Link href="/cadastros/clientes/novo?ramo=redes" />}
            nativeButton={false}
          >
            + Novo cliente de redes
          </Button>
        )}
      </div>

      <form className="max-w-sm">
        <Input name="q" defaultValue={q} placeholder="Buscar por nome ou CNPJ/CPF..." />
      </form>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Razão social</TableHead>
              <TableHead>CNPJ / CPF</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Endereço</TableHead>
              <TableHead className="text-right">Orçamentos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientes.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  <Link href={`/cadastros/clientes/${c.id}`} className="hover:underline">
                    {c.razaoSocial}
                  </Link>
                </TableCell>
                <TableCell>{c.cnpj}</TableCell>
                <TableCell>{c.contato ?? "—"}</TableCell>
                <TableCell>{c.telefone ?? "—"}</TableCell>
                <TableCell>{c.email ?? "—"}</TableCell>
                <TableCell>{c.endereco ?? "—"}</TableCell>
                <TableCell className="text-right">{c.orcamentos[0]?.count ?? 0}</TableCell>
              </TableRow>
            ))}
            {clientes.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhum cliente de redes/subestações encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
