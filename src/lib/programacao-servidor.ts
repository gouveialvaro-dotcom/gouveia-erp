// Carga de dados, prévia e publicação da Programação de Logística.
//
// SERVER ONLY: usa o client de service role (ver src/lib/supabase.ts) e nunca
// pode ser importado por Client Component. As regras puras — texto das
// mensagens, ocupação do dia, datas — ficam em src/lib/programacao.ts, que a
// tela importa sem arrastar o Supabase junto.

import { supabase } from "@/lib/supabase";
import { projetoDaObra } from "@/lib/obras";
import { ROTULO_PERFIL, type Perfil } from "@/lib/permissoes";
import { chaveTelefone, formatarTelefone, telefoneParaEnvio } from "@/lib/pos-venda-whatsapp";
import { enviarTexto } from "@/lib/uazapi";
import {
  descricaoVeiculo,
  ehUrgente,
  horaBrasilia,
  itensDaLinhaCompleta,
  linhaDeAlteracao,
  montarMensagem,
  montarOcupacao,
  papelPrincipal,
  type AlteracaoLegivel,
  type ConteudoMensagem,
  type LinhaLegivel,
  type Ocupacao,
  type PreviaPublicacao,
  type DestinatarioPrevia,
  type PendenciaPrevia,
  type StatusProgramacao,
  type TipoDestinoProgramacao,
} from "@/lib/programacao";

// --- Carga ---------------------------------------------------------------

/** Quem pode receber aviso: o telefone e o interruptor individual vêm juntos. */
export type PessoaAviso = {
  id: string;
  nome: string;
  telefone: string | null;
  recebeProgramacao: boolean;
};

export type ProgramacaoCarregada = {
  id: string;
  data: string;
  tipoDestino: TipoDestinoProgramacao;
  obraId: string | null;
  descricaoAvulsa: string | null;
  veiculoId: string | null;
  motoristaId: string | null;
  servico: string;
  observacao: string | null;
  status: StatusProgramacao;
  publicadaEm: string | null;
  temAlteracaoPendente: boolean;
  obra: {
    id: string;
    nomeProjeto: string | null;
    oportunidade: { orcamento: { nomeProjeto: string } | null } | null;
  } | null;
  veiculo: { id: string; modelo: string; placa: string; identificacao: string | null } | null;
  motorista: PessoaAviso | null;
  equipe: { funcionarioId: string; funcionario: PessoaAviso | null }[];
  responsaveis: { usuarioId: string; usuario: PessoaAviso | null }[];
};

// Sem quebras de linha: o select vai na query string do PostgREST.
const SELECT_PROGRAMACAO = [
  "id, data, tipoDestino, obraId, descricaoAvulsa, veiculoId, motoristaId",
  "servico, observacao, status, publicadaEm, temAlteracaoPendente",
  "obra:Obra(id, nomeProjeto, oportunidade:Oportunidade(orcamento:Orcamento(nomeProjeto)))",
  "veiculo:Veiculo(id, modelo, placa, identificacao)",
  "motorista:Funcionario(id, nome, telefone, recebeProgramacao)",
  "equipe:ProgramacaoEquipe(funcionarioId, funcionario:Funcionario(id, nome, telefone, recebeProgramacao))",
  "responsaveis:ProgramacaoResponsavel(usuarioId, usuario:Usuario(id, nome, telefone, recebeProgramacao))",
].join(", ");

/**
 * Nome do destino como a pessoa em campo o conhece — nunca id nem código.
 *
 * A obra do funil não guarda nome próprio: empresta o do orçamento da
 * oportunidade (ver projetoDaObra em lib/obras.ts). O destino avulso guarda o
 * texto que a logística digitou.
 */
export function destinoLegivel(linha: {
  tipoDestino: TipoDestinoProgramacao;
  descricaoAvulsa: string | null;
  obra: ProgramacaoCarregada["obra"];
}): string {
  if (linha.tipoDestino === "avulso") return linha.descricaoAvulsa ?? "Destino avulso";
  if (!linha.obra) return "Obra";
  return `Obra ${projetoDaObra(linha.obra)}`;
}

