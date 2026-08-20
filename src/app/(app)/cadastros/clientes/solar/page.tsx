import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import {
  ROTULO_SITUACAO_MANUTENCAO,
  situacaoManutencao,
  vigenciaManutencao,
} from "@/lib/clientes";
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

export default async function PaginaClientesSolar({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { perfil } = await acessoModulo("clientes");
  const { q } = await searchParams;

  let query = supabase
    .from("Cliente")
    .select("*, unidades:UnidadeConsumidora(id, tipo)")
    .eq("ramo", "energia_solar")
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
          {clientes.length} cliente(s) de energia solar. O período de manutenção é o que libera a
          abertura de chamado no pós-venda.
        </p>
        {podeEditar && (
          <Button
            render={<Link href="/cadastros/clientes/novo?ramo=solar" />}
            nativeButton={false}
          >
            + Novo cliente solar
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
              <TableHead>E-mail</TableHead>
              <TableHead className="text-right">Geradoras</TableHead>
              <TableHead className="text-right">Beneficiárias</TableHead>
              <TableHead>Manutenção</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientes.map((c) => {
              const rotulo = ROTULO_SITUACAO_MANUTENCAO[situacaoManutencao(c)];
              const vigencia = vigenciaManutencao(c);
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link href={`/cadastros/clientes/${c.id}`} className="hover:underline">
                      {c.razaoSocial}
                    </Link>
                  </TableCell>
                  <TableCell>{c.cnpj}</TableCell>
                  <TableCell>
                    {c.contato ?? "—"}
                    {c.telefone && <span className="text-muted-foreground"> · {c.telefone}</span>}
                  </TableCell>
                  <TableCell>{c.email ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {c.unidades.filter((u) => u.tipo === "geradora").length}
                  </TableCell>
                  <TableCell className="text-right">
                    {c.unidades.filter((u) => u.tipo === "beneficiaria").length}
                  </TableCell>
                  <TableCell>
                    <Badge variant={rotulo.variant}>{rotulo.texto}</Badge>
                    {vigencia && (
                      <span className="block text-xs text-muted-foreground">{vigencia}</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {clientes.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhum cliente de energia solar encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
