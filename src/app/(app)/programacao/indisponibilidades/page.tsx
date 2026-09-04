import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { formatarData } from "@/lib/format";
import { hojeIso, somarDias } from "@/lib/pos-venda";
import {
  ROTULO_TIPO_INDISPONIBILIDADE,
  descricaoVeiculo,
  type TipoIndisponibilidade,
} from "@/lib/programacao";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CampoData } from "@/components/ui/campo-data";
import { Label } from "@/components/ui/label";
import { BotaoExcluir } from "@/components/ui/botao-excluir";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FormIndisponibilidade } from "@/components/programacao/form-indisponibilidade";
import { excluirIndisponibilidade } from "../actions";

export default async function PaginaIndisponibilidades({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string }>;
}) {
  const { perfil } = await acessoModulo("programacao");
  const podeEditar = podeEscrever(perfil, "programacao");

  const parametros = await searchParams;
  const valida = (valor: string | undefined) => /^\d{4}-\d{2}-\d{2}$/.test(valor ?? "");

  // Janela padrão: de hoje a 90 dias. O que já terminou não atrapalha mais
  // ninguém e só faria a lista crescer sem uso.
  const de = valida(parametros.de) ? (parametros.de as string) : hojeIso();
  const ate = valida(parametros.ate) ? (parametros.ate as string) : somarDias(hojeIso(), 90);

  const [{ data: registrosData }, { data: funcionariosData }, { data: veiculosData }] =
    await Promise.all([
      supabase
        .from("Indisponibilidade")
        .select(
          "id, tipo, dataInicio, dataFim, motivo, funcionario:Funcionario(nome), veiculo:Veiculo(modelo, placa, identificacao), criadoPor:Usuario(nome)"
        )
        // Intervalos que se cruzam com a janela — não só os que começam nela.
        .lte("dataInicio", ate)
        .gte("dataFim", de)
        .order("dataInicio", { ascending: true }),
      supabase.from("Funcionario").select("id, nome").eq("ativo", true).order("nome"),
      supabase
        .from("Veiculo")
        .select("id, modelo, placa, identificacao")
        .eq("ativo", true)
        .order("modelo"),
    ]);

  const registros = registrosData ?? [];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Férias, atestado, treinamento, veículo em oficina. Quem está aqui não pode ser alocado
        na programação da data — o bloqueio aparece na tela com o motivo ao lado.
      </p>

      {podeEditar && (
        <FormIndisponibilidade
          funcionarios={(funcionariosData ?? []).map((f) => ({ id: f.id, nome: f.nome }))}
          veiculos={(veiculosData ?? []).map((v) => ({
            id: v.id,
            nome: descricaoVeiculo(v) ?? v.placa,
          }))}
        />
      )}

      {/* Formulário GET: o filtro sobrevive ao recarregar e é compartilhável. */}
      <form className="flex flex-wrap items-end gap-3" method="get">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="de">De</Label>
          <CampoData id="de" name="de" defaultValue={de} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ate">Até</Label>
          <CampoData id="ate" name="ate" defaultValue={ate} />
        </div>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Quem / qual</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Registrado por</TableHead>
              {podeEditar && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {registros.map((registro) => (
              <TableRow key={registro.id}>
                <TableCell>
                  <Badge variant="outline">
                    {ROTULO_TIPO_INDISPONIBILIDADE[registro.tipo as TipoIndisponibilidade]}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">
                  {registro.funcionario?.nome ?? descricaoVeiculo(registro.veiculo) ?? "—"}
                </TableCell>
                <TableCell>
                  {formatarData(registro.dataInicio)} a {formatarData(registro.dataFim)}
                </TableCell>
                <TableCell>{registro.motivo}</TableCell>
                <TableCell className="text-muted-foreground">
                  {registro.criadoPor?.nome ?? "—"}
                </TableCell>
                {podeEditar && (
                  <TableCell>
                    <BotaoExcluir
                      acao={excluirIndisponibilidade}
                      campos={{ id: registro.id }}
                      titulo="Excluir indisponibilidade"
                      descricao={
                        <>
                          A pessoa ou o veículo volta a ficar disponível para alocação no
                          período. Programação já publicada não é alterada por isso.
                        </>
                      }
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
            {registros.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={podeEditar ? 6 : 5}
                  className="text-center text-muted-foreground py-8"
                >
                  Nenhuma indisponibilidade no período.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