/** A linha reduzida ao que a mensagem precisa dizer, tudo em texto legível. */
export function linhaLegivel(linha: ProgramacaoCarregada): LinhaLegivel {
  return {
    data: linha.data.slice(0, 10),
    destino: destinoLegivel(linha),
    servico: linha.servico,
    veiculo: descricaoVeiculo(linha.veiculo),
    motorista: linha.motorista?.nome ?? null,
    equipe: linha.equipe.map((e) => e.funcionario?.nome ?? "—"),
    responsaveis: linha.responsaveis.map((r) => r.usuario?.nome ?? "—"),
  };
}

export async function carregarProgramacoes(inicio: string, fim: string) {
  const { data } = await supabase
    .from("ProgramacaoDiaria")
    .select(SELECT_PROGRAMACAO)
    .gte("data", inicio)
    .lte("data", fim)
    .order("data", { ascending: true });

  return (data ?? []) as unknown as ProgramacaoCarregada[];
}

export async function carregarProgramacao(id: string) {
  const { data } = await supabase
    .from("ProgramacaoDiaria")
    .select(SELECT_PROGRAMACAO)
    .eq("id", id)
    .maybeSingle();

  return (data ?? null) as unknown as ProgramacaoCarregada | null;
}

/**
 * Quem/o que já está comprometido em UMA data.
 *
 * É a função que a tela chama para desabilitar a opção com o motivo ao lado e
 * a que a Server Action chama para recusar a gravação. Uma segunda
 * implementação de um dos lados divergiria no primeiro ajuste — e a tela
 * mentiria sobre o que o servidor aceita.
 */
export async function carregarOcupacao(
  data: string,
  ignorarProgramacaoId?: string | null
): Promise<Ocupacao> {
  const dia = data.slice(0, 10);

  const [{ data: linhas }, { data: indisponibilidades }] = await Promise.all([
    supabase
      .from("ProgramacaoDiaria")
      .select(
        "id, status, veiculoId, tipoDestino, descricaoAvulsa, obra:Obra(id, nomeProjeto, oportunidade:Oportunidade(orcamento:Orcamento(nomeProjeto))), equipe:ProgramacaoEquipe(funcionarioId)"
      )
      .eq("data", dia)
      .neq("status", "cancelada"),
    // O intervalo é filtrado no banco: dataFim é inclusiva.
    supabase
      .from("Indisponibilidade")
      .select("funcionarioId, veiculoId, motivo, dataFim")
      .lte("dataInicio", dia)
      .gte("dataFim", dia),
  ]);

  type LinhaOcupacao = {
    id: string;
    status: StatusProgramacao;
    veiculoId: string | null;
    tipoDestino: TipoDestinoProgramacao;
    descricaoAvulsa: string | null;
    obra: ProgramacaoCarregada["obra"];
    equipe: { funcionarioId: string }[];
  };

  const ocupantes = ((linhas ?? []) as unknown as LinhaOcupacao[]).map((linha) => ({
    id: linha.id,
    status: linha.status,
    veiculoId: linha.veiculoId,
    destino: destinoLegivel(linha),
    equipeIds: linha.equipe.map((e) => e.funcionarioId),
  }));

  return montarOcupacao(
    ocupantes,
    (indisponibilidades ?? []).map((i) => ({
      funcionarioId: i.funcionarioId,
      veiculoId: i.veiculoId,
      motivo: i.motivo,
      dataFim: i.dataFim,
    })),
    ignorarProgramacaoId
  );
}

// --- Números internos ----------------------------------------------------

/**
 * O telefone pertence a alguém de dentro da empresa?
 *
 * A resposta do funcionário no WhatsApp é DESCARTADA por decisão do escopo: o
 * aviso de programação não gera conversa e não entra na fila do atendimento.
 * Sem esta verificação, o encarregado que responde "beleza" viraria um
 * atendimento aberto sem dono, na caixa "Sem cliente".
 *
 * A comparação é em memória, e não no SQL, porque o telefone é texto livre com
 * máscara — mesmo motivo de donoDoTelefone() em lib/whatsapp-cadastro.ts.
 */
