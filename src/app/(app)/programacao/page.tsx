import { supabase } from "@/lib/supabase";
import { acessoModulo, usuarioIdAtual } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { hojeIso } from "@/lib/pos-venda";
import {
  agrupamentoValido,
  descricaoVeiculo,
  diasDoIntervalo,
  escopoValido,
  intervaloDoEscopo,
} from "@/lib/programacao";
import {
  carregarProgramacoes,
  destinoLegivel,
  montarPrevia,
} from "@/lib/programacao-servidor";
import { projetoDaObra } from "@/lib/obras";
import { GradeProgramacao, type LinhaGrade } from "@/components/programacao/grade";

export default async function PaginaProgramacao({
  searchParams,
}: {
  searchParams: Promise<{ escopo?: string; ref?: string; agrupamento?: string }>;
}) {
  const { perfil } = await acessoModulo("programacao");
  const podeEditar = podeEscrever(perfil, "programacao");

  const parametros = await searchParams;
  const escopo = escopoValido(parametros.escopo);
  const agrupamento = agrupamentoValido(parametros.agrupamento);
  // A referência é sempre string "YYYY-MM-DD": virar Date local deslocaria o
  // dia em fuso negativo e a grade abriria no dia errado (ver lib/programacao).
  const referencia = /^\d{4}-\d{2}-\d{2}$/.test(parametros.ref ?? "")
    ? (parametros.ref as string)
    : hojeIso();

  const { inicio, fim } = intervaloDoEscopo(escopo, referencia);

  const [programacoes, { data: veiculosData }, { data: funcionariosData }, { data: usuariosData }, { data: obrasData }] =
    await Promise.all([
      carregarProgramacoes(inicio, fim),
      supabase
        .from("Veiculo")
        .select("id, modelo, placa, identificacao")
        .eq("ativo", true)
        .order("modelo"),
      supabase
        .from("Funcionario")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome"),
      supabase.from("Usuario").select("id, nome").eq("ativo", true).order("nome"),
      supabase
        .from("Obra")
        .select(
          "id, nomeProjeto, status, oportunidade:Oportunidade(orcamento:Orcamento(nomeProjeto))"
        )
        .neq("status", "concluida"),
    ]);

  const linhas: LinhaGrade[] = programacoes.map((linha) => ({
    id: linha.id,
    data: linha.data.slice(0, 10),
    tipoDestino: linha.tipoDestino,
    obraId: linha.obraId,
    descricaoAvulsa: linha.descricaoAvulsa,
    destino: destinoLegivel(linha),
    servico: linha.servico,
    observacao: linha.observacao,
    veiculoId: linha.veiculoId,
    veiculoTexto: descricaoVeiculo(linha.veiculo),
    motoristaId: linha.motoristaId,
    motoristaNome: linha.motorista?.nome ?? null,
    equipeIds: linha.equipe.map((e) => e.funcionarioId),
    equipeNomes: linha.equipe.map((e) => e.funcionario?.nome ?? "—"),
    responsavelIds: linha.responsaveis.map((r) => r.usuarioId),
    responsavelNomes: linha.responsaveis.map((r) => r.usuario?.nome ?? "—"),
    status: linha.status,
    temAlteracaoPendente: linha.temAlteracaoPendente,
  }));

  // A faixa de pendências mostra quantas pessoas SERÃO avisadas, e não quantas
  // linhas mudaram: é o número que faz a logística pensar duas vezes antes de
  // publicar. Sai da mesma função que monta a prévia do modal, para os dois
  // nunca discordarem.
  let pendentes = 0;
  let destinatariosPrevistos = 0;
  if (podeEditar) {
    const usuarioId = await usuarioIdAtual();
    const previa = await montarPrevia(inicio, fim, usuarioId);
    pendentes = previa.pendencias.length;
    destinatariosPrevistos = previa.totalMensagens;
  }

  return (
    <GradeProgramacao
      escopo={escopo}
      referencia={referencia}
      agrupamento={agrupamento}
      dias={diasDoIntervalo(inicio, fim)}
      inicio={inicio}
      fim={fim}
      linhas={linhas}
      podeEditar={podeEditar}
      // Só o admin corrige o que já passou; para os demais, a linha de data
      // anterior a hoje é somente leitura — na tela e na Server Action.
      ehAdmin={perfil === "admin"}
      pendentes={pendentes}
      destinatariosPrevistos={destinatariosPrevistos}
      opcoes={{
        obras: (obrasData ?? []).map((obra) => ({
          id: obra.id,
          nome: projetoDaObra(obra),
        })),
        veiculos: (veiculosData ?? []).map((veiculo) => ({
          id: veiculo.id,
          nome: descricaoVeiculo(veiculo) ?? veiculo.placa,
        })),
        funcionarios: (funcionariosData ?? []).map((f) => ({ id: f.id, nome: f.nome })),
        usuarios: (usuariosData ?? []).map((u) => ({ id: u.id, nome: u.nome })),
      }}
    />
  );
}
