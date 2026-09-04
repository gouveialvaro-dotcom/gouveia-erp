"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { exigirPermissao } from "@/lib/api-auth";
import type { EstadoExclusao } from "@/components/ui/botao-excluir";
import { chaveTelefone } from "@/lib/pos-venda-whatsapp";
import { formatarData } from "@/lib/format";
import { hojeIso, somarDias } from "@/lib/pos-venda";
import {
  descricaoVeiculo,
  inicioDaSemana,
  linhaEditavel,
  type CampoAlteracao,
  type Ocupacao,
} from "@/lib/programacao";
import {
  carregarOcupacao,
  carregarProgramacao,
  destinoLegivel,
  montarPrevia,
  publicarPeriodo as publicarNoServidor,
  reenviarAviso,
  type PreviaPublicacao,
} from "@/lib/programacao-servidor";

function revalidar() {
  revalidatePath("/programacao");
  revalidatePath("/programacao/indisponibilidades");
  revalidatePath("/programacao/envios");
}

// --- Linha da programação -------------------------------------------------

const programacaoSchema = z
  .object({
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data."),
    tipoDestino: z.enum(["obra", "avulso"]),
    obraId: z.string().trim().optional(),
    descricaoAvulsa: z.string().trim().optional(),
    servico: z.string().trim().min(1, "Descreva o serviço do dia."),
    veiculoId: z.string().trim().optional(),
    motoristaId: z.string().trim().optional(),
    observacao: z.string().trim().optional(),
    equipeIds: z.array(z.string().min(1)).min(1, "Escolha pelo menos uma pessoa para a equipe."),
    responsavelIds: z
      .array(z.string().min(1))
      .min(1, "Escolha pelo menos um responsável pelo destino."),
  })
  .superRefine((dados, ctx) => {
    // Mesma coerência do CHECK do banco. Está nos dois lugares de propósito: o
    // banco é a garantia, a action é a mensagem legível.
    if (dados.tipoDestino === "obra" && !dados.obraId) {
      ctx.addIssue({ code: "custom", message: "Escolha a obra de destino." });
    }
    if (dados.tipoDestino === "avulso" && !dados.descricaoAvulsa) {
      ctx.addIssue({ code: "custom", message: "Descreva o destino avulso." });
    }
    // Carro sem motorista definido é o buraco de comunicação que o módulo
    // existe para fechar.
    if (dados.veiculoId && !dados.motoristaId) {
      ctx.addIssue({ code: "custom", message: "Informe o motorista do veículo." });
    }
    if (dados.motoristaId && !dados.equipeIds.includes(dados.motoristaId)) {
      ctx.addIssue({
        code: "custom",
        message: "O motorista precisa estar na equipe do dia.",
      });
    }
  });

export type EstadoFormProgramacao = { erro?: string; ok?: boolean } | undefined;

function lerFormulario(formData: FormData) {
  const texto = (campo: string) => {
    const valor = formData.get(campo);
    return typeof valor === "string" && valor.trim() !== "" ? valor.trim() : undefined;
  };

  return {
    data: String(formData.get("data") ?? ""),
    tipoDestino: String(formData.get("tipoDestino") ?? "obra"),
    obraId: texto("obraId"),
    descricaoAvulsa: texto("descricaoAvulsa"),
    servico: texto("servico") ?? "",
    veiculoId: texto("veiculoId"),
    motoristaId: texto("motoristaId"),
    observacao: texto("observacao"),
    equipeIds: formData.getAll("equipeIds").map(String).filter(Boolean),
    responsavelIds: formData.getAll("responsavelIds").map(String).filter(Boolean),
  };
}

