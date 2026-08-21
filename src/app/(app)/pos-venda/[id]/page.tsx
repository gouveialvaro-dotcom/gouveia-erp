import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { clienteIdDaObra, projetoDaObra } from "@/lib/obras";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { formatarData } from "@/lib/format";
import {
  MESES_JANELA_RECORRENCIA,
  MIN_OCORRENCIAS_RECORRENCIA,
  ROTULO_COLUNA,
  ROTULO_DIRECAO,
  ROTULO_ESTAGIO,
  ROTULO_PRIORIDADE,
  ROTULO_TIPO_INTERACAO,
  ROTULO_TIPO_UC,
  colunaDoChamado,
  diferencaEmDias,
  hojeIso,
  mesesAtras,
  textoPrazo,
} from "@/lib/pos-venda";
import {
  ROTULO_RAMO,
  ROTULO_SITUACAO_MANUTENCAO,
  situacaoManutencao,
  vigenciaManutencao,
} from "@/lib/clientes";
import { Badge } from "@/components/ui/badge";
import { BotaoExcluir } from "@/components/ui/botao-excluir";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CampoData } from "@/components/ui/campo-data";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { SelectNativo } from "@/components/ui/select-nativo";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChamadoEditarForm } from "@/components/pos-venda/chamado-editar-form";
import { AnexoUpload } from "@/components/pos-venda/anexo-upload";
import { MarcarLido } from "@/components/pos-venda/marcar-lido";
import { adicionarInteracao, excluirChamado, removerInteracao, removerAnexo } from "../actions";

const SELECT_CHAMADO =
  "*, cliente:Cliente(id, razaoSocial, ramo, cnpj, contato, telefone, email, endereco, observacoes, manutencaoInicio, manutencaoFim), tipo:TipoProblemaPosVenda(id, nome, descricao, prazoDias, diasAlerta), responsavel:Usuario!Chamado_responsavelId_fkey(id, nome), uc:UnidadeConsumidora(id, numero, apelido, endereco, tipo, percentualRateio, titular, potenciaKwp, geradoraId, concessionaria:Concessionaria(id, nome, sigla)), obra:Obra(id, status, avancoFisicoPercent, nomeProjeto, oportunidade:Oportunidade(orcamento:Orcamento(nomeProjeto))), interacoes:InteracaoChamado(*, responsavel:Usuario(id, nome)), anexos:AnexoChamado(*)";