export async function telefoneEhInterno(bruto: string | null | undefined) {
  const chave = chaveTelefone(bruto);
  if (!chave) return false;

  const [{ data: usuarios }, { data: funcionarios }] = await Promise.all([
    supabase.from("Usuario").select("telefone").not("telefone", "is", null),
    supabase.from("Funcionario").select("telefone").not("telefone", "is", null),
  ]);

  const internos = [...(usuarios ?? []), ...(funcionarios ?? [])];
  return internos.some((pessoa) => chaveTelefone(pessoa.telefone) === chave);
}

// --- Prévia da publicação -------------------------------------------------

// Os tipos da prévia vivem em lib/programacao.ts (puro) para que o modal de
// confirmação possa usá-los sem importar este arquivo, que é server-only.
export type { PreviaPublicacao, DestinatarioPrevia, PendenciaPrevia };

type AlteracaoPendente = AlteracaoLegivel & {
  id: string;
  programacaoId: string;
  motoristaAnteriorId: string | null;
};

/** Início do dia de hoje em Brasília, em ISO — recorte do teto diário. */
function inicioDoDiaBrasilia() {
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  // -03:00 é o offset de Brasília, que não tem horário de verão desde 2019.
  return `${hoje}T00:00:00-03:00`;
}

/** Linhas do período que ainda não foram comunicadas. */
export async function carregarPendencias(inicio: string, fim: string) {
  const { data } = await supabase
    .from("ProgramacaoDiaria")
    .select(SELECT_PROGRAMACAO)
    .gte("data", inicio)
    .lte("data", fim)
    .or("status.eq.rascunho,temAlteracaoPendente.eq.true")
    .order("data", { ascending: true });

  return (data ?? []) as unknown as ProgramacaoCarregada[];
}

/**
 * Monta exatamente o que sairia se a logística publicasse agora — sem gravar
 * nada e sem enviar nada.
 *
 * A prévia é obrigatória antes de disparar (o modal a exibe) porque envio de
 * WhatsApp é irreversível e chega a pessoas em campo: não há como "cancelar" a
 * mensagem depois de ela tocar o celular de quem está na estrada.
 */