export async function salvarProgramacao(
  programacaoId: string | null,
  _estado: EstadoFormProgramacao,
  formData: FormData
): Promise<EstadoFormProgramacao> {
  const { usuarioId, perfil } = await exigirPermissao("programacao", "escrita");

  const analise = programacaoSchema.safeParse(lerFormulario(formData));
  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const dados = analise.data;

  if (!linhaEditavel(dados.data, perfil === "admin")) {
    return {
      erro: "Data já passada. Programação anterior a hoje é somente leitura — fale com o administrador.",
    };
  }

  const anterior = programacaoId ? await carregarProgramacao(programacaoId) : null;
  if (programacaoId && !anterior) return { erro: "Programação não encontrada." };
  if (anterior?.status === "cancelada") {
    return { erro: "Programação cancelada não é editada. Crie uma nova linha." };
  }
  // A data ANTERIOR também é conferida: sem isso, mover para o futuro uma linha
  // que já aconteceu passaria pela checagem acima e reescreveria o passado.
  if (anterior && !linhaEditavel(anterior.data, perfil === "admin")) {
    return { erro: "Programação de data já passada é somente leitura." };
  }

  // Tudo que a mensagem precisa nomear é lido aqui: o texto legível é gravado
  // em AlteracaoProgramacao e não pode depender de um id resolvido depois.
  const [{ data: obra }, { data: veiculo }, { data: pessoas }, { data: usuarios }] =
    await Promise.all([
      dados.obraId
        ? supabase
            .from("Obra")
            .select(
              "id, nomeProjeto, oportunidade:Oportunidade(orcamento:Orcamento(nomeProjeto))"
            )
            .eq("id", dados.obraId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      dados.veiculoId
        ? supabase
            .from("Veiculo")
            .select("id, modelo, placa, identificacao, ativo")
            .eq("id", dados.veiculoId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("Funcionario")
        .select("id, nome, telefone, ativo")
        .in("id", dados.equipeIds),
      supabase
        .from("Usuario")
        .select("id, nome, telefone, ativo")
        .in("id", dados.responsavelIds),
    ]);

  if (dados.obraId && !obra) return { erro: "Obra de destino não encontrada." };
  if (dados.veiculoId && !veiculo) return { erro: "Veículo não encontrado." };
  if (veiculo && !veiculo.ativo) return { erro: "Veículo baixado não pode ser alocado." };

  const equipe = pessoas ?? [];
  if (equipe.length !== dados.equipeIds.length) {
    return { erro: "Algum funcionário da equipe não existe mais no cadastro." };
  }
  const responsaveis = usuarios ?? [];
  if (responsaveis.length !== dados.responsavelIds.length) {
    return { erro: "Algum responsável não existe mais no cadastro." };
  }

  // Sem número não há aviso, e sem aviso o módulo não cumpre o que promete.
  // Por isso o bloqueio é na gravação, e não na hora de publicar: descobrir o
  // cadastro incompleto só no disparo é tarde demais.
  const responsavelSemTelefone = responsaveis.find((u) => !chaveTelefone(u.telefone));
  if (responsavelSemTelefone) {
    return {
      erro: `${responsavelSemTelefone.nome} não tem WhatsApp cadastrado e não pode ser responsável. Complete o cadastro em Administração.`,
    };
  }

  const motorista = dados.motoristaId
    ? equipe.find((f) => f.id === dados.motoristaId)
    : undefined;
  if (dados.motoristaId && !motorista) return { erro: "Motorista não encontrado na equipe." };
  if (motorista && !chaveTelefone(motorista.telefone)) {
    return {
      erro: `${motorista.nome} não tem WhatsApp cadastrado e não pode ser motorista. Complete o cadastro em Cadastros › Funcionários.`,
    };
  }

  // --- Trava de duplicidade e de indisponibilidade -------------------------
  // A mesma função que desabilita a opção na tela recusa aqui. Desabilitar na
  // lista nunca substitui o bloqueio no servidor: a tela pode estar velha, e o
  // formulário é postável à mão.
  const ocupacao = await carregarOcupacao(dados.data, programacaoId);

  for (const pessoa of equipe) {
    const impedimento = ocupacao.funcionarios[pessoa.id];
    if (impedimento) {
      return { erro: `${pessoa.nome} ${impedimento.motivo}.` };
    }
  }
  if (veiculo) {
    const impedimento = ocupacao.veiculos[veiculo.id];
    if (impedimento) {
      return { erro: `${descricaoVeiculo(veiculo)} ${impedimento.motivo}.` };
    }
  }

  const destinoNovo = destinoLegivel({
    tipoDestino: dados.tipoDestino,
    descricaoAvulsa: dados.descricaoAvulsa ?? null,
    obra: obra ?? null,
  });

  const registro = {
    data: dados.data,
    tipoDestino: dados.tipoDestino,
    obraId: dados.tipoDestino === "obra" ? (dados.obraId ?? null) : null,
    descricaoAvulsa: dados.tipoDestino === "avulso" ? (dados.descricaoAvulsa ?? null) : null,
    veiculoId: dados.veiculoId ?? null,
    motoristaId: dados.motoristaId ?? null,
    servico: dados.servico,
    observacao: dados.observacao ?? null,
  };

  let idSalvo = programacaoId;

  if (anterior) {
    const { error } = await supabase
      .from("ProgramacaoDiaria")
      .update({ ...registro, atualizadoPorId: usuarioId, atualizadoEm: new Date().toISOString() })
      .eq("id", anterior.id);

    if (error) return { erro: traduzirErroBanco(error) };
  } else {
    const { data: criada, error } = await supabase
      .from("ProgramacaoDiaria")
      .insert({ ...registro, criadoPorId: usuarioId })
      .select("id")
      .single();

    if (error || !criada) return { erro: traduzirErroBanco(error) };
    idSalvo = criada.id;
  }

  if (!idSalvo) return { erro: "Não foi possível salvar a programação." };

  // Equipe e responsáveis são regravados por inteiro: são listas pequenas, e
  // um diff incremental aqui só criaria caminho para o estado ficar meio velho.
  await supabase.from("ProgramacaoEquipe").delete().eq("programacaoId", idSalvo);
  await supabase
    .from("ProgramacaoEquipe")
    .insert(dados.equipeIds.map((funcionarioId) => ({ programacaoId: idSalvo, funcionarioId })));

  await supabase.from("ProgramacaoResponsavel").delete().eq("programacaoId", idSalvo);
  await supabase
    .from("ProgramacaoResponsavel")
    .insert(dados.responsavelIds.map((usuId) => ({ programacaoId: idSalvo, usuarioId: usuId })));

  // --- Diff, só depois de publicada ---------------------------------------
  // Editar rascunho não gera registro nem dispara: ninguém foi avisado ainda,
  // logo não há "antes" que alguém tenha visto.
  if (anterior && anterior.status === "publicada") {
    const alteracoes: {
      campo: CampoAlteracao;
      valorAnterior: string | null;
      valorNovo: string | null;
      motoristaAnteriorId?: string | null;
    }[] = [];

    const registrar = (
      campo: CampoAlteracao,
      antes: string | null,
      depois: string | null,
      motoristaAnteriorId?: string | null
    ) => {
      if ((antes ?? "") === (depois ?? "")) return;
      alteracoes.push({ campo, valorAnterior: antes, valorNovo: depois, motoristaAnteriorId });
    };

    registrar("data", formatarData(anterior.data), formatarData(dados.data));
    registrar("destino", destinoLegivel(anterior), destinoNovo);
    registrar("servico", anterior.servico, dados.servico);
    registrar("veiculo", descricaoVeiculo(anterior.veiculo), descricaoVeiculo(veiculo ?? null));
    registrar(
      "motorista",
      anterior.motorista?.nome ?? null,
      motorista?.nome ?? null,
      anterior.motoristaId
    );
    registrar(
      "equipe",
      anterior.equipe.map((e) => e.funcionario?.nome ?? "—").join(", "),
      equipe.map((f) => f.nome).join(", ")
    );
    registrar(
      "responsaveis",
      anterior.responsaveis.map((r) => r.usuario?.nome ?? "—").join(", "),
      responsaveis.map((u) => u.nome).join(", ")
    );
    registrar("observacao", anterior.observacao, dados.observacao ?? null);

    if (alteracoes.length) {
      await supabase.from("AlteracaoProgramacao").insert(
        alteracoes.map((alteracao) => ({
          programacaoId: idSalvo,
          campo: alteracao.campo,
          valorAnterior: alteracao.valorAnterior,
          valorNovo: alteracao.valorNovo,
          motoristaAnteriorId: alteracao.motoristaAnteriorId ?? null,
          alteradoPorId: usuarioId,
        }))
      );

      await supabase
        .from("ProgramacaoDiaria")
        .update({ temAlteracaoPendente: true })
        .eq("id", idSalvo);
    }
  }

  revalidar();
  return { ok: true };
}

/**
 * Traduz o que o banco recusou.
 *
 * 23505 aqui só pode ser o índice único de (data, veiculo): duas pessoas
 * salvando o mesmo carro no mesmo dia ao mesmo tempo passam pela validação da
 * action e colidem no insert. O erro cru do Postgres não diz nada a quem está
 * montando a programação.
 */
function traduzirErroBanco(error: { code?: string; message?: string } | null) {
  if (error?.code === "23505") {
    return "Este veículo acabou de ser alocado em outro destino nesta data. Recarregue a tela.";
  }
  if (error?.code === "23514") {
    return "Combinação inválida de destino, veículo e motorista.";
  }
  return error?.message ?? "Não foi possível salvar a programação.";
}

// --- Cancelamento e exclusão ---------------------------------------------

export async function cancelarProgramacao(programacaoId: string): Promise<{ erro?: string }> {
  const { usuarioId, perfil } = await exigirPermissao("programacao", "escrita");

  const linha = await carregarProgramacao(programacaoId);
  if (!linha) return { erro: "Programação não encontrada." };
  if (linha.status === "cancelada") return { erro: "Esta programação já está cancelada." };
  if (!linhaEditavel(linha.data, perfil === "admin")) {
    return { erro: "Programação de data já passada é somente leitura." };
  }

  await supabase
    .from("ProgramacaoDiaria")
    .update({
      status: "cancelada",
      // Cancelar linha publicada é uma mudança que precisa ser comunicada;
      // cancelar rascunho não, porque ninguém chegou a ser avisado dela.
      temAlteracaoPendente: linha.status === "publicada",
      atualizadoPorId: usuarioId,
      atualizadoEm: new Date().toISOString(),
    })
    .eq("id", programacaoId);

  if (linha.status === "publicada") {
    await supabase.from("AlteracaoProgramacao").insert({
      programacaoId,
      campo: "cancelamento",
      valorAnterior: destinoLegivel(linha),
      valorNovo: null,
      alteradoPorId: usuarioId,
    });
  }

  revalidar();
  return {};
}

/** Rascunho nunca comunicado pode sumir; publicada, não — vira cancelada. */
export async function excluirProgramacao(programacaoId: string): Promise<{ erro?: string }> {
  const { perfil } = await exigirPermissao("programacao", "escrita");

  const { data: linha } = await supabase
    .from("ProgramacaoDiaria")
    .select("id, status, data")
    .eq("id", programacaoId)
    .maybeSingle();

  if (!linha) return { erro: "Programação não encontrada." };
  if (linha.status !== "rascunho") {
    return {
      erro: "Programação já publicada não é excluída — cancele, para que quem foi avisado saiba.",
    };
  }
  if (!linhaEditavel(linha.data, perfil === "admin")) {
    return { erro: "Programação de data já passada é somente leitura." };
  }

  // Equipe e responsáveis saem por ON DELETE CASCADE.
  await supabase.from("ProgramacaoDiaria").delete().eq("id", programacaoId);

  revalidar();
  return {};
}

// --- Ocupação para a tela -------------------------------------------------

/**
 * Ocupação de um dia, para o painel desabilitar as opções com o motivo ao lado.
 *
 * É Server Action e não um fetch de rota própria porque o painel precisa
 * reconsultar sempre que a data muda, e é a MESMA função que a gravação usa
 * para recusar — o que a tela mostra e o que o servidor aceita não podem
 * divergir.
 */
export async function consultarOcupacao(
  data: string,
  ignorarProgramacaoId: string | null
): Promise<Ocupacao> {
  await exigirPermissao("programacao", "leitura");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return { funcionarios: {}, veiculos: {} };
  return carregarOcupacao(data, ignorarProgramacaoId);
}

// --- Publicação -----------------------------------------------------------

export async function consultarPrevia(inicio: string, fim: string): Promise<PreviaPublicacao> {
  const { usuarioId } = await exigirPermissao("programacao", "escrita");
  return montarPrevia(inicio, fim, usuarioId);
}

export async function publicarPeriodo(
  inicio: string,
  fim: string
): Promise<{ erro?: string; enviadas?: number; falhas?: number }> {
  const { usuarioId } = await exigirPermissao("programacao", "escrita");
  const resultado = await publicarNoServidor(inicio, fim, usuarioId);
  revalidar();
  return resultado;
}

export async function reenviarEnvio(envioId: string): Promise<{ erro?: string }> {
  await exigirPermissao("programacao", "escrita");
  const resultado = await reenviarAviso(envioId);
  revalidar();
  return resultado;
}

// --- Repetir semana anterior ---------------------------------------------

export type ResultadoRepeticao = {
  erro?: string;
  copiadas?: number;
  comPendencia?: string[];
};

/**
 * Copia a semana anterior para a semana em exibição — sempre como RASCUNHO.
 *
 * Nunca publica sozinho: disparo em massa tem que ser um ato consciente da
 * logística, com a prévia na frente.
 *
 * Pessoa ou veículo ocupado/indisponível na data nova é copiado FORA da linha,
 * e a linha entra no resumo de pendências. Copiar quebrando a trava é
 * inaceitável — seria gravar o conflito que o módulo existe para impedir; não
 * copiar em silêncio esconde trabalho a fazer e a logística descobre no dia.
 *
 * Feriado no meio da semana é copiado como qualquer outro dia: não há cadastro
 * de feriado no sistema, e adivinhar qual dia não vale removeria programação
 * legítima. A logística apaga o que não vale.
 */
export async function repetirSemanaAnterior(referencia: string): Promise<ResultadoRepeticao> {
  const { usuarioId } = await exigirPermissao("programacao", "escrita");

  const inicioDestino = inicioDaSemana(referencia);
  const inicioOrigem = somarDias(inicioDestino, -7);
  const fimOrigem = somarDias(inicioOrigem, 6);

  const { data: origemData } = await supabase
    .from("ProgramacaoDiaria")
    .select(
      "id, data, tipoDestino, obraId, descricaoAvulsa, veiculoId, motoristaId, servico, observacao, status, obra:Obra(id, nomeProjeto, oportunidade:Oportunidade(orcamento:Orcamento(nomeProjeto))), equipe:ProgramacaoEquipe(funcionarioId), responsaveis:ProgramacaoResponsavel(usuarioId)"
    )
    .gte("data", inicioOrigem)
    .lte("data", fimOrigem)
    // Linha cancelada não é trabalho a repetir.
    .neq("status", "cancelada")
    .order("data", { ascending: true });

  type LinhaOrigem = {
    id: string;
    data: string;
    tipoDestino: "obra" | "avulso";
    obraId: string | null;
    descricaoAvulsa: string | null;
    veiculoId: string | null;
    motoristaId: string | null;
    servico: string;
    observacao: string | null;
    obra: {
      id: string;
      nomeProjeto: string | null;
      oportunidade: { orcamento: { nomeProjeto: string } | null } | null;
    } | null;
    equipe: { funcionarioId: string }[];
    responsaveis: { usuarioId: string }[];
  };

  const origem = (origemData ?? []) as unknown as LinhaOrigem[];
  if (!origem.length) {
    return { erro: "A semana anterior não tem programação para copiar." };
  }

  const hoje = hojeIso();
  const comPendencia: string[] = [];
  let copiadas = 0;

  // A ocupação é recarregada por DIA e atualizada em memória a cada cópia:
  // duas linhas copiadas para a mesma data disputam o mesmo carro entre si, e
  // recarregar do banco a cada linha não veria a cópia anterior a tempo.
  const ocupacaoPorDia = new Map<string, Ocupacao>();

  for (const linha of origem) {
    const dataNova = somarDias(linha.data.slice(0, 10), 7);

    // Copiar para trás não faz sentido: a semana copiada já aconteceu.
    if (dataNova < hoje) continue;

    if (!ocupacaoPorDia.has(dataNova)) {
      ocupacaoPorDia.set(dataNova, await carregarOcupacao(dataNova, null));
    }
    const ocupacao = ocupacaoPorDia.get(dataNova)!;

    const equipeOriginal = linha.equipe.map((e) => e.funcionarioId);
    const equipeLivre = equipeOriginal.filter((id) => !ocupacao.funcionarios[id]);
    const perdeuGente = equipeLivre.length !== equipeOriginal.length;

    let veiculoId = linha.veiculoId;
    let motoristaId = linha.motoristaId;
    let perdeuVeiculo = false;

    if (veiculoId && ocupacao.veiculos[veiculoId]) {
      veiculoId = null;
      perdeuVeiculo = true;
    }
    // O motorista precisa continuar na equipe; e sem motorista não pode haver
    // veículo (é o CHECK do banco e a razão de ser do módulo).
    if (motoristaId && !equipeLivre.includes(motoristaId)) {
      motoristaId = null;
      veiculoId = null;
      perdeuVeiculo = true;
    }
    // Sem carro não há quem dirigir: manter alguém marcado como "motorista" de
    // nada só faria a mensagem prometer um veículo que a linha não tem.
    if (!veiculoId && motoristaId) motoristaId = null;

    const destino = destinoLegivel({
      tipoDestino: linha.tipoDestino,
      descricaoAvulsa: linha.descricaoAvulsa,
      obra: linha.obra,
    });

    const { data: criada, error } = await supabase
      .from("ProgramacaoDiaria")
      .insert({
        data: dataNova,
        tipoDestino: linha.tipoDestino,
        obraId: linha.obraId,
        descricaoAvulsa: linha.descricaoAvulsa,
        veiculoId,
        motoristaId,
        servico: linha.servico,
        observacao: linha.observacao,
        status: "rascunho",
        criadoPorId: usuarioId,
      })
      .select("id")
      .single();

    if (error || !criada) continue;

    if (equipeLivre.length) {
      await supabase
        .from("ProgramacaoEquipe")
        .insert(
          equipeLivre.map((funcionarioId) => ({ programacaoId: criada.id, funcionarioId }))
        );
    }
    if (linha.responsaveis.length) {
      await supabase.from("ProgramacaoResponsavel").insert(
        linha.responsaveis.map((r) => ({ programacaoId: criada.id, usuarioId: r.usuarioId }))
      );
    }

    // A cópia recém-criada passa a ocupar o dia para as próximas.
    for (const funcionarioId of equipeLivre) {
      ocupacao.funcionarios[funcionarioId] ??= { motivo: "já está alocado nesta cópia" };
    }
    if (veiculoId) {
      ocupacao.veiculos[veiculoId] ??= { motivo: "já está alocado nesta cópia" };
    }

    copiadas++;

    if (perdeuGente || perdeuVeiculo) {
      const faltas = [
        perdeuVeiculo ? "sem veículo/motorista" : null,
        perdeuGente ? "equipe incompleta" : null,
      ].filter(Boolean);
      comPendencia.push(`${formatarData(dataNova)} · ${destino} — ${faltas.join(" e ")}`);
    }
  }

  revalidar();
  return { copiadas, comPendencia };
}

// --- Indisponibilidades ---------------------------------------------------

const indisponibilidadeSchema = z
  .object({
    tipo: z.enum(["funcionario", "veiculo"]),
    funcionarioId: z.string().trim().optional(),
    veiculoId: z.string().trim().optional(),
    dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data inicial."),
    dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data final."),
    motivo: z.string().trim().min(1, "Diga o motivo — ele aparece no bloqueio da alocação."),
  })
  .superRefine((dados, ctx) => {
    if (dados.tipo === "funcionario" && !dados.funcionarioId) {
      ctx.addIssue({ code: "custom", message: "Escolha o funcionário." });
    }
    if (dados.tipo === "veiculo" && !dados.veiculoId) {
      ctx.addIssue({ code: "custom", message: "Escolha o veículo." });
    }
    if (dados.dataFim < dados.dataInicio) {
      ctx.addIssue({ code: "custom", message: "A data final não pode ser antes da inicial." });
    }
  });

export type EstadoFormIndisponibilidade = { erro?: string; ok?: boolean } | undefined;

export async function salvarIndisponibilidade(
  _estado: EstadoFormIndisponibilidade,
  formData: FormData
): Promise<EstadoFormIndisponibilidade> {
  const { usuarioId } = await exigirPermissao("programacao", "escrita");

  const analise = indisponibilidadeSchema.safeParse({
    tipo: String(formData.get("tipo") ?? "funcionario"),
    funcionarioId: String(formData.get("funcionarioId") ?? "").trim() || undefined,
    veiculoId: String(formData.get("veiculoId") ?? "").trim() || undefined,
    dataInicio: String(formData.get("dataInicio") ?? ""),
    dataFim: String(formData.get("dataFim") ?? ""),
    motivo: String(formData.get("motivo") ?? ""),
  });

  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const dados = analise.data;

  const { error } = await supabase.from("Indisponibilidade").insert({
    tipo: dados.tipo,
    funcionarioId: dados.tipo === "funcionario" ? (dados.funcionarioId ?? null) : null,
    veiculoId: dados.tipo === "veiculo" ? (dados.veiculoId ?? null) : null,
    dataInicio: dados.dataInicio,
    dataFim: dados.dataFim,
    motivo: dados.motivo,
    criadoPorId: usuarioId,
  });

  if (error) return { erro: error.message };

  revalidar();
  return { ok: true };
}

// Assinatura de useActionState porque toda exclusão do sistema passa pelo
// BotaoExcluir (ver components/ui/botao-excluir.tsx), que espera esse formato.
export async function excluirIndisponibilidade(
  _estado: EstadoExclusao,
  formData: FormData
): Promise<EstadoExclusao> {
  await exigirPermissao("programacao", "escrita");

  const id = String(formData.get("id") ?? "");
  if (!id) return { erro: "Registro não informado." };

  const { error } = await supabase.from("Indisponibilidade").delete().eq("id", id);
  if (error) return { erro: error.message };

  revalidar();
  return {};
}

