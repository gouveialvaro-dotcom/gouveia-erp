import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { formatarMoeda } from "@/lib/format";
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

export default async function PaginaFuncionarios() {
  const { perfil } = await acessoModulo("cadastrosGerais");
  const podeEditar = podeEscrever(perfil, "cadastrosGerais");

  const [{ data: funcionariosData }, { data: parametros }] = await Promise.all([
    supabase.from("Funcionario").select("*").order("nome", { ascending: true }),
    supabase.from("ParametroGeral").select("*").limit(1).maybeSingle(),
  ]);
  const funcionarios = funcionariosData ?? [];

  const diasUteisMes = parametros?.diasUteisMes ?? 22;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">Custos de mão de obra por colaborador</p>
        {podeEditar && (
          <Button render={<Link href="/cadastros/funcionarios/novo" />} nativeButton={false}>+ Novo funcionário</Button>
        )}
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Função/Cargo</TableHead>
              <TableHead className="text-right">Salário mensal</TableHead>
              <TableHead className="text-right">Encargos</TableHead>
              <TableHead className="text-right">Custo/dia (com encargos)</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {funcionarios.map((f) => {
              const custoDia =
                (f.salarioMensal / diasUteisMes) * (1 + f.encargosPercent / 100);
              return (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">
                    {podeEditar ? (
                      <Link href={`/cadastros/funcionarios/${f.id}`} className="hover:underline">
                        {f.nome}
                      </Link>
                    ) : (
                      f.nome
                    )}
                  </TableCell>
                  <TableCell>{f.cargo}</TableCell>
                  <TableCell className="text-right">{formatarMoeda(f.salarioMensal)}</TableCell>
                  <TableCell className="text-right">{f.encargosPercent}%</TableCell>
                  <TableCell className="text-right">{formatarMoeda(custoDia)}</TableCell>
                  <TableCell>
                    <Badge variant={f.ativo ? "secondary" : "outline"}>
                      {f.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
            {funcionarios.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhum funcionário cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
