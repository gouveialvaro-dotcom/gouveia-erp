import Link from "next/link";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { carregarPainel, type UsinaDoPainel } from "@/lib/monitoramento-servidor";
import { ROTULO_SITUACAO_MANUTENCAO } from "@/lib/clientes";
import { ordenarAlertas, ROTULO_TIPO_ALERTA } from "@/lib/monitoramento";
import { formatarData, formatarDataHora } from "@/lib/format";
import { tempoRelativo } from "@/lib/pos-venda";
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
import { ignorarAlerta } from "./actions";

export default async function PaginaMonitoramento() {
  const { perfil } = await acessoModulo("monitoramento");
  const podeAgir = podeEscrever(perfil, "monitoramento");
  const podeAbrirChamado = podeEscrever(perfil, "posVenda");

  const { usinas, alertas, atualizadoEm, hoje } = await carregarPainel();
  const emAlerta = ordenarAlertas(alertas);

  return (
    <div className="flex flex-col gap-8">
      {/* Carimbo de última atualização: sem ele não há como saber se o número
          na tela é da coleta das 12h ou da de 18h — e a diferença muda a
          leitura de tudo que está abaixo. */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {usinas.length} usina(s) em monitoramento · dia solar de {formatarData(hoje)}
        </span>
        <span>
          {atualizadoEm
            ? `Última coleta: ${formatarDataHora(atualizadoEm)}`
            : "Nenhuma coleta registrada ainda"}
        </span>
      </div>

      {/* 1. Usinas em alerta ------------------------------------------------ */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Usinas em alerta</h2>

        {emAlerta.length === 0 ? (
          <p className="rounded-md border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhum alerta em aberto.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {emAlerta.map((alerta) => {
              const rotulo = ROTULO_TIPO_ALERTA[alerta.tipo];
              return (
                <div
                  key={alerta.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-md border bg-card p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={rotulo.variant}>{rotulo.texto}</Badge>
                      <Link
                        href={`/monitoramento/${alerta.usinaId}`}
                        className="font-medium hover:underline"
                      >
                        {alerta.usina}
                      </Link>
                      <span className="text-sm text-muted-foreground">{alerta.cliente}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{alerta.mensagem}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Aberto {tempoRelativo(alerta.abertoEm)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {alerta.chamadoId ? (
                      <Button variant="outline" size="sm" render={<Link href={`/pos-venda/${alerta.chamadoId}`} />}>
                        Ver chamado
                      </Button>
                    ) : (
                      podeAbrirChamado && (
                        // O alerta NÃO abre chamado sozinho: a decisão de virar
                        // atendimento é humana. O pré-preenchimento do escopo
                        // (cliente, UC e descrição) depende de o formulário de
                        // /pos-venda/novo aceitar searchParams — ainda não aceita.
                        <Button variant="outline" size="sm" render={<Link href="/pos-venda/novo" />}>
                          Abrir chamado
                        </Button>
                      )
                    )}
                    {podeAgir && (
                      <form action={ignorarAlerta}>
                        <input type="hidden" name="alertaId" value={alerta.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          Ignorar
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 2. Geração do dia -------------------------------------------------- */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Geração do dia</h2>
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usina</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Unidade geradora</TableHead>
                <TableHead className="text-right">Potência instalada</TableHead>
                <TableHead className="text-right">Gerado hoje</TableHead>
                <TableHead>Plano</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usinas.map((usina) => (
                <TableRow key={usina.id}>
                  <TableCell>
                    <Link href={`/monitoramento/${usina.id}`} className="font-medium hover:underline">
                      {usina.nome}
                    </Link>
                    {usina.alertasAbertos > 0 && (
                      <Badge variant="destructive" className="ml-2">
                        {usina.alertasAbertos}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{usina.cliente}</TableCell>
                  <TableCell className="text-muted-foreground">{usina.unidade}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {usina.potenciaInstaladaKwp === null
                      ? "—"
                      : `${usina.potenciaInstaladaKwp.toLocaleString("pt-BR")} kWp`}
                  </TableCell>
                  <TableCell className="text-right">
                    <Geracao usina={usina} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={ROTULO_SITUACAO_MANUTENCAO[usina.situacaoPlano].variant}>
                      {ROTULO_SITUACAO_MANUTENCAO[usina.situacaoPlano].texto}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {usinas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Nenhuma usina em monitoramento. O vínculo com cliente e unidade geradora é
                    feito em Administração → Cadastro de usinas.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* 3. Potência agora vs. esperada ------------------------------------- */}
      {usinas.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">Potência × padrão da usina</h2>
          <p className="text-sm text-muted-foreground">
            O padrão é a <strong>mediana das últimas 7 leituras válidas de meio-dia da própria
            usina</strong> — e não a potência de placa. Sombreamento, inclinação e clima fazem
            duas usinas iguais gerarem diferente todo dia sem que nenhuma tenha problema. Com
            menos de 5 leituras válidas não há padrão confiável, e a comparação não é feita.
          </p>
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usina</TableHead>
                  <TableHead className="text-right">Última potência</TableHead>
                  <TableHead className="text-right">Padrão da usina</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead>Medida em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usinas.map((usina) => (
                  <TableRow key={usina.id}>
                    <TableCell>
                      <Link href={`/monitoramento/${usina.id}`} className="hover:underline">
                        {usina.nome}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      {usina.potenciaKw === null
                        ? <span className="text-muted-foreground">sem dado</span>
                        : `${usina.potenciaKw.toFixed(1)} kW`}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {usina.referencia
                        ? `${usina.referencia.mediana.toFixed(1)} kW`
                        : "sem base ainda"}
                    </TableCell>
                    <TableCell className="text-right">
                      {usina.percentualDaReferencia === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span
                          className={
                            usina.percentualDaReferencia <= 50
                              ? "font-medium text-destructive"
                              : undefined
                          }
                        >
                          {usina.percentualDaReferencia}%
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {/* Fora do horário de sol mostra-se o último meio-dia COM
                          a data, e nunca zero: zero às 19h passaria a impressão
                          de usina parada num dia perfeitamente normal. */}
                      {usina.potenciaDataRef
                        ? `meio-dia de ${formatarData(usina.potenciaDataRef)}`
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * "sem dado" é visualmente diferente de zero de propósito: a coleta que não
 * aconteceu (API fora do ar) não pode ser lida como usina parada.
 */
function Geracao({ usina }: { usina: UsinaDoPainel }) {
  if (usina.energiaHojeKwh === null) {
    return <span className="text-muted-foreground italic">sem dado</span>;
  }
  return (
    <span className={usina.energiaHojeKwh < 1 ? "font-medium text-destructive" : undefined}>
      {usina.energiaHojeKwh.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kWh
    </span>
  );
}
