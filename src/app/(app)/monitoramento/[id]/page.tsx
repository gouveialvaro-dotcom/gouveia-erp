import Link from "next/link";
import { notFound } from "next/navigation";
import { acessoModulo } from "@/lib/pagina-auth";
import { carregarDetalheUsina } from "@/lib/monitoramento-servidor";
import { ROTULO_SITUACAO_MANUTENCAO } from "@/lib/clientes";
import {
  ROTULO_MOTIVO_INATIVACAO,
  ROTULO_SITUACAO_ALERTA,
  ROTULO_TIPO_ALERTA,
} from "@/lib/monitoramento";
import { formatarData, formatarDataHora } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function PaginaDetalheUsina({
  params,
}: {
  // params é Promise nesta versão do Next.
  params: Promise<{ id: string }>;
}) {
  await acessoModulo("monitoramento");
  const { id } = await params;

  const usina = await carregarDetalheUsina(id);
  if (!usina) notFound();

  const maiorGeracao = Math.max(
    1,
    ...usina.geracao30Dias.map((d) => d.energiaDiaKwh ?? 0)
  );

  return (
    <div className="flex flex-col gap-8">
      {/* Identificação ------------------------------------------------------ */}
      <section className="rounded-md border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{usina.nome}</h2>
            <p className="text-sm text-muted-foreground">
              <Link href={`/cadastros/clientes/solar/${usina.clienteId}`} className="hover:underline">
                {usina.cliente}
              </Link>
              {" · "}
              Unidade geradora {usina.unidade}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={ROTULO_SITUACAO_MANUTENCAO[usina.situacaoPlano].variant}>
              {ROTULO_SITUACAO_MANUTENCAO[usina.situacaoPlano].texto}
            </Badge>
            {!usina.ativo && (
              <Badge variant="outline">
                {usina.motivoInativacao
                  ? ROTULO_MOTIVO_INATIVACAO[usina.motivoInativacao]
                  : "Inativa"}
              </Badge>
            )}
          </div>
        </div>

        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Campo rotulo="Potência instalada (cadastro)">
            {usina.potenciaInstaladaKwp === null
              ? "—"
              : `${usina.potenciaInstaladaKwp.toLocaleString("pt-BR")} kWp`}
          </Campo>
          {/* A fonte de verdade é o cadastro da UC — é o que foi projetado e
              vendido. A da API reflete o que está ligado no inversor hoje, e a
              divergência entre as duas é informação útil: string fora do ar
              aparece aqui antes de virar alerta. */}
          <Campo rotulo="Potência informada pela API">
            {usina.potenciaIsolarKwp === null
              ? "—"
              : `${usina.potenciaIsolarKwp.toLocaleString("pt-BR")} kWp`}
          </Campo>
          <Campo rotulo="Vigência do plano">
            {usina.manutencaoInicio && usina.manutencaoFim
              ? `${formatarData(usina.manutencaoInicio)} a ${formatarData(usina.manutencaoFim)}`
              : "sem plano"}
          </Campo>
          <Campo rotulo="Identificação no iSolarCloud">
            <span className="font-mono text-xs">{usina.psId}</span>
            <span className="block text-xs text-muted-foreground">{usina.nomeIsolar}</span>
          </Campo>
        </dl>

        {usina.potenciaInstaladaKwp !== null &&
          usina.potenciaIsolarKwp !== null &&
          Math.abs(usina.potenciaInstaladaKwp - usina.potenciaIsolarKwp) > 0.5 && (
            <p className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm">
              A potência do cadastro e a que a API informa divergem. Vale conferir: pode ser
              cadastro desatualizado, ou string desligada na usina.
            </p>
          )}
      </section>

      {/* Comparativo mensal -------------------------------------------------- */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Mês atual contra o mesmo mês do ano anterior</h2>
        <p className="text-sm text-muted-foreground">
          A comparação de 7 dias tem um ponto cego: degradação lenta — painel sujando, string
          desconectada, inversor perdendo rendimento — arrasta o padrão para baixo junto, e o
          alerta nunca dispara. É este número que enxerga esse tipo de problema.{" "}
          <strong>Ele não gera notificação</strong>: é informação de análise.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Cartao rotulo="Mês atual">
            {usina.energiaMesKwh === null
              ? "sem dado"
              : `${usina.energiaMesKwh.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kWh`}
          </Cartao>
          <Cartao rotulo="Mesmo mês, ano anterior">
            {usina.energiaMesAnoAnteriorKwh === null
              ? "sem histórico"
              : `${usina.energiaMesAnoAnteriorKwh.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kWh`}
          </Cartao>
          <Cartao rotulo="Variação">
            {usina.comparativo === null ? (
              <span className="text-muted-foreground">sem histórico</span>
            ) : (
              <span className={usina.comparativo.destacar ? "text-destructive" : undefined}>
                {usina.comparativo.variacao >= 0 ? "+" : ""}
                {(usina.comparativo.variacao * 100).toFixed(1)}%
              </span>
            )}
          </Cartao>
        </div>
      </section>

      {/* Geração dos últimos 30 dias ----------------------------------------- */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Geração diária — últimos 30 dias</h2>
        {usina.geracao30Dias.length === 0 ? (
          <p className="rounded-md border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhuma leitura registrada. A coleta automática ainda não está em operação.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border bg-card p-4">
            <div className="flex min-w-[600px] items-end gap-1" style={{ height: 160 }}>
              {usina.geracao30Dias.map((dia) => {
                const valor = dia.energiaDiaKwh;
                const altura = valor === null ? 0 : Math.round((valor / maiorGeracao) * 100);
                return (
                  <div key={dia.dataRef} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex w-full flex-1 items-end">
                      {/* Dia sem coleta fica hachurado e não zerado: barra em
                          zero seria lida como usina parada, que é outra coisa. */}
                      <div
                        className={
                          valor === null
                            ? "w-full rounded-sm border border-dashed border-muted-foreground/40"
                            : "w-full rounded-sm bg-primary"
                        }
                        style={{ height: valor === null ? "100%" : `${Math.max(altura, 2)}%` }}
                        title={
                          valor === null
                            ? `${formatarData(dia.dataRef)}: sem dado`
                            : `${formatarData(dia.dataRef)}: ${valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kWh`
                        }
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {dia.dataRef.slice(8, 10)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Alertas -------------------------------------------------------------- */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Alertas</h2>
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead>Aberto em</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Chamado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usina.alertas.map((alerta) => (
                <TableRow key={alerta.id}>
                  <TableCell>
                    <Badge variant={ROTULO_TIPO_ALERTA[alerta.tipo].variant}>
                      {ROTULO_TIPO_ALERTA[alerta.tipo].texto}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{alerta.mensagem}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatarDataHora(alerta.abertoEm)}
                  </TableCell>
                  <TableCell>{ROTULO_SITUACAO_ALERTA[alerta.situacao]}</TableCell>
                  <TableCell>
                    {alerta.chamadoId ? (
                      <Link href={`/pos-venda/${alerta.chamadoId}`} className="hover:underline">
                        ver chamado
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {usina.alertas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Nenhum alerta registrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Falhas --------------------------------------------------------------- */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Falhas do equipamento</h2>
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Dispositivo</TableHead>
                <TableHead>Detectada</TableHead>
                <TableHead>Encerrada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usina.falhas.map((falha) => (
                <TableRow key={falha.id}>
                  <TableCell className="font-mono text-xs">{falha.codigo}</TableCell>
                  <TableCell className="text-sm">{falha.descricao}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {falha.dispositivo ?? "planta inteira"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatarDataHora(falha.detectadaEm)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {falha.encerradaEm ? (
                      <span className="text-muted-foreground">
                        {formatarDataHora(falha.encerradaEm)}
                      </span>
                    ) : (
                      <Badge variant="destructive">em aberto</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {usina.falhas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Nenhuma falha registrada.
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

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

function Cartao({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className="mt-1 text-xl font-semibold">{children}</p>
    </div>
  );
}
