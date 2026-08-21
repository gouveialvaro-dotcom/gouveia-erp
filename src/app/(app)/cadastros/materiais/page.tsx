import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { formatarMoeda, formatarData } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function PaginaMateriais({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string }>;
}) {
  const { perfil } = await acessoModulo("cadastrosGerais");
  const { q, categoria } = await searchParams;

  const { data: todasCategorias } = await supabase
    .from("Material")
    .select("categoria")
    .order("categoria", { ascending: true });
  const categorias = [...new Set((todasCategorias ?? []).map((c) => c.categoria))].map(
    (categoria) => ({ categoria })
  );

  let materiaisQuery = supabase.from("Material").select("*").order("codigo", { ascending: true });
  if (q) {
    materiaisQuery = materiaisQuery.or(`codigo.ilike.%${q}%,descricao.ilike.%${q}%`);
  }
  if (categoria && categoria !== "todas") {
    materiaisQuery = materiaisQuery.eq("categoria", categoria);
  }
  const { data: materiaisData } = await materiaisQuery;
  const materiais = materiaisData ?? [];

  const podeEditar = podeEscrever(perfil, "cadastrosGerais");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">{materiais.length} itens no catálogo</p>
        {podeEditar && (
          <Button render={<Link href="/cadastros/materiais/novo" />} nativeButton={false}>+ Novo material</Button>
        )}
      </div>

      <form className="flex gap-3 flex-wrap">
        <Input name="q" defaultValue={q} placeholder="Buscar por código ou descrição..." className="max-w-xs" />
        <Select
          name="categoria"
          defaultValue={categoria ?? "todas"}
          items={[
            { value: "todas", label: "Todas as categorias" },
            ...categorias.map((c) => ({ value: c.categoria, label: c.categoria })),
          ]}
        >
          <SelectTrigger className="max-w-[220px]">
            <SelectValue placeholder="Todas as categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {categorias.map((c) => (
              <SelectItem key={c.categoria} value={c.categoria}>
                {c.categoria}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" variant="secondary">Filtrar</Button>
      </form>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Un.</TableHead>
              <TableHead className="text-right">Custo unitário</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Atualizado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {materiais.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-mono text-xs">{m.codigo}</TableCell>
                <TableCell className="font-medium">
                  {podeEditar ? (
                    <Link href={`/cadastros/materiais/${m.id}`} className="hover:underline">
                      {m.descricao}
                    </Link>
                  ) : (
                    m.descricao
                  )}
                </TableCell>
                <TableCell>{m.categoria}</TableCell>
                <TableCell>{m.unidade}</TableCell>
                <TableCell className="text-right">{formatarMoeda(m.custoUnitario)}</TableCell>
                <TableCell>{m.fornecedor ?? "—"}</TableCell>
                <TableCell>{formatarData(m.atualizadoEm)}</TableCell>
              </TableRow>
            ))}
            {materiais.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhum material encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