export async function montarPrevia(
  inicio: string,
  fim: string,
  autorId: string
): Promise<PreviaPublicacao> {
  const linhas = await carregarPendencias(inicio, fim);

  const [{ data: autor }, { data: parametros }, { count: enviadasHoje }] = await Promise.all([
    supabase.from("Usuario").select("nome, perfil").eq("id", autorId).maybeSingle(),
    supabase.from("ParametroGeral").select("tetoDiarioAvisosProgramacao").limit(1).maybeSingle(),
    supabase
      .from("EnvioWhatsapp")
      .select("id", { count: "exact", head: true })
      .gte("criadoEm", inicioDoDiaBrasilia()),
  ]);

  const assinatura = {
    autor: autor?.nome ?? "Logística",
    perfilAutor: autor ? ROTULO_PERFIL[autor.perfil as Perfil] : "Logística",
    hora: horaBrasilia(),
  };

  const teto = parametros?.tetoDiarioAvisosProgramacao ?? 0;

  const vazia: PreviaPublicacao = {
    pendencias: [],
    destinatarios: [],
    semTelefone: [],
    silenciados: [],
    totalMensagens: 0,
    enviadasHoje: enviadasHoje ?? 0,
    teto,
    excedeTeto: false,
  };

  if (!linhas.length) return vazia;

  const { data: alteracoesData } = await supabase
    .from("AlteracaoProgramacao")
    .select("id, programacaoId, campo, valorAnterior, valorNovo, motoristaAnteriorId")
    .in(
      "programacaoId",
      linhas.map((l) => l.id)
    )
    .is("publicadaEm", null)
    .order("alteradoEm", { ascending: true });

  const alteracoes = (alteracoesData ?? []) as AlteracaoPendente[];
  const porLinha = new Map<string, AlteracaoPendente[]>();
  for (const alteracao of alteracoes) {
    const lista = porLinha.get(alteracao.programacaoId) ?? [];
    lista.push(alteracao);
    porLinha.set(alteracao.programacaoId, lista);
  }

  // Quem saiu como motorista é buscado pelo id guardado na alteração; o texto
  // que a mensagem mostra continua vindo do valor legível.
  const idsRemovidos = [
    ...new Set(
      alteracoes
        .filter((a) => a.campo === "motorista" && a.motoristaAnteriorId)
        .map((a) => a.motoristaAnteriorId as string)
    ),
  ];

  const { data: removidosData } = idsRemovidos.length
    ? await supabase
        .from("Funcionario")
        .select("id, nome, telefone, recebeProgramacao")
        .in("id", idsRemovidos)
    : { data: [] };

  const removidos = new Map((removidosData ?? []).map((f) => [f.id, f as PessoaAviso]));

  // Acumulador por PESSOA, ainda sem deduplicar por telefone.
  type Acumulado = {
    pessoa: PessoaAviso;
    usuarioId: string | null;
    funcionarioId: string | null;
    conteudo: ConteudoMensagem;
  };

  const porPessoa = new Map<string, Acumulado>();

  function acumular(
    pessoa: PessoaAviso | null,
    ehUsuario: boolean,
    aplicar: (conteudo: ConteudoMensagem) => void
  ) {
    if (!pessoa) return;
    const chave = `${ehUsuario ? "u" : "f"}:${pessoa.id}`;
    const existente = porPessoa.get(chave) ?? {
      pessoa,
      usuarioId: ehUsuario ? pessoa.id : null,
      funcionarioId: ehUsuario ? null : pessoa.id,
      conteudo: { blocosResponsavel: [], linhasMotorista: [], linhasRemovido: [] },
    };
    aplicar(existente.conteudo);
    porPessoa.set(chave, existente);
  }

  const pendencias: PendenciaPrevia[] = [];

  for (const linha of linhas) {
    const legivel = linhaLegivel(linha);
    const primeiraPublicacao = linha.status === "rascunho";
    const cancelada = linha.status === "cancelada";

    // Primeira publicação leva a linha inteira: não há "antes" para comparar.
    // Republicação leva só o que mudou — o resto a pessoa já recebeu.
    const itens = primeiraPublicacao
      ? itensDaLinhaCompleta(legivel)
      : (porLinha.get(linha.id) ?? []).map(linhaDeAlteracao);

    // Linha marcada como pendente sem nada a dizer não vira mensagem vazia.
    if (!itens.length) continue;

    pendencias.push({
      id: linha.id,
      data: legivel.data,
      destino: legivel.destino,
      primeiraPublicacao,
      cancelada,
      itens,
    });

    for (const responsavel of linha.responsaveis) {
      acumular(responsavel.usuario, true, (conteudo) => {
        conteudo.blocosResponsavel.push({
          data: legivel.data,
          destino: legivel.destino,
          itens,
        });
      });
    }

    // Cancelar é retirar todo mundo: mandar o quadro completo de uma linha que
    // não existe mais faria o motorista sair.
    if (cancelada) {
      acumular(linha.motorista, false, (conteudo) => {
        conteudo.linhasRemovido.push({ data: legivel.data, destino: legivel.destino });
      });
    } else {
      acumular(linha.motorista, false, (conteudo) => {
        conteudo.linhasMotorista.push(legivel);
      });
    }

    for (const alteracao of porLinha.get(linha.id) ?? []) {
      if (alteracao.campo !== "motorista" || !alteracao.motoristaAnteriorId) continue;
      // Quem voltou a ser o motorista da linha não "saiu" dela.
      if (alteracao.motoristaAnteriorId === linha.motoristaId) continue;
      acumular(removidos.get(alteracao.motoristaAnteriorId) ?? null, false, (conteudo) => {
        conteudo.linhasRemovido.push({ data: legivel.data, destino: legivel.destino });
      });
    }
  }

  const semTelefone: PreviaPublicacao["semTelefone"] = [];
  const silenciados: PreviaPublicacao["silenciados"] = [];

  // Deduplicação por TELEFONE normalizado, e não por cadastro. O encarregado
  // costuma existir em Usuario (responsável) e em Funcionario (motorista); se
  // os dois cadastros trazem o mesmo número, sai UMA mensagem com os dois
  // papéis. Sem isso ele recebe duas quase iguais e passa a ignorar as duas.
  const porTelefone = new Map<string, Acumulado & { chave: string }>();

  for (const item of porPessoa.values()) {
    if (!item.pessoa.recebeProgramacao) {
      silenciados.push({ nome: item.pessoa.nome });
      continue;
    }

    const chave = chaveTelefone(item.pessoa.telefone);
    if (!chave) {
      semTelefone.push({
        nome: item.pessoa.nome,
        papel: item.usuarioId ? "Responsável" : "Motorista",
      });
      continue;
    }

    const existente = porTelefone.get(chave);
    if (!existente) {
      porTelefone.set(chave, { ...item, chave });
      continue;
    }

    existente.conteudo.blocosResponsavel.push(...item.conteudo.blocosResponsavel);
    existente.conteudo.linhasMotorista.push(...item.conteudo.linhasMotorista);
    existente.conteudo.linhasRemovido.push(...item.conteudo.linhasRemovido);
    existente.usuarioId ??= item.usuarioId;
    existente.funcionarioId ??= item.funcionarioId;
  }

  const destinatarios: DestinatarioPrevia[] = [];

  for (const item of porTelefone.values()) {
    const datas = [
      ...item.conteudo.blocosResponsavel.map((b) => b.data),
      ...item.conteudo.linhasMotorista.map((l) => l.data),
      ...item.conteudo.linhasRemovido.map((l) => l.data),
    ];
    const urgente = datas.some((data) => ehUrgente(data));

    const papeis: string[] = [];
    if (item.conteudo.blocosResponsavel.length) papeis.push("Responsável");
    if (item.conteudo.linhasMotorista.length) papeis.push("Motorista");
    if (item.conteudo.linhasRemovido.length) papeis.push("Motorista retirado");

    destinatarios.push({
      chave: item.chave,
      telefoneExibicao: formatarTelefone(item.pessoa.telefone),
      nome: item.pessoa.nome,
      papel: papelPrincipal(item.conteudo),
      papeis,
      usuarioId: item.usuarioId,
      funcionarioId: item.funcionarioId,
      mensagem: montarMensagem(item.conteudo, assinatura, urgente),
      urgente,
    });
  }

  // Urgente primeiro: é o que a logística confere com mais atenção no modal.
  destinatarios.sort((a, b) => Number(b.urgente) - Number(a.urgente) || a.nome.localeCompare(b.nome));

  return {
    pendencias,
    destinatarios,
    semTelefone,
    silenciados,
    totalMensagens: destinatarios.length,
    enviadasHoje: enviadasHoje ?? 0,
    teto,
    excedeTeto: (enviadasHoje ?? 0) + destinatarios.length > teto,
  };
}

