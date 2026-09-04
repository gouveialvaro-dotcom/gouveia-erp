import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { reconciliarConversasSemCliente } from "@/lib/whatsapp-cadastro";
import { acessoModulo } from "@/lib/pagina-auth";
import { exigirPermissao } from "@/lib/api-auth";
import { podeEscrever, type Perfil } from "@/lib/permissoes";
import { formatarData } from "@/lib/format";
import { ROTULO_COLUNA, colunaDoChamado, hojeIso, textoPrazo } from "@/lib/pos-venda";
import {
  ROTULO_SITUACAO_MANUTENCAO,
  situacaoManutencao,
  vigenciaManutencao,
} from "@/lib/clientes";
import {
  CAIXAS,
  ROTULO_CAIXA,
  caixaMostraArquivadas,
  caixaValida,
  chamadoCorrente,
  chaveTelefone,
  ehEnvioAtivo,
  diaBrasilia,
  formatarDataHoraBrasilia,
  formatarHoraBrasilia,
  formatarTamanho,
  formatarTelefone,
  tempoEspera,
  type Caixa,
} from "@/lib/pos-venda-whatsapp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AncoraMensagem } from "@/components/pos-venda/whatsapp/ancora-mensagem";
import { AtribuirConversas } from "@/components/pos-venda/whatsapp/atribuir-conversas";
import { AtualizacaoAutomatica } from "@/components/pos-venda/whatsapp/atualizacao-automatica";
import { BuscaConversas } from "@/components/pos-venda/whatsapp/busca-conversas";
import { BotaoOcultar } from "@/components/pos-venda/whatsapp/botao-ocultar";
import { BotaoPromover } from "@/components/pos-venda/whatsapp/botao-promover";
import { FaixaChamado } from "@/components/pos-venda/whatsapp/faixa-chamado";
import { FormEnvio } from "@/components/pos-venda/whatsapp/form-envio";
import { IniciarConversa } from "@/components/pos-venda/whatsapp/iniciar-conversa";
import { VinculoCliente } from "@/components/pos-venda/whatsapp/vinculo-cliente";
import { arquivarConversa, assumirConversa, marcarPendencia, reabrirConversa } from "./actions";

const SELECT_CONVERSA =
  "id, telefone, telefoneExibicao, nomePerfil, clienteId, donoId, pendente, ultimaMensagemEm, ultimaMensagemDirecao, chamadoAtivoId, arquivadaEm, cliente:Cliente(id, razaoSocial), dono:Usuario!ConversaWhatsapp_donoId_fkey(id, nome), chamadoAtivo:Chamado(id, numero, titulo, estagio)";

type Busca = {
  caixa?: string;
  conversa?: string;
  ocultas?: string;
  q?: string;
  de?: string;
  ate?: string;
  msg?: string;
};

