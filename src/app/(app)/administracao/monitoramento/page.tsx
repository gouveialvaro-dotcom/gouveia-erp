import Link from "next/link";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { ROTULO_SITUACAO_MANUTENCAO, situacaoManutencao } from "@/lib/clientes";
import { dataRefBrasil, ROTULO_MOTIVO_INATIVACAO } from "@/lib/monitoramento";
import { integracaoConfigurada } from "@/lib/isolarcloud";
import { formatarData } from "@/lib/format";
import { TituloPagina } from "@/components/titulo-pagina";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VincularUsinaForm } from "@/components/monitoramento/vincular-usina-form";
import { desativarUsina, reativarUsina } from "./actions";

export default async function PaginaCadastroUsinas() {
  const { perfil } = await acessoModulo("administracao");
  // Cadastro/vínculo é de admin. Ter escrita em "monitoramento" não basta.
  if (!podeEscrever(perfil, "administracao")) redirect("/monitoramento");

  const hoje = dataRefBrasil();

  const [{ data: usinasData }, { data: clientesData }, { data: unidadesData }] =
    await Promise.all([
      supabase
        .from("UsinaMonitorada")
        .select(
          "id, psId, nomeIsolar, apelido, potenciaIsolarKwp, ativo, motivoInativacao, inativadaEm, cliente:Cliente(id, razaoSocial, ramo, manutencaoInicio, manutencaoFim), unidade:UnidadeConsumidora(id, numero, apelido, potenciaKwp)"
        )
        .order("criadoEm", { ascending: false }),
      // Só energia solar: cliente de redes/subestações não tem usina.
      supabase
        .from("Cliente")
        .select("id, razaoSocial, ramo, manutencaoInicio, manutencaoFim")
        .eq("ramo", "energia_solar")
        .order("razaoSocial"),
      supabase
        .from("UnidadeConsumidora")
        .select("id, clienteId, numero, apelido, tipo, ativo")
        .eq("ativo", true)
        .order("numero"),
    ]);

  const usinas = usinasData ?? [];

  return (
    <div className="flex flex-col gap-8">
      <TituloPagina
        titulo="Cadastro de usinas monitoradas"
        subtitulo="Vínculo entre a planta do iSolarCloud e o cliente"
      />

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Só entra no monitoramento cliente de energia solar com{" "}
          <strong>plano de manutenção ativo</strong> — é o contrato que autoriza a Gouveia a
          acompanhar a usina, a mesma regra que rege a abertura de chamado.
        </p>
        <Button variant="outline" size="sm" render={<Link href="/monitoramento" />}>
          Ir para o painel
        </Button>
      </div>

      <section className="flex flex-col gap-3 rounded-md border bg-card p-4">
        <h2 className="text-base font-semibold">Vincular nova usina</h2>
        <VincularUsinaForm
          integracaoConfigurada={integracaoConfigurada()}
          clientes={clientesData ?? []}
          unidades={(unidadesData ?? []).map((u) => ({
            id: u.id,
            clienteId: u.clienteId,
            numero: u.numero,
            apelido: u.apelido,
            tipo: u.tipo,
            ativo: u.ativo,
          }))}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Usinas cadastradas</h2>
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usina</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Unidade geradora</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {usinas.map((usina) => {
                const situacao = usina.cliente
                  ? situacaoManutencao(usina.cliente, hoje)
                  : "sem_plano";
                return (
                  <TableRow key={usina.id}>
                    <TableCell>
                      <Link
                        href={`/monitoramento/${usina.id}`}
                        className="font-medium hover:underline"
                      >
                        {usina.apelido?.trim() || usina.nomeIsolar}
                      </Link>
                      <span className="block font-mono text-xs text-muted-foreground">
                        {usina.psId}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {usina.cliente?.razaoSocial ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {usina.unidade?.apelido?.trim() || usina.unidade?.numero || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ROTULO_SITUACAO_MANUTENCAO[situacao].variant}>
                        {ROTULO_SITUACAO_MANUTENCAO[situacao].texto}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {usina.ativo ? (
                        <Badge variant="secondary">Monitorando</Badge>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline">
                            {usina.motivoInativacao
                              ? ROTULO_MOTIVO_INATIVACAO[usina.motivoInativacao]
                              : "Inativa"}
                          </Badge>
                          {usina.inativadaEm && (
                            <span className="text-xs text-muted-foreground">
                              {formatarData(usina.inativadaEm)}
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {usina.ativo ? (
                        <form action={desativarUsina}>
                          <input type="hidden" name="usinaId" value={usina.id} />
                          <Button type="submit" variant="ghost" size="sm">
                            Desativar
                          </Button>
                        </form>
                      ) : (
                        <form action={reativarUsina}>
                          <input type="hidden" name="usinaId" value={usina.id} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            disabled={situacao !== "ativo"}
                            title={
                              situacao === "ativo"
                                ? undefined
                                : "O plano de manutenção precisa estar ativo."
                            }
                          >
                            Reativar
                          </Button>
                        </form>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {usinas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Nenhuma usina cadastrada ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
