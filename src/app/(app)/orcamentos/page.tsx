import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { formatarData } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ROTULO_STATUS: Record<string, { texto: string; variant: "secondary" | "outline" | "default" }> = {
  em_elaboracao: { texto: "Em elaboração", variant: "secondary" },
  revisao: { texto: "Em revisão", variant: "outline" },
  finalizado: { texto: "Finalizado", variant: "default" },
};

export default async function PaginaOrcamentos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { perfil } = await acessoModulo("orcamentos");
  const { q } = await searchParams;

  let query = supabase
    .from("Orcamento")
    .select("*, cliente:Cliente(razaoSocial)")
    .order("criadoEm", { ascending: false });

  if (q) {
    query = query.ilike("nomeProjeto", `%${q}%`);
  }

  const { data } = await query;
  const orcamentos = data ?? [];

  const podeEditar = podeEscrever(perfil, "orcamentos");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Orçamentos</h1>

      <div className="flex items-end justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {orcamentos.length} orçamento(s) cadastrado(s)
        </p>
        {podeEditar && (
          <Button render={<Link href="/orcamentos/novo" />} nativeButton={false}>+ Novo orçamento</Button>
        )}
      </div>

      <form className="max-w-sm">
        <Input name="q" defaultValue={q} placeholder="Buscar por nome do projeto..." />
      </form>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Projeto</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orcamentos.map((o) => {
              const status = ROTULO_STATUS[o.status] ?? { texto: o.status, variant: "outline" as const };
              return (
                <TableRow key={o.id} className="cursor-pointer">
                  <TableCell className="font-medium">
                    <Link href={`/orcamentos/${o.id}`} className="hover:underline">
                      {o.nomeProjeto}
                    </Link>
                  </TableCell>
                  <TableCell>{o.cliente?.razaoSocial ?? "—"}</TableCell>
                  <TableCell>{o.tipoProposta === "usina_solar" ? "Usina Solar" : "Redes"}</TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.texto}</Badge>
                  </TableCell>
                  <TableCell>{formatarData(o.criadoEm)}</TableCell>
                </TableRow>
              );
            })}
            {orcamentos.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhum orçamento encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