// --- Publicação -----------------------------------------------------------

export type ResultadoPublicacao = { erro?: string; enviadas?: number; falhas?: number };

/**
 * Publica o período e dispara os avisos.
 *
 * Ordem que importa: a programação é gravada como publicada ANTES de qualquer
 * tentativa de envio, e a linha de EnvioWhatsapp nasce antes da chamada ao
 * gateway. Falha de envio NÃO desfaz a publicação — a programação publicada é
 * a verdade do sistema, a mensagem é só o aviso. Desfazer a publicação porque
 * o gateway caiu deixaria a operação sem programação nenhuma.
 */
export async function publicarPeriodo(
  inicio: string,
  fim: string,
  autorId: string
): Promise<ResultadoPublicacao> {
  const previa = await montarPrevia(inicio, fim, autorId);

  if (!previa.pendencias.length) {
    return { erro: "Não há nada a publicar neste período." };
  }

  if (previa.excedeTeto) {
    return {
      erro:
        `Teto diário atingido: ${previa.enviadasHoje} de ${previa.teto} avisos enviados hoje, ` +
        `e esta publicação mandaria mais ${previa.totalMensagens}. O limite existe porque o ` +
        "número é o mesmo do atendimento e a integração não é oficial — estourar o volume é o " +
        "caminho para o bloqueio. Publique em partes ou ajuste o teto em Parâmetros.",
    };
  }

  const agora = new Date().toISOString();
  const ids = previa.pendencias.map((p) => p.id);

  // 1. A programação passa a valer.
  const { data: rascunhos } = await supabase
    .from("ProgramacaoDiaria")
    .select("id, status")
    .in("id", ids);

  const idsRascunho = (rascunhos ?? []).filter((l) => l.status === "rascunho").map((l) => l.id);
  const idsRepublicados = ids.filter((id) => !idsRascunho.includes(id));

  if (idsRascunho.length) {
    await supabase
      .from("ProgramacaoDiaria")
      .update({ status: "publicada", publicadaEm: agora, temAlteracaoPendente: false })
      .in("id", idsRascunho);
  }

  if (idsRepublicados.length) {
    // Cancelada continua cancelada: republicar comunica o cancelamento, não o
    // desfaz.
    await supabase
      .from("ProgramacaoDiaria")
      .update({ publicadaEm: agora, temAlteracaoPendente: false })
      .in("id", idsRepublicados);
  }

  // 2. As alterações passam a estar comunicadas.
  await supabase
    .from("AlteracaoProgramacao")
    .update({ publicadaEm: agora })
    .in("programacaoId", ids)
    .is("publicadaEm", null);

  // 3. Registro de envio ANTES da tentativa.
  const { data: envios } = await supabase
    .from("EnvioWhatsapp")
    .insert(
      previa.destinatarios.map((destinatario) => ({
        telefone: destinatario.chave,
        usuarioId: destinatario.usuarioId,
        funcionarioId: destinatario.funcionarioId,
        papel: destinatario.papel,
        mensagem: destinatario.mensagem,
        urgente: destinatario.urgente,
        status: "pendente",
      }))
    )
    .select("id, telefone, mensagem");

  let enviadas = 0;
  let falhas = 0;

  // Um de cada vez, e não em paralelo: rajada simultânea para o mesmo número é
  // exatamente o padrão que a Meta lê como disparo em massa.
  //
  // Consequência aceita: com o teto no máximo, a action pode passar do tempo
  // limite da plataforma. O desenho já degrada certo — as linhas nascem
  // "pendente" ANTES do envio, então as que não saíram continuam visíveis em
  // /programacao/envios com o botão de reenvio, e a publicação (que é a verdade
  // do sistema) permanece gravada.
  for (const envio of envios ?? []) {
    const resultado = await enviarTexto(telefoneParaEnvio(envio.telefone), envio.mensagem);
    if (resultado.ok) enviadas++;
    else falhas++;

    await supabase
      .from("EnvioWhatsapp")
      .update({
        status: resultado.ok ? "enviado" : "falha",
        erro: resultado.ok ? null : resultado.erro,
        tentativas: 1,
        enviadoEm: resultado.ok ? new Date().toISOString() : null,
      })
      .eq("id", envio.id);
  }

  return { enviadas, falhas };
}

/** Reenvio manual de um aviso que falhou, a partir de /programacao/envios. */
export async function reenviarAviso(envioId: string): Promise<{ erro?: string }> {
  const { data: envio } = await supabase
    .from("EnvioWhatsapp")
    .select("id, telefone, mensagem, tentativas")
    .eq("id", envioId)
    .maybeSingle();

  if (!envio) return { erro: "Envio não encontrado." };

  const resultado = await enviarTexto(telefoneParaEnvio(envio.telefone), envio.mensagem);

  await supabase
    .from("EnvioWhatsapp")
    .update({
      status: resultado.ok ? "enviado" : "falha",
      erro: resultado.ok ? null : resultado.erro,
      tentativas: envio.tentativas + 1,
      enviadoEm: resultado.ok ? new Date().toISOString() : null,
    })
    .eq("id", envio.id);

  return resultado.ok ? {} : { erro: resultado.erro };
}
