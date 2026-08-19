import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { formatarData } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { excluirDescricaoPadrao } from "./actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function PaginaDescricoesPadrao() {
  const { perfil } = await acessoModulo("cadastrosGerais");
  const podeEditar = podeEscrever(perfil, "cadastrosGerais");

  const { data } = await supabase.from("DescricaoPadrao").select("*").order("nome", { ascending: true });
  const descricoes = data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Textos-base para preencher a descrição do projeto mais rápido — sempre editáveis no orçamento
        </p>
        {podeEditar && (
          <Button render={<Link href="/cadastros/descricoes/novo" />} nativeButton={false}>+ Nova descrição padrão</Button>
        )}
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo de proposta</TableHead>
              <TableHead>Atualizado em</TableHead>
              {podeEditar && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {descricoes.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">
                  {podeEditar ? (
                    <Link href={`/cadastros/descricoes/${d.id}`} className="hover:underline">
                      {d.nome}
                    </Link>
                  ) : (
                    d.nome
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {d.tipoProposta === "usina_solar" ? "Usina Solar" : "Redes"}
                  </Badge>
                </TableCell>
                <TableCell>{formatarData(d.atualizadoEm)}</TableCell>
                {podeEditar && (
                  <TableCell className="text-right">
                    <form
                      action={async () => {
                        "use server";
                        await excluirDescricaoPadrao(d.id);
                      }}
                    >
                      <Button type="submit" variant="ghost" size="sm">
                        Excluir
                      </Button>
                    </form>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {descricoes.length === 0 && (
              <TableRow>
                <TableCell colSpan={podeEditar ? 4 : 3} className="text-center text-muted-foreground py-8">
                  Nenhuma descrição padrão cadastrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
