import Link from "next/link";
import { acessoModulo } from "@/lib/pagina-auth";
import { carregarInativas } from "@/lib/monitoramento-servidor";
import { ROTULO_MOTIVO_INATIVACAO } from "@/lib/monitoramento";
import { formatarData } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function PaginaUsinasInativas() {
  await acessoModulo("monitoramento");
  const usinas = await carregarInativas();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Usina com plano de manutenção vencido sai do monitoramento sozinha, no dia seguinte ao
        fim da vigência. <strong>Nada é apagado</strong>: leitura, falha e alerta ficam, porque é
        histórico de manutenção do cliente e serve de argumento na renovação do contrato. A volta
        é manual — renovação de contrato passa por conferência humana.
      </p>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usina</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Unidade geradora</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Saiu em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usinas.map((usina) => (
              <TableRow key={usina.id}>
                <TableCell>
                  <Link href={`/monitoramento/${usina.id}`} className="font-medium hover:underline">
                    {usina.nome}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{usina.cliente}</TableCell>
                <TableCell className="text-muted-foreground">{usina.unidade}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {usina.motivoInativacao
                      ? ROTULO_MOTIVO_INATIVACAO[usina.motivoInativacao]
                      : "—"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {usina.inativadaEm ? formatarData(usina.inativadaEm) : "—"}
                </TableCell>
              </TableRow>
            ))}
            {usinas.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Nenhuma usina inativa.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
