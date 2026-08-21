import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { formatarData, formatarMoeda } from "@/lib/format";
import { ROTULO_ESTAGIO, ROTULO_TIPO_INTERACAO } from "@/lib/crm";
import { OportunidadeForm } from "@/components/crm/oportunidade-form";
import { excluirProposta } from "@/app/(app)/orcamentos/actions";
import { BotaoExcluir } from "@/components/ui/botao-excluir";
import { Button } from "@/components/ui/button";
import { CampoData } from "@/components/ui/campo-data";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  adicionarInteracao,
  removerInteracao,
  adicionarAnexo,
  removerAnexo,
  excluirOportunidade,
} from "../actions";

export default async function PaginaOportunidade({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { perfil } = await acessoModulo("crm");
  const { id } = await params;

  const { data: oportunidade } = await supabase
    .from("Oportunidade")
    .select(
      "*, cliente:Cliente(id, razaoSocial), orcamento:Orcamento(id, nomeProjeto), responsavel:Usuario(id, nome), interacoes:Interacao(*), anexos:Anexo(*)"
    )
    .eq("id", id)
    .order("data", { referencedTable: "Interacao", ascending: false })
    .maybeSingle();

  if (!oportunidade) notFound();

  const { data: usuarios } = await supabase
    .from("Usuario")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome", { ascending: true });

  const { data: propostas } = await supabase
    .from("Proposta")
    .select("*")
    .eq("orcamentoId", oportunidade.orcamentoId)
    .order("geradoEm", { ascending: false });

  const podeEditar = podeEscrever(perfil, "crm");
  // A proposta é artefato do orçamento: quem apaga é quem tem escrita lá.
  const podeExcluirProposta = podeEscrever(perfil, "orcamentos");
  const adicionarInteracaoComId = adicionarInteracao.bind(null, oportunidade.id);
  const adicionarAnexoComId = adicionarAnexo.bind(null, oportunidade.id);

  return (
    <div className="flex flex-col gap-1">
      <Link href="/crm" className="text-sm text-muted-foreground hover:underline w-fit">
        ← CRM / Propostas
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">{oportunidade.cliente?.razaoSocial}</h2>
        {podeEditar && (
          <div className="ml-auto">
            <BotaoExcluir
              acao={excluirOportunidade}
              campos={{ oportunidadeId: oportunidade.id }}
              rotulo="Excluir do funil"
              titulo="Excluir esta oportunidade?"
              descricao={
                <>
                  As interações e os anexos registrados aqui são apagados junto, sem volta. O
                  orçamento e as propostas emitidas continuam onde estão — sai só o
                  acompanhamento comercial. É também o que destrava a exclusão do cliente.
                </>
              }
            />
          </div>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        <Link href={`/orcamentos/${oportunidade.orcamento?.id}`} className="hover:underline">
          {oportunidade.orcamento?.nomeProjeto}
        </Link>
        {" · "}Criada em {formatarData(oportunidade.criadoEm)}
      </p>

      {podeEditar ? (
        <OportunidadeForm
          oportunidade={{
            id: oportunidade.id,
            estagio: oportunidade.estagio,
            responsavelId: oportunidade.responsavelId,
            valorEstimado: oportunidade.valorEstimado,
            proximaAcaoData: oportunidade.proximaAcaoData,
            motivoPerda: oportunidade.motivoPerda,
          }}
          usuarios={usuarios ?? []}
        />
      ) : (
        <dl className="grid grid-cols-2 gap-3 max-w-2xl text-sm">
          <div>
            <dt className="text-muted-foreground">Estágio</dt>
            <dd><Badge variant="outline">{ROTULO_ESTAGIO[oportunidade.estagio]}</Badge></dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Responsável</dt>
            <dd>{oportunidade.responsavel?.nome ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Valor estimado</dt>
            <dd>{oportunidade.valorEstimado ? formatarMoeda(oportunidade.valorEstimado) : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Próxima ação</dt>
            <dd>{oportunidade.proximaAcaoData ? formatarData(oportunidade.proximaAcaoData) : "—"}</dd>
          </div>
          {oportunidade.motivoPerda && (
            <div className="col-span-2">
              <dt className="text-muted-foreground">Motivo da perda</dt>
              <dd>{oportunidade.motivoPerda}</dd>
            </div>
          )}
        </dl>
      )}

      <Separator className="my-6" />

      <h3 className="font-semibold mb-3">Propostas geradas</h3>
      <div className="rounded-md border bg-card mb-8 max-w-3xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Versão/Revisão</TableHead>
              <TableHead>Valor final</TableHead>
              <TableHead>Gerada em</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(propostas ?? []).map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.numero}/{p.ano}</TableCell>
                <TableCell>v{p.versao} · rev. {p.revisao}</TableCell>
                <TableCell>{formatarMoeda(p.valorFinal)}</TableCell>
                <TableCell>{formatarData(p.geradoEm)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-3">
                    <a href={p.arquivoUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                      Abrir
                    </a>
                    {podeExcluirProposta && (
                      <BotaoExcluir
                        acao={excluirProposta}
                        campos={{ propostaId: p.id }}
                        variant="ghost"
                        titulo={`Excluir a proposta ${p.numero}/${p.ano}?`}
                        descricao={
                          <>
                            Some do histórico de emissões do orçamento, sem volta. O orçamento e
                            esta oportunidade continuam como estão — só esta emissão é apagada.
                          </>
                        }
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(propostas ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                  Nenhuma proposta gerada para este orçamento ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <h3 className="font-semibold mb-3">Interações</h3>
      <div className="flex flex-col gap-3 max-w-3xl mb-4">
        {oportunidade.interacoes.map((i) => (
          <div key={i.id} className="flex items-start justify-between gap-3 rounded-md border bg-card p-3">
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{ROTULO_TIPO_INTERACAO[i.tipo]}</Badge>
                <span>{formatarData(i.data)}</span>
              </div>
              <p className="text-sm mt-1">{i.descricao}</p>
            </div>
            {podeEditar && (
              <form
                action={async () => {
                  "use server";
                  await removerInteracao(oportunidade.id, i.id);
                }}
              >
                <Button type="submit" variant="ghost" size="sm">Remover</Button>
              </form>
            )}
          </div>
        ))}
        {oportunidade.interacoes.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhuma interação registrada.
          </p>
        )}
      </div>

      {podeEditar && (
        <form action={adicionarInteracaoComId} className="grid grid-cols-4 gap-3 max-w-3xl items-end mb-8">
          <Select
            name="tipo"
            defaultValue="ligacao"
            items={[
              { value: "ligacao", label: "Ligação" },
              { value: "email", label: "E-mail" },
              { value: "reuniao", label: "Reunião" },
              { value: "visita", label: "Visita" },
            ]}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ligacao">Ligação</SelectItem>
              <SelectItem value="email">E-mail</SelectItem>
              <SelectItem value="reuniao">Reunião</SelectItem>
              <SelectItem value="visita">Visita</SelectItem>
            </SelectContent>
          </Select>
          <CampoData name="data" required />
          <div className="col-span-2 flex gap-2">
            <Textarea name="descricao" placeholder="Descrição da interação" rows={1} required />
            <Button type="submit" variant="secondary">+ Registrar</Button>
          </div>
        </form>
      )}

      <h3 className="font-semibold mb-3">Anexos</h3>
      <div className="rounded-md border bg-card mb-4 max-w-3xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Enviado em</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {oportunidade.anexos.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {a.nomeArquivo}
                  </a>
                </TableCell>
                <TableCell>{a.tipo ?? "—"}</TableCell>
                <TableCell>{formatarData(a.criadoEm)}</TableCell>
                {podeEditar && (
                  <TableCell className="text-right">
                    <form
                      action={async () => {
                        "use server";
                        await removerAnexo(oportunidade.id, a.id);
                      }}
                    >
                      <Button type="submit" variant="ghost" size="sm">Remover</Button>
                    </form>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {oportunidade.anexos.length === 0 && (
              <TableRow>
                <TableCell colSpan={podeEditar ? 4 : 3} className="text-center text-muted-foreground py-6">
                  Nenhum anexo cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {podeEditar && (
        <form action={adicionarAnexoComId} className="grid grid-cols-4 gap-3 max-w-3xl items-end mb-8">
          <Input name="nomeArquivo" placeholder="Nome do arquivo" required />
          <Input name="url" placeholder="URL (https://...)" required />
          <Input name="tipo" placeholder="Tipo (opcional)" />
          <Button type="submit" variant="secondary">+ Anexar</Button>
        </form>
      )}
    </div>
  );
}
