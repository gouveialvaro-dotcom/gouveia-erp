import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { contextoSuprimentos, parametrosSuprimentos } from "@/lib/suprimentos-auth";
import { carregarCotacoes } from "@/lib/suprimentos-cotacao-dados";
import {
  STATUS_CANCELAVEL_COMPRADOR,
  STATUS_CANCELAVEL_REQUISITANTE,
  STATUS_COTACAO_ABERTA,
  PAPEL_DO_NIVEL,
  codigoRequisicao,
  niveisExigidos,
} from "@/lib/suprimentos";
import { formatarData, formatarDataHora } from "@/lib/format";
import { BadgeStatusRequisicao, BadgeUrgencia } from "@/components/suprimentos/status-requisicao";
import { CancelarRequisicao } from "@/components/suprimentos/cancelar-requisicao";
import { AlertaMinimoCotacoes } from "@/components/suprimentos/alerta-cotacoes";
import { MatrizCotacao } from "@/components/suprimentos/matriz-cotacao";
import { HistoricoAprovacoes } from "@/components/suprimentos/historico-aprovacoes";
import { PainelDecisao } from "@/components/suprimentos/painel-decisao";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function Dado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{rotulo}</span>
      <span className="text-sm">{children}</span>
    </div>
  );
}

export default async function PaginaRequisicao({ params }: { params: Promise<{ id: string }> }) {
  const contexto = await contextoSuprimentos();
  const { id } = await params;

  const { data: r } = await supabase
    .from("Requisicao")
    .select(
      `*,
       obra:Obra(nomeProjeto, cliente:Cliente(razaoSocial)),
       requisitante:Usuario!Requisicao_requisitanteId_fkey(nome),
       comprador:Usuario!Requisicao_compradorId_fkey(nome),
       canceladaPor:Usuario!Requisicao_canceladaPorId_fkey(nome),
       itens:RequisicaoItem(id, ordem, descricao, quantidade, unidade, especificacao, produto:Produto(descricao, unidade))`
    )
    .eq("id", id)
    .maybeSingle();

  // Requisição de outra pessoa é "não encontrada" para quem não trabalha o
  // fluxo — não confirma nem que o número existe.
  if (!r || (!contexto.veTodasRequisicoes && r.requisitanteId !== contexto.usuarioId)) notFound();

  const codigo = codigoRequisicao(r.numero);
  const itens = [...r.itens].sort((a, b) => a.ordem - b.ordem);
  const ehRequisitante = r.requisitanteId === contexto.usuarioId;
  const ehComprador = contexto.tem("comprador");
  const cotacaoAberta = STATUS_COTACAO_ABERTA.includes(r.status);
  const [{ itens: itensCotacao, cotacoes, escolhas }, parametros, { data: aprovacoesBrutas }] = await Promise.all([
    carregarCotacoes(r.id),
    parametrosSuprimentos(),
    supabase
      .from("Aprovacao")
      .select("*, aprovador:Usuario!Aprovacao_aprovadorId_fkey(nome)")
      .eq("requisicaoId", r.id),
  ]);
  const aprovacoes = (aprovacoesBrutas ?? []).map((a) => ({
    ...a,
    valorTotal: Number(a.valorTotal),
    aprovador: a.aprovador?.nome ?? "—",
  }));

  // Quem ainda falta decidir nesta rodada, e se o usuário é um deles.
  const daRodada = aprovacoes.filter((a) => a.rodada === r.rodadaAprovacao);
  const aguardando =
    r.status === "aguardando_aprovacao"
      ? niveisExigidos(r.nivelAlcada).filter((n) => !daRodada.some((a) => a.nivel === n))
      : [];
  const jaDecidiu = daRodada.some((a) => a.aprovadorId === contexto.usuarioId);
  const meuNivel = jaDecidiu
    ? undefined
    : aguardando.find(
        (n): n is "gerencia" | "diretoria" => n !== "comprador" && contexto.tem(PAPEL_DO_NIVEL[n])
      );
  const podeCancelar =
    (contexto.tem("comprador") && STATUS_CANCELAVEL_COMPRADOR.includes(r.status)) ||
    (ehRequisitante && STATUS_CANCELAVEL_REQUISITANTE.includes(r.status));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold font-mono">{codigo}</h2>
            <BadgeStatusRequisicao status={r.status} />
            <BadgeUrgencia urgencia={r.urgencia} />
          </div>
          <Link href="/suprimentos/requisicoes" className="text-xs text-muted-foreground hover:underline">
            ← Requisições
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ehComprador && r.status !== "cancelada" && (
            <Button
              size="sm"
              render={<Link href={`/suprimentos/requisicoes/${r.id}/cotacao`} />}
              nativeButton={false}
            >
              {r.status === "pendente" ? "Iniciar cotação" : cotacaoAberta ? "Abrir cotação" : "Ver cotação"}
            </Button>
          )}
          {podeCancelar && <CancelarRequisicao requisicaoId={r.id} codigo={codigo} />}
        </div>
      </div>

      {r.status === "cancelada" && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          Cancelada por {r.canceladaPor?.nome ?? "—"}
          {r.canceladaEm ? ` em ${formatarDataHora(r.canceladaEm)}` : ""}.
          {r.motivoCancelamento && <span className="block mt-1">Motivo: {r.motivoCancelamento}</span>}
        </div>
      )}

      <div className="grid gap-4 rounded-md border bg-card p-4 sm:grid-cols-3">
        <Dado rotulo="Obra">
          {r.obra?.nomeProjeto ?? "—"}
          {r.obra?.cliente?.razaoSocial && (
            <span className="block text-xs text-muted-foreground">{r.obra.cliente.razaoSocial}</span>
          )}
        </Dado>
        <Dado rotulo="Requisitante">{r.requisitante?.nome ?? "—"}</Dado>
        <Dado rotulo="Comprador">{r.comprador?.nome ?? "Ainda não assumida"}</Dado>
        <Dado rotulo="Solicitada em">{formatarData(r.dataSolicitacao)}</Dado>
        <Dado rotulo="Entregar até">{formatarData(r.prazoDesejado)}</Dado>
        {r.valorTotal !== null && (
          <Dado rotulo={r.status === "aguardando_aprovacao" ? "Valor para aprovação" : "Valor da compra"}>
            {Number(r.valorTotal).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </Dado>
        )}
        {r.observacoes && (
          <div className="sm:col-span-3">
            <Dado rotulo="Observações">
              <span className="whitespace-pre-line">{r.observacoes}</span>
            </Dado>
          </div>
        )}
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Itens</h3>
        <div className="rounded-md border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Qtd.</TableHead>
                <TableHead>Un.</TableHead>
                <TableHead>Produto no catálogo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-muted-foreground">{item.ordem}</TableCell>
                  <TableCell className="whitespace-normal">
                    <span className="font-medium">{item.descricao}</span>
                    {item.especificacao && (
                      <span className="block text-xs text-muted-foreground whitespace-pre-line">
                        {item.especificacao}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {Number(item.quantidade).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell>{item.unidade}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-normal">
                    {item.produto?.descricao ?? "A vincular pelo comprador"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {meuNivel && r.valorTotal !== null && (
        <PainelDecisao
          requisicaoId={r.id}
          nivel={meuNivel}
          valorTotal={Number(r.valorTotal)}
          proprioRequisitante={ehRequisitante}
          outroNivelPendente={
            (aguardando.find((n) => n !== meuNivel) as "gerencia" | "diretoria" | undefined) ?? null
          }
        />
      )}

      <HistoricoAprovacoes aprovacoes={aprovacoes} aguardando={aguardando} />

      {cotacoes.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Cotações ({cotacoes.length})</h3>
          <AlertaMinimoCotacoes
            quantidade={cotacoes.length}
            minimo={parametros.minimoCotacoes}
            paraRequisitante={!ehComprador}
          />
          {cotacaoAberta && (
            <p className="text-xs text-muted-foreground">Cotação em andamento — os valores ainda podem mudar.</p>
          )}
          <MatrizCotacao
            requisicaoId={r.id}
            itens={itensCotacao}
            cotacoes={cotacoes}
            escolhasIniciais={escolhas}
            limites={parametros}
            editavel={false}
          />
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        Criada em {formatarDataHora(r.criadoEm)}
        {ehRequisitante ? " por você" : ""}.
      </p>
    </div>
  );
}
