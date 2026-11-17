import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { contextoSuprimentos } from "@/lib/suprimentos-auth";
import { formatarCnpj, UF_EMPRESA } from "@/lib/suprimentos";
import { termoBusca } from "@/lib/suprimentos-busca";
import { Badge } from "@/components/ui/badge";
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

export default async function PaginaFornecedores({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { tem } = await contextoSuprimentos();
  const podeEditar = tem("comprador");
  const { q } = await searchParams;
  const termo = termoBusca(q);

  let consulta = supabase
    .from("Fornecedor")
    .select("*")
    .order("ativo", { ascending: false })
    .order("razaoSocial");
  if (termo) {
    consulta = consulta.or(
      `razaoSocial.ilike.%${termo}%,nomeFantasia.ilike.%${termo}%,cnpj.ilike.%${termo}%,cidade.ilike.%${termo}%`
    );
  }
  const { data } = await consulta;
  const fornecedores = data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <form className="flex gap-2">
          <Input name="q" defaultValue={q ?? ""} placeholder="Nome, CNPJ/CPF ou cidade" className="w-64" />
          <Button type="submit" variant="outline">
            Buscar
          </Button>
        </form>
        {podeEditar && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              render={<Link href="/suprimentos/fornecedores/importar" />}
              nativeButton={false}
            >
              Importar planilha do Conta Azul
            </Button>
            <Button render={<Link href="/suprimentos/fornecedores/novo" />} nativeButton={false}>
              + Novo fornecedor
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fornecedor</TableHead>
              <TableHead>CNPJ / CPF</TableHead>
              <TableHead>Local</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fornecedores.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">
                  {podeEditar ? (
                    <Link href={`/suprimentos/fornecedores/${f.id}`} className="hover:underline">
                      {f.razaoSocial}
                    </Link>
                  ) : (
                    f.razaoSocial
                  )}
                  {f.nomeFantasia && (
                    <div className="text-xs text-muted-foreground">{f.nomeFantasia}</div>
                  )}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {f.cnpj ? formatarCnpj(f.cnpj) : "—"}
                </TableCell>
                <TableCell>
                  {[f.cidade, f.uf].filter(Boolean).join(" / ") || "—"}
                  {f.uf && f.uf !== UF_EMPRESA && (
                    <Badge variant="outline" className="ml-2">
                      fora do {UF_EMPRESA}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {[f.vendedor, f.telefone].filter(Boolean).join(" · ") || "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={f.ativo ? "secondary" : "outline"}>
                    {f.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {fornecedores.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  {termo ? "Nenhum fornecedor encontrado." : "Nenhum fornecedor cadastrado."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
