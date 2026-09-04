import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { ROTULO_TIPO_VEICULO, type TipoVeiculo } from "@/lib/programacao";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function PaginaVeiculos() {
  const { perfil } = await acessoModulo("veiculos");
  const podeEditar = podeEscrever(perfil, "veiculos");

  const { data } = await supabase
    .from("Veiculo")
    .select("*")
    .order("ativo", { ascending: false })
    .order("modelo", { ascending: true });

  const veiculos = data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Frota que a logística aloca na programação de saída. Sem quilometragem,
          abastecimento ou condutor fixo — o motorista é escolhido por dia, na linha da
          programação.
        </p>
        {podeEditar && (
          <Button render={<Link href="/cadastros/veiculos/novo" />} nativeButton={false}>
            + Novo veículo
          </Button>
        )}
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Placa</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Identificação</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {veiculos.map((veiculo) => (
              <TableRow key={veiculo.id}>
                <TableCell className="font-mono font-medium">
                  {podeEditar ? (
                    <Link
                      href={`/cadastros/veiculos/${veiculo.id}`}
                      className="hover:underline"
                    >
                      {veiculo.placa}
                    </Link>
                  ) : (
                    veiculo.placa
                  )}
                </TableCell>
                <TableCell>{veiculo.modelo}</TableCell>
                <TableCell>{ROTULO_TIPO_VEICULO[veiculo.tipo as TipoVeiculo]}</TableCell>
                <TableCell className="text-muted-foreground">
                  {veiculo.identificacao ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={veiculo.ativo ? "secondary" : "outline"}>
                    {veiculo.ativo ? "Ativo" : "Baixado"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {veiculos.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhum veículo cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
