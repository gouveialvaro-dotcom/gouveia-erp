import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { formatarMoeda, formatarData } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function PaginaKits() {
  const { perfil } = await acessoModulo("cadastrosGerais");
  const podeEditar = podeEscrever(perfil, "cadastrosGerais");

  const { data } = await supabase
    .from("Kit")
    .select("*, itens:KitItem(quantidade, material:Material(custoUnitario))")
    .order("nome", { ascending: true });
  const kits = data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">Conjuntos de materiais para orçamento rápido</p>
        {podeEditar && (
          <Button render={<Link href="/cadastros/kits/novo" />} nativeButton={false}>+ Novo kit</Button>
        )}
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome do kit</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Itens</TableHead>
              <TableHead className="text-right">Custo total</TableHead>
              <TableHead>Atualizado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {kits.map((k) => {
              const custoTotal = k.itens.reduce(
                (acc, item) => acc + item.quantidade * (item.material?.custoUnitario ?? 0),
                0
              );
              return (
                <TableRow key={k.id}>
                  <TableCell className="font-medium">
                    <Link href={`/cadastros/kits/${k.id}`} className="hover:underline">
                      {k.nome}
                    </Link>
                  </TableCell>
                  <TableCell>{k.categoria ?? "—"}</TableCell>
                  <TableCell className="text-right">{k.itens.length}</TableCell>
                  <TableCell className="text-right">{formatarMoeda(custoTotal)}</TableCell>
                  <TableCell>{formatarData(k.atualizadoEm)}</TableCell>
                </TableRow>
              );
            })}
            {kits.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhum kit cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