export default async function PaginaWhatsapp({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  const { perfil, nivel } = await acessoModulo("posVenda");

  // acessoModulo devolve o nível, mas não barra sozinho: sem este teste o perfil
  // "obra", que tem acesso "nenhum" a posVenda, abriria a página digitando a
  // URL. Esconder o item da sidebar não substitui o bloqueio no servidor.
  if (nivel === "nenhum") notFound();

  // O id do JWT pode estar órfão (ver resolverUsuarioId em lib/api-auth). As
  // ações gravam o id conferido no banco, então o filtro "Minhas" tem de
  // comparar com o mesmo id — senão a conversa que a pessoa acabou de assumir
  // não apareceria para ela.
  const { usuarioId } = await exigirPermissao("posVenda", "leitura");

  const busca = await searchParams;
  const caixa = caixaValida(busca.caixa);
  const podeEditar = podeEscrever(perfil, "posVenda");
  const ehAdmin = perfil === "admin";
  const mostrarOcultas = ehAdmin && busca.ocultas === "1";
  const hoje = hojeIso();

  // Cadastrar telefone na ficha do cliente não é evento do módulo de WhatsApp,
  // então não há escrita aqui para reagir a ele: as conversas órfãs são
  // reconciliadas quando alguém abre a página, mesmo desenho de
  // sincronizarVencidos. Só preenche o que está nulo.
  await reconciliarConversasSemCliente();

  const { data: conversasData } = await supabase
    .from("ConversaWhatsapp")
    .select(SELECT_CONVERSA)
    .order("ultimaMensagemEm", { ascending: false, nullsFirst: false });

  const conversas = conversasData ?? [];

  // Arquivada não conta em nenhuma caixa de trabalho — nem em "Todas", que
  // significa "todas as ativas".
  const ativas = conversas.filter((c) => c.arquivadaEm === null);

  const contadores: Record<Caixa, number> = {
    pendentes: ativas.filter((c) => c.pendente).length,
    minhas: ativas.filter((c) => c.donoId === usuarioId).length,
    sem_dono: ativas.filter((c) => c.donoId === null).length,
    sem_cliente: ativas.filter((c) => c.clienteId === null).length,
    todas: ativas.length,
    arquivadas: conversas.length - ativas.length,
  };

  const daCaixa = (caixaMostraArquivadas(caixa) ? conversas : ativas).filter((c) => {
    if (caixa === "arquivadas") return c.arquivadaEm !== null;
    if (caixa === "pendentes") return c.pendente;
    if (caixa === "minhas") return c.donoId === usuarioId;
    if (caixa === "sem_dono") return c.donoId === null;
    if (caixa === "sem_cliente") return c.clienteId === null;
    return true;
  });

  // Na fila de pendentes quem espera há mais tempo vem primeiro; nas demais, a
  // conversa mais recente.
  const lista =
    caixa === "pendentes"
      ? [...daCaixa].sort((a, b) => (a.ultimaMensagemEm ?? "").localeCompare(b.ultimaMensagemEm ?? ""))
      : daCaixa;

  // A busca alcança conversa arquivada e mensagem antiga — é o único lugar da
  // tela onde o que foi arquivado reaparece sem precisar trocar de caixa.
  const termo = (busca.q ?? "").trim();
  const chaveBuscada = chaveTelefone(termo);
  const buscando = Boolean(termo || busca.de || busca.ate);

  const porCliente = buscando
    ? conversas.filter((c) => {
        const casaTexto =
          !termo ||
          (c.cliente?.razaoSocial ?? "").toLowerCase().includes(termo.toLowerCase()) ||
          c.telefoneExibicao.includes(termo) ||
          (chaveBuscada !== null && c.telefone === chaveBuscada);
        const casaDe = !busca.de || (c.ultimaMensagemEm ?? "") >= busca.de;
        const casaAte = !busca.ate || (c.ultimaMensagemEm ?? "") <= `${busca.ate}T23:59:59Z`;
        return casaTexto && casaDe && casaAte;
      })
    : [];

  let porMensagem: {
    id: string;
    conversaId: string;
    conteudo: string | null;
    recebidoEm: string;
  }[] = [];

  if (termo) {
    let consulta = supabase
      .from("MensagemWhatsapp")
      .select("id, conversaId, conteudo, recebidoEm")
      .is("ocultaEm", null)
      .order("recebidoEm", { ascending: false })
      .limit(30);

    // websearch aceita a sintaxe que a pessoa já conhece de buscador (aspas,
    // "ou", exclusão com -), em vez de exigir operadores de tsquery.
    consulta = consulta.textSearch("busca", termo, {
      type: "websearch",
      config: "portuguese",
    });
    if (busca.de) consulta = consulta.gte("recebidoEm", busca.de);
    if (busca.ate) consulta = consulta.lte("recebidoEm", `${busca.ate}T23:59:59Z`);

    porMensagem = (await consulta).data ?? [];
  }

  const totalResultados = buscando ? porCliente.length + porMensagem.length : null;
  const porId = new Map(conversas.map((c) => [c.id, c]));

  const selecionada =
    conversas.find((c) => c.id === busca.conversa) ??
    (buscando ? (porCliente[0] ?? porId.get(porMensagem[0]?.conversaId ?? "") ?? null) : null) ??
    lista[0] ??
    null;

  const [
    { data: mensagensData },
    { data: clientesData },
    { data: contatosData },
    { data: chamadosData },
    { data: clienteDetalhe },
  ] = await Promise.all([
    selecionada
      ? supabase
          .from("MensagemWhatsapp")
          .select("*, autor:Usuario!MensagemWhatsapp_enviadoPorId_fkey(id, nome), chamado:Chamado(id, numero)")
          .eq("conversaId", selecionada.id)
          .order("recebidoEm")
      : Promise.resolve({ data: [] }),
    // Todos os ramos, de propósito: a conversa existe independentemente de ramo
    // e de plano de manutenção. O bloqueio de impedimentoDeAbertura continua
    // valendo só na abertura do chamado, na tela que já existe.
    supabase.from("Cliente").select("id, razaoSocial").order("razaoSocial"),
    supabase.from("ContatoCliente").select("id, clienteId, nome, telefone").order("nome"),
    selecionada?.clienteId
      ? supabase
          .from("Chamado")
          .select("id, numero, titulo, estagio, prazoLimite, tipo:TipoProblemaPosVenda(nome, diasAlerta)")
          .eq("clienteId", selecionada.clienteId)
          .neq("estagio", "concluido")
          .order("numero", { ascending: false })
      : Promise.resolve({ data: [] }),
    selecionada?.clienteId
      ? supabase
          .from("Cliente")
          .select("id, razaoSocial, ramo, cnpj, contato, telefone, email, manutencaoInicio, manutencaoFim")
          .eq("id", selecionada.clienteId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const todasMensagens = mensagensData ?? [];
  const ocultas = todasMensagens.filter((m) => m.ocultaEm !== null).length;
  const mensagens = mostrarOcultas
    ? todasMensagens
    : todasMensagens.filter((m) => m.ocultaEm === null);
  const chamadosAbertos = chamadosData ?? [];
  const chamadoAtivo = selecionada
    ? chamadoCorrente(selecionada, selecionada.chamadoAtivo)
      ? selecionada.chamadoAtivo
      : null
    : null;

  // Só quem tem escrita em posVenda pode ser dono: atribuir a quem não responde
  // deixaria a conversa parada COM dono, que é pior que sem — ela sai da caixa
  // "Sem dono" e ninguém mais olha. A action recusa de novo no servidor.
  const { data: usuariosAtivos } = ehAdmin
    ? await supabase.from("Usuario").select("id, nome, perfil").eq("ativo", true).order("nome")
    : { data: [] };

  const atendentes = (usuariosAtivos ?? [])
    .filter((u) => podeEscrever(u.perfil as Perfil, "posVenda"))
    .map((u) => ({ id: u.id, nome: u.nome }));

  // Teto de envio ativo do dia. O recorte é o dia em Brasília, não em UTC:
  // depois das 21h a virada de dia em UTC zeraria a contagem no meio do
  // expediente seguinte.
  const inicioDoDia = `${new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Sao_Paulo",
  })}T00:00:00-03:00`;

  const [{ data: parametros }, { count: iniciadasHoje }] = await Promise.all([
    supabase.from("ParametroGeral").select("tetoDiarioConversasNovas").limit(1).maybeSingle(),
    supabase
      .from("ConversaWhatsapp")
      .select("id", { count: "exact", head: true })
      .gte("iniciadaAtivamenteEm", inicioDoDia),
  ]);

  // Última mensagem RECEBIDA da conversa aberta: é o que define se responder
  // ainda é resposta ou já é abordagem ativa.
  const ultimaEntrada = mensagens.filter((m) => m.direcao === "entrada").at(-1);

  const situacao = clienteDetalhe
    ? ROTULO_SITUACAO_MANUTENCAO[situacaoManutencao(clienteDetalhe, hoje)]
    : null;

  function linkCaixa(destino: Caixa) {
    return `/pos-venda/whatsapp?caixa=${destino}`;
  }

  function linkConversa(id: string) {
    return `/pos-venda/whatsapp?caixa=${caixa}&conversa=${id}`;
  }

  function linkOcultas(ligar: boolean) {
    const base = `/pos-venda/whatsapp?caixa=${caixa}`;
    const comConversa = selecionada ? `${base}&conversa=${selecionada.id}` : base;
    return ligar ? `${comConversa}&ocultas=1` : comConversa;
  }

  // Separador de dia calculado antes da renderização: comparar com o item
  // anterior dentro do map exigiria uma variável mutável atravessando o render.
  const linhas = mensagens.map((mensagem, indice) => {
    const dia = diaBrasilia(mensagem.recebidoEm);
    const anterior = indice > 0 ? diaBrasilia(mensagens[indice - 1].recebidoEm) : null;
    return { mensagem, dia, novoDia: dia !== anterior };
  });

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100svh-6.5rem)]">
      <AtualizacaoAutomatica />
      {busca.msg && <AncoraMensagem mensagemId={busca.msg} />}

      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">WhatsApp do pós-venda</h1>
          <p className="text-sm text-muted-foreground">
            Conversas do número corporativo — {contadores.pendentes} aguardando resposta
          </p>
        </div>
        <Link href="/pos-venda" className="text-sm text-muted-foreground hover:underline">
          ← Chamados
        </Link>
      </div>

      {!podeEditar && (
        <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
          Seu perfil acompanha as conversas em modo de leitura: não é possível responder,
          assumir nem vincular.
        </p>
      )}

      <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[17rem_minmax(0,1fr)_19rem]">
        {/* --- Lista de conversas --- */}
        <div className="flex min-h-0 flex-col gap-2">
          <BuscaConversas filtros={busca} caixa={caixa} total={totalResultados} />


          {podeEditar && (

            <IniciarConversa

              iniciadasHoje={iniciadasHoje ?? 0}

              teto={parametros?.tetoDiarioConversasNovas ?? 0}

            />



          )}



          {ehAdmin && (

            <AtribuirConversas

              conversas={ativas

                .filter((c) => c.donoId === null && c.pendente)

                .map((c) => ({

                  id: c.id,

                  rotulo: c.cliente?.razaoSocial ?? c.telefoneExibicao,

                  espera: tempoEspera(c.ultimaMensagemEm),

                }))}

              atendentes={atendentes}

            />

          )}


          <div className="flex flex-wrap gap-1">
            {CAIXAS.map((opcao) => (
              <Button
                key={opcao}
                size="sm"
                variant={opcao === caixa ? "secondary" : "ghost"}
                render={<Link href={linkCaixa(opcao)} />}
                nativeButton={false}
              >
                {ROTULO_CAIXA[opcao]}
                <Badge variant="outline" className="ml-1">
                  {contadores[opcao]}
                </Badge>
              </Button>
            ))}
          </div>

          {buscando && porMensagem.length > 0 && (


            <div className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-md border bg-muted/30 p-1">


              <p className="px-1 text-xs font-medium">Mensagens encontradas</p>


              {porMensagem.map((m) => {


                const dona = porId.get(m.conversaId);


                return (


                  <Link


                    key={m.id}


                    href={`/pos-venda/whatsapp?caixa=${caixa}&conversa=${m.conversaId}&msg=${m.id}`}


                    className="rounded-md bg-card p-1.5 text-xs hover:bg-accent/50"


                  >


                    <span className="block truncate font-medium">


                      {dona?.cliente?.razaoSocial ?? dona?.telefoneExibicao ?? "Conversa"}


                      {dona?.arquivadaEm && " · arquivada"}


                    </span>


                    <span className="block truncate text-muted-foreground">{m.conteudo}</span>


                    <span className="block text-muted-foreground">


                      {formatarDataHoraBrasilia(m.recebidoEm)}


                    </span>


                  </Link>


                );


              })}


            </div>


          )}



          <div className="flex max-h-[60vh] min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1 lg:max-h-none">
            {lista.map((conversa) => (
              <div
                key={conversa.id}
                className={
                  conversa.id === selecionada?.id
                    ? "rounded-md border border-primary/50 bg-accent p-2"
                    : "rounded-md border bg-card p-2 hover:bg-accent/50"
                }
              >
                <Link href={linkConversa(conversa.id)} className="block">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {conversa.cliente?.razaoSocial ?? conversa.telefoneExibicao}
                    </span>
                    {conversa.pendente && (
                      <span
                        className="size-2 shrink-0 rounded-full bg-destructive"
                        title="Aguardando resposta"
                      />
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="truncate">
                      {conversa.cliente
                        ? conversa.telefoneExibicao
                        : (conversa.nomePerfil ?? "Sem cliente")}
                    </span>
                    <span className="shrink-0">{tempoEspera(conversa.ultimaMensagemEm)}</span>
                  </div>
                </Link>

                {/* A ação de assumir fica na LISTA, e não só dentro da conversa
                    aberta: em produção 8 de 8 conversas estavam sem dono, o que
                    é sintoma de interface antes de ser de processo. Fora do
                    <Link> porque form dentro de <a> é HTML inválido. */}
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-muted-foreground">
                    {conversa.dono?.nome ?? "Sem dono"}
                  </span>
                  {podeEditar && conversa.donoId !== usuarioId && (
                    <form action={assumirConversa.bind(null, conversa.id)}>
                      <Button type="submit" size="sm" variant="ghost" className="h-6 px-2 text-xs">
                        {conversa.donoId ? "Assumir de" : "Assumir"}
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            ))}
            {lista.length === 0 && (
              <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                Nenhuma conversa nesta caixa.
              </p>
            )}
          </div>
        </div>

        {/* --- Conversa --- */}
        <div className="flex max-h-[70svh] min-h-[26rem] flex-col overflow-hidden rounded-md border bg-background lg:h-full lg:max-h-none lg:min-h-0">
          {selecionada ? (
            <>
              <FaixaChamado
                conversaId={selecionada.id}
                chamadoAtivo={
                  chamadoAtivo
                    ? {
                        id: chamadoAtivo.id,
                        numero: chamadoAtivo.numero,
                        titulo: chamadoAtivo.titulo,
                      }
                    : null
                }
                chamados={chamadosAbertos.map((c) => ({
                  id: c.id,
                  numero: c.numero,
                  titulo: c.titulo,
                }))}
                podeEditar={podeEditar && selecionada.clienteId !== null}
              />

              <div className="flex items-center justify-between gap-2 border-b px-3 py-1.5 text-xs text-muted-foreground">
                <span>
                  {selecionada.cliente?.razaoSocial ?? "Sem cliente"} ·{" "}
                  {selecionada.telefoneExibicao}
                </span>
                <span className="flex items-center gap-2">
                  <span>{selecionada.dono ? `Dono: ${selecionada.dono.nome}` : "Sem dono"}</span>
                  {podeEditar && selecionada.donoId !== usuarioId && (
                    <form action={assumirConversa.bind(null, selecionada.id)}>
                      <Button type="submit" variant="ghost" size="sm">
                        Assumir
                      </Button>
                    </form>
                  )}
                  {podeEditar && (
                    <form
                      action={marcarPendencia.bind(
                        null,
                        selecionada.id,
                        !selecionada.pendente
                      )}
                    >
                      <Button type="submit" variant="ghost" size="sm">
                        {selecionada.pendente ? "Marcar respondida" : "Marcar pendente"}
                      </Button>
                    </form>
                  )}
                  {podeEditar &&
                    (selecionada.arquivadaEm === null ? (
                      <form action={arquivarConversa.bind(null, selecionada.id)}>
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          title="Sai da lista. Volta sozinha se o cliente escrever de novo."
                        >
                          Arquivar
                        </Button>
                      </form>
                    ) : (
                      <form action={reabrirConversa.bind(null, selecionada.id)}>
                        <Button type="submit" variant="secondary" size="sm">
                          Reabrir
                        </Button>
                      </form>
                    ))}
                </span>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
                {linhas.map(({ mensagem, dia, novoDia }) => {
                  const daEmpresa = mensagem.direcao === "saida";

                  return (
                    <div key={mensagem.id} className="flex flex-col gap-2">
                      {novoDia && (
                        <p className="my-1 text-center text-xs text-muted-foreground">{dia}</p>
                      )}
                      <div
                        id={`mensagem-${mensagem.id}`}
                        className={daEmpresa ? "flex justify-end" : "flex justify-start"}
                      >
                        <div
                          className={[
                            "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                            daEmpresa ? "bg-primary/10" : "bg-muted",
                            // Mensagem solta (sem chamado) fica com borda
                            // tracejada; a vinculada fica sólida e leva o número
                            // do chamado. É o que evita ler a conversa achando
                            // que tudo foi parar no atendimento certo.
                            mensagem.chamadoId
                              ? "border border-primary/40"
                              : "border border-dashed border-border",
                          ].join(" ")}
                        >
                          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>
                              {daEmpresa
                                ? (mensagem.autor?.nome ?? "Enviada fora do sistema")
                                : (selecionada.cliente?.razaoSocial ??
                                  selecionada.telefoneExibicao)}
                            </span>
                            <span>{formatarHoraBrasilia(mensagem.recebidoEm)}</span>
                            {mensagem.chamado && (
                              <Link
                                href={`/pos-venda/${mensagem.chamado.id}`}
                                className="hover:underline"
                              >
                                <Badge variant="outline">#{mensagem.chamado.numero}</Badge>
                              </Link>
                            )}
                            {!mensagem.entregue && (
                              <Badge variant="destructive" title={mensagem.erroEnvio ?? undefined}>
                                não entregue
                              </Badge>
                            )}
                            {mensagem.ocultaEm && <Badge variant="secondary">oculta</Badge>}
                            {ehAdmin && (
                              <BotaoOcultar
                                conversaId={selecionada.id}
                                mensagemId={mensagem.id}
                                oculta={mensagem.ocultaEm !== null}
                              />
                            )}
                          </div>

                          {mensagem.caminhoStorage && (
                            <div className="mb-1 flex flex-col gap-1">
                              {mensagem.tipo === "imagem" ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={`/api/whatsapp/midia/${mensagem.id}`}
                                  alt={mensagem.nomeArquivo ?? "Imagem recebida"}
                                  className="max-h-64 rounded-md border object-contain"
                                />
                              ) : mensagem.tipo === "audio" ? (
                                <audio controls src={`/api/whatsapp/midia/${mensagem.id}`} />
                              ) : null}
                              <a
                                href={`/api/whatsapp/midia/${mensagem.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs hover:underline"
                              >
                                {mensagem.nomeArquivo ?? "arquivo"} ·{" "}
                                {formatarTamanho(mensagem.tamanho)}
                              </a>
                              {podeEditar && (
                                <BotaoPromover
                                  conversaId={selecionada.id}
                                  mensagemId={mensagem.id}
                                />
                              )}
                            </div>
                          )}

                          {mensagem.conteudo && (
                            <p className="whitespace-pre-wrap">{mensagem.conteudo}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {mensagens.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Nenhuma mensagem nesta conversa.
                  </p>
                )}
                {ehAdmin && ocultas > 0 && (
                  <p className="py-2 text-center text-xs text-muted-foreground">
                    {ocultas} mensagem(ns) oculta(s) nesta conversa ·{" "}
                    <Link href={linkOcultas(!mostrarOcultas)} className="underline">
                      {mostrarOcultas ? "esconder de novo" : "mostrar"}
                    </Link>
                  </p>
                )}
              </div>

              {podeEditar && (
                <FormEnvio
                  conversaId={selecionada.id}
                  envioAtivo={ehEnvioAtivo(ultimaEntrada?.recebidoEm ?? null)}
                />
              )}
            </>
          ) : (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma conversa selecionada.
            </p>
          )}
        </div>

        {/* --- Painel do cliente --- */}
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          {selecionada ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    {clienteDetalhe ? "Cliente" : "Sem cliente"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-sm">
                  {clienteDetalhe ? (
                    <>
                      <Link
                        href={`/cadastros/clientes/${clienteDetalhe.id}`}
                        className="font-medium hover:underline"
                      >
                        {clienteDetalhe.razaoSocial}
                      </Link>
                      <p className="text-xs text-muted-foreground">{clienteDetalhe.cnpj}</p>
                      <p className="text-xs">
                        {formatarTelefone(clienteDetalhe.telefone)} · {clienteDetalhe.email ?? "—"}
                      </p>
                      {situacao && (
                        <p className="flex flex-wrap items-center gap-2">
                          <Badge variant={situacao.variant}>{situacao.texto}</Badge>
                          {vigenciaManutencao(clienteDetalhe) && (
                            <span className="text-xs text-muted-foreground">
                              {vigenciaManutencao(clienteDetalhe)}
                            </span>
                          )}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Este número não casou com nenhum cadastro. Vincule ao cliente para que as
                      próximas mensagens dele já cheguem identificadas.
                    </p>
                  )}

                  {podeEditar && (
                    <VinculoCliente
                      conversaId={selecionada.id}
                      clientes={(clientesData ?? []).map((c) => ({
                        value: c.id,
                        label: c.razaoSocial,
                      }))}
                      contatos={contatosData ?? []}
                      nomePerfil={selecionada.nomePerfil}
                      clienteAtual={
                        selecionada.cliente
                          ? {
                              value: selecionada.cliente.id,
                              label: selecionada.cliente.razaoSocial,
                            }
                          : null
                      }
                    />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Chamados em aberto</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-sm">
                  {chamadosAbertos.map((chamado) => {
                    const coluna = colunaDoChamado(
                      { estagio: chamado.estagio, prazoLimite: chamado.prazoLimite },
                      chamado.tipo?.diasAlerta ?? 0,
                      hoje
                    );
                    return (
                      <div key={chamado.id} className="flex flex-col">
                        <Link
                          href={`/pos-venda/${chamado.id}`}
                          className="font-medium hover:underline"
                        >
                          #{chamado.numero} · {chamado.titulo}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          {ROTULO_COLUNA[coluna]} ·{" "}
                          {textoPrazo(
                            { estagio: chamado.estagio, prazoLimite: chamado.prazoLimite },
                            hoje
                          )}{" "}
                          (vence {formatarData(chamado.prazoLimite)})
                        </span>
                      </div>
                    );
                  })}
                  {chamadosAbertos.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      {clienteDetalhe
                        ? "Nenhum chamado em aberto para este cliente."
                        : "Vincule o cliente para ver os chamados dele."}
                    </p>
                  )}
                  {podeEditar && (
                    <Button
                      variant="secondary"
                      size="sm"
                      render={<Link href="/pos-venda/novo" />}
                      nativeButton={false}
                    >
                      + Abrir chamado
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Conversa</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-1 text-xs text-muted-foreground">
                  <p>Telefone: {selecionada.telefoneExibicao}</p>
                  {selecionada.nomePerfil && <p>Perfil no WhatsApp: {selecionada.nomePerfil}</p>}
                  <p>
                    Última mensagem:{" "}
                    {selecionada.ultimaMensagemEm
                      ? formatarDataHoraBrasilia(selecionada.ultimaMensagemEm)
                      : "—"}
                  </p>
                  <p>Horários em Brasília (America/Sao_Paulo).</p>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
