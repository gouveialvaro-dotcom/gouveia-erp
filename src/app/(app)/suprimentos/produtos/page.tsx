import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { contextoSuprimentos } from "@/lib/suprimentos-auth";
import { ROTULO_TIPO_PRODUTO, type TipoProduto } from "@/lib/suprimentos";
import { termoBusca } from "@/lib/suprimentos-busca";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNativo } from "@/components/ui/select-nativo";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const POR_PAGINA = 50;

export default async function PaginaProdutos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; revisar?: string; tipo?: string; inativos?: string; pagina?: string }>;
}) {
  const { tem } = await contextoSuprimentos();
  const podeEditar = tem("comprador");
  const filtros = await searchParams;
  const termo = termoBusca(filtros.q);
  const pagina = Math.max(1, Number(filtros.pagina) || 1);

  let consulta = supabase
    .from("Produto")
    .select("id, numero, descricao, unidade, categoria, tipo, ativo, revisar, codigos:ProdutoCodigoExterno(origem, codigo)", {
      count: "exact",
    })
    .order("descricao")
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);

  if (termo) {
    // A busca também acha pelo código do Conta Azul.
    const { data: porCodigo } = await supabase
      .from("ProdutoCodigoExterno")
      .select("produtoId")
      .or(`codigo.ilike.%${termo}%,ean.ilike.%${termo}%`)
      .limit(200);
    const ids = [...new Set((porCodigo ?? []).map((c) => c.produtoId))];
    consulta = consulta.or(
      [`descricao.ilike.%${termo}%`, `categoria.ilike.%${termo}%`, ...(ids.length ? [`id.in.(${ids.join(",")})`] : [])].join(",")
    );
  }
  if (filtros.revisar === "1") consulta = consulta.eq("revisar", true);
  if (filtros.tipo && filtros.tipo in ROTULO_TIPO_PRODUTO) {
    consulta = consulta.eq("tipo", filtros.tipo as TipoProduto);
  }
  if (filtros.inativos !== "1") consulta = consulta.eq("ativo", true);

  const { data, count } = await consulta;
  const produtos = data ?? [];
  const total = count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const linkPagina = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filtros)) if (v && k !== "pagina") params.set(k, v);
    params.set("pagina", String(p));
    return `/suprimentos/produtos?${params}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <form className="flex flex-wrap items-center gap-2">
          <Input
            name="q"
            defaultValue={filtros.q ?? ""}
            placeholder="Descrição, categoria ou código"
            className="w-64"
          />
          <SelectNativo name="tipo" defaultValue={filtros.tipo ?? ""} className="w-36">
            <option value="">Todos os tipos</option>
            {(Object.keys(ROTULO_TIPO_PRODUTO) as TipoProduto[]).map((t) => (
              <option key={t} value={t}>
                {ROTULO_TIPO_PRODUTO[t]}
              </option>
            ))}
          </SelectNativo>
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" name="revisar" value="1" defaultChecked={filtros.revisar === "1"} />
            Só a revisar
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" name="inativos" value="1" defaultChecked={filtros.inativos === "1"} />
            Incluir inativos
          </label>
          <Button type="submit" variant="outline">
            Filtrar
          </Button>
        </form>
        {podeEditar && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              render={<Link href="/suprimentos/produtos/importar" />}
              nativeButton={false}
            >
              Importar CSV do Conta Azul
            </Button>
            <Button render={<Link href="/suprimentos/produtos/novo" />} nativeButton={false}>
              + Novo produto
            </Button>
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground">{total} produtos</p>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Nº</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Un.</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Códigos Conta Azul</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {produtos.map((p) => (
              <TableRow key={p.id} className={p.ativo ? "" : "opacity-60"}>
                <TableCell className="font-mono text-xs text-muted-foreground">{p.numero}</TableCell>
                <TableCell className="font-medium whitespace-normal">
                  {podeEditar ? (
                    <Link href={`/suprimentos/produtos/${p.id}`} className="hover:underline">
                      {p.descricao}
                    </Link>
                  ) : (
                    p.descricao
                  )}
                  {p.revisar && (
                    <Badge variant="outline" className="ml-2">
                      a revisar
                    </Badge>
                  )}
                  {!p.ativo && (
                    <Badge variant="outline" className="ml-2">
                      inativo
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{p.unidade}</TableCell>
                <TableCell>{ROTULO_TIPO_PRODUTO[p.tipo]}</TableCell>
                <TableCell className="text-muted-foreground">{p.categoria ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-normal">
                  {p.codigos.length === 0
                    ? "—"
                    : p.codigos.map((c) => c.codigo).join(", ")}
                </TableCell>
              </TableRow>
            ))}
            {produtos.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhum produto encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {paginas > 1 && (
        <div className="flex items-center gap-2 text-sm">
          {pagina > 1 && (
            <Link href={linkPagina(pagina - 1)} className="underline">
              ← Anterior
            </Link>
          )}
          <span className="text-muted-foreground">
            Página {pagina} de {paginas}
          </span>
          {pagina < paginas && (
            <Link href={linkPagina(pagina + 1)} className="underline">
              Próxima →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
