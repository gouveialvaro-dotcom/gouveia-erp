import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConcessionariaForm } from "@/components/cadastros/concessionaria-form";
import { alternarConcessionaria } from "./actions";

export default async function PaginaConcessionarias() {
  const { perfil } = await acessoModulo("posVenda");
  const podeEditar = podeEscrever(perfil, "posVenda");

  const { data } = await supabase
    .from("Concessionaria")
    .select("*, unidades:UnidadeConsumidora(count)")
    .order("nome");

  const concessionarias = data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Distribuidoras usadas nas unidades consumidoras dos clientes — {concessionarias.length}{" "}
        cadastrada(s).
      </p>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Sigla</TableHead>
              <TableHead>UF</TableHead>
              <TableHead className="text-right">UCs vinculadas</TableHead>
              <TableHead>Situação</TableHead>
              {podeEditar && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {concessionarias.map((c) => (
              <TableRow key={c.id} className={c.ativo ? undefined : "opacity-50"}>
                <TableCell className="font-medium">{c.nome}</TableCell>
                <TableCell>{c.sigla ?? "—"}</TableCell>
                <TableCell>{c.uf ?? "—"}</TableCell>
                <TableCell className="text-right">{c.unidades[0]?.count ?? 0}</TableCell>
                <TableCell>
                  <Badge variant={c.ativo ? "secondary" : "outline"}>
                    {c.ativo ? "Ativa" : "Inativa"}
                  </Badge>
                </TableCell>
                {podeEditar && (
                  <TableCell className="text-right">
                    <form action={alternarConcessionaria.bind(null, c.id, c.ativo)}>
                      <Button type="submit" variant="ghost" size="sm">
                        {c.ativo ? "Desativar" : "Ativar"}
                      </Button>
                    </form>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {concessionarias.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhuma concessionária cadastrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {podeEditar && (
        <>
          <Separator />
          <h3 className="font-semibold">Nova concessionária</h3>
          <ConcessionariaForm />
        </>
      )}
    </div>
  );
}
