import Link from "next/link";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { contextoSuprimentos } from "@/lib/suprimentos-auth";
import { formatarCnpj } from "@/lib/suprimentos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FaturamentoObrasForm } from "@/components/suprimentos/cadastro-forms";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function PaginaEmpresas() {
  const { ehAdmin } = await contextoSuprimentos();
  if (!ehAdmin) redirect("/suprimentos");

  const [{ data: empresas }, { data: obras }, { data: faturamento }] = await Promise.all([
    supabase.from("EmpresaGrupo").select("*").order("razaoSocial"),
    supabase
      .from("Obra")
      .select("id, nomeProjeto, status, cliente:Cliente(razaoSocial)")
      .order("nomeProjeto"),
    supabase.from("ObraFaturamento").select("obraId, empresaId"),
  ]);

  const lista = empresas ?? [];
  const porObra = Object.fromEntries((faturamento ?? []).map((f) => [f.obraId, f.empresaId]));

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <p className="text-sm text-muted-foreground">
            CNPJs do grupo que podem ser faturados nos pedidos de compra.
          </p>
          <Button render={<Link href="/suprimentos/empresas/novo" />} nativeButton={false}>
            + Nova empresa
          </Button>
        </div>
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Razão social</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>UF</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((empresa) => (
                <TableRow key={empresa.id}>
                  <TableCell className="font-medium">
                    <Link href={`/suprimentos/empresas/${empresa.id}`} className="hover:underline">
                      {empresa.razaoSocial}
                    </Link>
                    {empresa.nomeFantasia && (
                      <div className="text-xs text-muted-foreground">{empresa.nomeFantasia}</div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono">{formatarCnpj(empresa.cnpj)}</TableCell>
                  <TableCell>{empresa.uf ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={empresa.ativo ? "secondary" : "outline"}>
                      {empresa.ativo ? "Ativa" : "Inativa"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {lista.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhuma empresa cadastrada. Os pedidos saem sem empresa faturada até que
                    uma seja cadastrada e ligada à obra.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">Faturamento por obra</h2>
          <p className="text-sm text-muted-foreground">
            A obra da requisição define qual CNPJ é faturado no pedido de compra.
          </p>
        </div>
        <FaturamentoObrasForm
          obras={(obras ?? []).map((obra) => ({
            id: obra.id,
            nome: obra.nomeProjeto ?? "Obra sem nome",
            cliente: obra.cliente?.razaoSocial ?? null,
          }))}
          empresas={lista.filter((e) => e.ativo).map((e) => ({ id: e.id, nome: e.razaoSocial }))}
          valores={porObra}
        />
      </section>
    </div>
  );
}