function formatarTamanho(bytes: number | null) {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function PaginaChamado({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { perfil } = await acessoModulo("posVenda");
  const { id } = await params;
  const hoje = hojeIso();

  const { data: chamado } = await supabase
    .from("Chamado")
    .select(SELECT_CHAMADO)
    .eq("id", id)
    .order("data", { referencedTable: "InteracaoChamado", ascending: false })
    .order("criadoEm", { referencedTable: "AnexoChamado", ascending: false })
    .maybeSingle();

  if (!chamado) notFound();

  const podeEditar = podeEscrever(perfil, "posVenda");
  const diasAlerta = chamado.tipo?.diasAlerta ?? 0;
  const coluna = colunaDoChamado(
    { estagio: chamado.estagio, prazoLimite: chamado.prazoLimite },
    diasAlerta,
    hoje
  );
  const vencido = coluna === "vencido";
  const prioridade = ROTULO_PRIORIDADE[chamado.prioridade];

  const [
    { data: unidades },
    { data: obras },
    { data: tipos },
    { data: usuarios },
    { data: geradora },
    { count: ocorrencias },
  ] = await Promise.all([
    supabase
      .from("UnidadeConsumidora")
      .select("id, clienteId, numero, apelido, tipo, concessionaria:Concessionaria(sigla, nome)")
      .eq("clienteId", chamado.clienteId)
      .order("numero"),
    supabase
      .from("Obra")
      // Sem !inner: a obra manual não tem oportunidade e sumiria do seletor.
      // O filtro por cliente passa a ser em memória — são poucas obras, e o
      // cliente mora em lugares diferentes conforme a origem.
      .select(
        "id, clienteId, nomeProjeto, oportunidade:Oportunidade(clienteId, orcamento:Orcamento(nomeProjeto))"
      ),
    supabase
      .from("TipoProblemaPosVenda")
      .select("id, nome, prazoDias")
      .eq("ativo", true)
      .order("ordem"),
    supabase.from("Usuario").select("id, nome").eq("ativo", true).order("nome"),
    chamado.uc?.geradoraId
      ? supabase
          .from("UnidadeConsumidora")
          .select("id, numero, apelido")
          .eq("id", chamado.uc.geradoraId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("Chamado")
      .select("id", { count: "exact", head: true })
      .eq("clienteId", chamado.clienteId)
      .eq("tipoProblemaId", chamado.tipoProblemaId)
      .gte("abertoEm", mesesAtras(MESES_JANELA_RECORRENCIA, hoje)),
  ]);

  const recorrente = (ocorrencias ?? 0) >= MIN_OCORRENCIAS_RECORRENCIA;
  // Situação do contrato de manutenção do cliente hoje — é o que autoriza (ou
  // não) novos chamados deste cliente.
  const situacaoCliente = chamado.cliente
    ? ROTULO_SITUACAO_MANUTENCAO[situacaoManutencao(chamado.cliente, hoje)]
    : null;
  const vigenciaCliente = chamado.cliente ? vigenciaManutencao(chamado.cliente) : null;
  const diasEmAberto = diferencaEmDias(chamado.abertoEm, chamado.concluidoEm ?? hoje);
  const adicionarInteracaoComId = adicionarInteracao.bind(null, chamado.id);

  const opcoesUnidades = (unidades ?? []).map((u) => ({
    id: u.id,
    clienteId: u.clienteId,
    rotulo: `${u.numero}${u.apelido ? ` — ${u.apelido}` : ""} · ${
      u.concessionaria?.sigla ?? u.concessionaria?.nome ?? "—"
    }`,
  }));
  const opcoesObras = (obras ?? [])
    .filter((o) => clienteIdDaObra(o) === chamado.clienteId)
    .map((o) => ({ id: o.id, clienteId: chamado.clienteId, rotulo: projetoDaObra(o) }));

  return (
    <div className="flex flex-col gap-1">
      {/* Abrir o chamado dá baixa nos avisos dele para este usuário. */}
      <MarcarLido chamadoId={chamado.id} />
      <Link href="/pos-venda" className="text-sm text-muted-foreground hover:underline w-fit">
        ← Pós-venda
      </Link>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">
          #{chamado.numero} · {chamado.titulo}
        </h2>
        <Badge variant={vencido ? "destructive" : "outline"}>{ROTULO_COLUNA[coluna]}</Badge>
        <Badge variant={prioridade.variant}>{prioridade.texto}</Badge>
        {recorrente && <Badge variant="destructive">Recorrente</Badge>}
        {podeEditar && (
          <div className="ml-auto">
            <BotaoExcluir
              acao={excluirChamado}
              campos={{ chamadoId: chamado.id }}
              rotulo="Excluir chamado"
              titulo={`Excluir o chamado #${chamado.numero}?`}
              descricao={
                <>
                  A linha do tempo, os anexos e os avisos deste chamado são apagados junto, sem
                  volta. O chamado sai do histórico do cliente — o que também apaga o sinal de
                  reincidência que ele representa.
                </>
              }
            />
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        <Link href={`/cadastros/clientes/${chamado.cliente?.id}`} className="hover:underline">
          {chamado.cliente?.razaoSocial}
        </Link>
        {chamado.cliente?.contato && ` · ${chamado.cliente.contato}`}
        {chamado.cliente?.telefone && ` · ${chamado.cliente.telefone}`}
        {" · "}Aberto em {formatarData(chamado.abertoEm)} por{" "}
        {chamado.responsavel?.nome ?? "—"}
      </p>

      {recorrente && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <strong>Caso recorrente.</strong> Este cliente já registrou {ocorrencias} chamados de{" "}
          &quot;{chamado.tipo?.nome}&quot; nos últimos {MESES_JANELA_RECORRENCIA} meses. Trate a
          causa na instalação em vez de abrir mais um atendimento —{" "}
          <Link
            href={`/pos-venda?cliente=${chamado.clienteId}&tipo=${chamado.tipoProblemaId}`}
            className="underline"
          >
            ver o histórico
          </Link>
          .
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">SLA</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <p className="text-muted-foreground">{chamado.tipo?.nome}</p>
            <p>
              Prazo de {chamado.tipo?.prazoDias} dias corridos → vence em{" "}
              <strong>{formatarData(chamado.prazoLimite)}</strong>
            </p>
            <p className={vencido ? "text-destructive font-medium" : undefined}>
              {chamado.estagio === "concluido"
                ? `Concluído em ${formatarData(chamado.concluidoEm ?? chamado.abertoEm)} · ${diasEmAberto} dia(s) até a solução`
                : `${textoPrazo({ estagio: chamado.estagio, prazoLimite: chamado.prazoLimite }, hoje)} · ${diasEmAberto} dia(s) em aberto`}
            </p>
            {chamado.protocoloConcessionaria && (
              <p className="text-xs">
                Protocolo: <strong>{chamado.protocoloConcessionaria}</strong>
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Cadastro do cliente</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <p className="font-medium">
              <Link
                href={`/cadastros/clientes/${chamado.cliente?.id}`}
                className="hover:underline"
              >
                {chamado.cliente?.razaoSocial}
              </Link>
            </p>
            <p className="text-muted-foreground">
              {ROTULO_RAMO[chamado.cliente?.ramo ?? "energia_solar"]} · {chamado.cliente?.cnpj}
            </p>
            <p>Contato: {chamado.cliente?.contato ?? "—"}</p>
            <p>Telefone: {chamado.cliente?.telefone ?? "—"}</p>
            <p>E-mail: {chamado.cliente?.email ?? "—"}</p>
            {situacaoCliente && (
              <p className="flex flex-wrap items-center gap-2">
                <Badge variant={situacaoCliente.variant}>{situacaoCliente.texto}</Badge>
                {vigenciaCliente && (
                  <span className="text-xs text-muted-foreground">{vigenciaCliente}</span>
                )}
              </p>
            )}
            {chamado.cliente?.observacoes && (
              <p className="text-xs text-muted-foreground whitespace-pre-line">
                {chamado.cliente.observacoes}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Unidade consumidora</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            {chamado.uc ? (
              <>
                <p className="font-medium">
                  UC {chamado.uc.numero}
                  {chamado.uc.apelido && ` — ${chamado.uc.apelido}`}
                </p>
                <p className="text-muted-foreground">
                  {chamado.uc.concessionaria?.nome ?? "sem concessionária"} ·{" "}
                  {ROTULO_TIPO_UC[chamado.uc.tipo]}
                </p>
                {chamado.uc.endereco && <p>{chamado.uc.endereco}</p>}
                {chamado.uc.potenciaKwp && <p>{chamado.uc.potenciaKwp} kWp</p>}
                {chamado.uc.tipo === "beneficiaria" && (
                  <p>
                    Rateio de {chamado.uc.percentualRateio ?? "—"}%
                    {geradora && ` da UC ${geradora.numero}`}
                  </p>
                )}
                {chamado.uc.titular && (
                  <p className="text-xs text-muted-foreground">
                    Titular: {chamado.uc.titular}
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">
                Nenhuma UC vinculada. Sem ela não dá para cruzar o problema com o
                faturamento nem detectar reincidência na instalação.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Obra de origem</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            {chamado.obra ? (
              <>
                <Link href={`/obras/${chamado.obra.id}`} className="font-medium hover:underline">
                  {projetoDaObra(chamado.obra)}
                </Link>
                <p className="text-muted-foreground">
                  {chamado.obra.status} · {chamado.obra.avancoFisicoPercent}% executado
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">Nenhuma obra vinculada.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {chamado.descricao && (
        <>
          <h3 className="font-semibold mb-2">Relato</h3>
          <p className="text-sm whitespace-pre-wrap max-w-3xl mb-6">{chamado.descricao}</p>
        </>
      )}

      {podeEditar ? (
        <ChamadoEditarForm
          // Registrar uma interação com protocolo grava direto no chamado. Sem
          // remontar, os campos não controlados ficariam com o valor antigo e o
          // Base UI reclama da troca de defaultValue.
          key={`${chamado.atualizadoEm}|${chamado.protocoloConcessionaria ?? ""}`}
          chamado={{
            id: chamado.id,
            estagio: chamado.estagio,
            tipoProblemaId: chamado.tipoProblemaId,
            responsavelId: chamado.responsavelId,
            prioridade: chamado.prioridade,
            unidadeConsumidoraId: chamado.unidadeConsumidoraId,
            obraId: chamado.obraId,
            abertoEm: chamado.abertoEm,
            prazoLimite: chamado.prazoLimite,
            protocoloConcessionaria: chamado.protocoloConcessionaria,
            solucao: chamado.solucao,
          }}
          unidades={opcoesUnidades}
          obras={opcoesObras}
          tipos={tipos ?? []}
          usuarios={usuarios ?? []}
        />
      ) : (
        <dl className="grid grid-cols-2 gap-3 max-w-2xl text-sm">
          <div>
            <dt className="text-muted-foreground">Estágio</dt>
            <dd>
              <Badge variant="outline">{ROTULO_ESTAGIO[chamado.estagio]}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Responsável</dt>
            <dd>{chamado.responsavel?.nome ?? "—"}</dd>
          </div>
          {chamado.solucao && (
            <div className="col-span-2">
              <dt className="text-muted-foreground">Solução</dt>
              <dd className="whitespace-pre-wrap">{chamado.solucao}</dd>
            </div>
          )}
        </dl>
      )}

      <Separator className="my-6" />

      <h3 className="font-semibold mb-3">Linha do tempo</h3>
      <div className="flex flex-col gap-3 max-w-3xl mb-4">
        {chamado.interacoes.map((i) => (
          <div
            key={i.id}
            className="flex items-start justify-between gap-3 rounded-md border bg-card p-3"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{ROTULO_TIPO_INTERACAO[i.tipo]}</Badge>
                <Badge variant={i.direcao === "concessionaria" ? "secondary" : "ghost"}>
                  {ROTULO_DIRECAO[i.direcao]}
                </Badge>
                <span>{formatarData(i.data)}</span>
                <span>· {i.responsavel?.nome ?? "—"}</span>
                {i.protocolo && <span>· protocolo {i.protocolo}</span>}
              </div>
              <p className="text-sm mt-1 whitespace-pre-wrap">{i.descricao}</p>
            </div>
            {podeEditar && (
              <form action={removerInteracao.bind(null, chamado.id, i.id)}>
                <Button type="submit" variant="ghost" size="sm">
                  Remover
                </Button>
              </form>
            )}
          </div>
        ))}
        {chamado.interacoes.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhuma interação registrada.
          </p>
        )}
      </div>

      {podeEditar && (
        <form
          action={adicionarInteracaoComId}
          className="grid grid-cols-4 gap-3 max-w-3xl items-end mb-8"
        >
          <SelectNativo name="tipo" defaultValue="ligacao" aria-label="Tipo de interação">
            {Object.entries(ROTULO_TIPO_INTERACAO).map(([valor, texto]) => (
              <option key={valor} value={valor}>
                {texto}
              </option>
            ))}
          </SelectNativo>
          <SelectNativo name="direcao" defaultValue="cliente" aria-label="Com quem">
            {Object.entries(ROTULO_DIRECAO).map(([valor, texto]) => (
              <option key={valor} value={valor}>
                {texto}
              </option>
            ))}
          </SelectNativo>
          <CampoData name="data" defaultValue={hoje} required />
          <Input name="protocolo" placeholder="Protocolo (opcional)" />
          <div className="col-span-4 flex gap-2">
            <Textarea
              name="descricao"
              placeholder="O que foi tratado com o cliente ou com a concessionária"
              rows={2}
              required
            />
            <Button type="submit" variant="secondary">
              + Registrar
            </Button>
          </div>
        </form>
      )}

      <h3 className="font-semibold mb-3">Anexos</h3>
      <div className="rounded-md border bg-card mb-4 max-w-3xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Arquivo</TableHead>
              <TableHead>Tamanho</TableHead>
              <TableHead>Enviado em</TableHead>
              {podeEditar && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {chamado.anexos.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">
                  <a
                    href={`/api/pos-venda/anexos/${a.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {a.nomeArquivo}
                  </a>
                </TableCell>
                <TableCell>{formatarTamanho(a.tamanho)}</TableCell>
                <TableCell>{formatarData(a.criadoEm)}</TableCell>
                {podeEditar && (
                  <TableCell className="text-right">
                    <form action={removerAnexo.bind(null, chamado.id, a.id)}>
                      <Button type="submit" variant="ghost" size="sm">
                        Remover
                      </Button>
                    </form>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {chamado.anexos.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={podeEditar ? 4 : 3}
                  className="text-center text-muted-foreground py-6"
                >
                  Nenhum anexo enviado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {podeEditar && <AnexoUpload chamadoId={chamado.id} />}
      <div className="mb-8" />
    </div>
  );
}
