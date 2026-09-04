import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { formatarMoeda } from "@/lib/format";
import { custoDiarioMaoObra, DIAS_UTEIS_MES_PADRAO } from "@/lib/mao-obra";
import { formatarTelefone } from "@/lib/pos-venda-whatsapp";
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
    supabase
      .from("Funcionario")
      .select("*, funcao:Funcao(nome)")
      .order("nome", { ascending: true }),
    supabase.from("ParametroGeral").select("*").limit(1).maybeSingle(),
  ]);
  const funcionarios = funcionariosData ?? [];

  const diasUteisMes = parametros?.diasUteisMes ?? DIAS_UTEIS_MES_PADRAO;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Pessoas da equipe. Salário e encargos são herdados da{" "}
          <Link href="/cadastros/funcoes" className="underline">
            função
          </Link>{" "}
          no momento do cadastro e podem ser ajustados por pessoa.
        </p>
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
              <TableHead>WhatsApp</TableHead>
              <TableHead className="text-right">Salário mensal</TableHead>
              <TableHead className="text-right">Encargos</TableHead>
              <TableHead className="text-right">Custo/dia (com encargos)</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {funcionarios.map((f) => {
              const custoDia = custoDiarioMaoObra(f, diasUteisMes);
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
                  {/* Cai para `cargo` porque ele é a foto do nome da função no
                      momento do cadastro — sobrevive a uma função removida. */}
                  <TableCell>{f.funcao?.nome ?? f.cargo}</TableCell>
                  {/* Sem número a pessoa não pode ser motorista de uma linha
                      com veículo — o vazio aqui é informação, não decoração. */}
                  <TableCell className={f.telefone ? "" : "text-muted-foreground"}>
                    {f.telefone ? formatarTelefone(f.telefone) : "—"}
                    {f.telefone && !f.recebeProgramacao && (
                      <Badge variant="outline" className="ml-2">
                        aviso desligado
                      </Badge>
                    )}
                  </TableCell>
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
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
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
