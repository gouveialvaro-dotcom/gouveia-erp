/**
 * Importa o catálogo de funções (custo de mão de obra) a partir da planilha
 * "planilha de custo de mão de obra.pdf".
 *
 * A planilha traz, por função: salário total (base + adicional de 30%) e o
 * custo total mensal já com FGTS, refeição, vale-transporte, provisões de
 * férias/terço/13º, plano de saúde, PLR e cesta do sindicato.
 *
 * O cadastro de Funcao guarda salário mensal + encargos em percentual,
 * então o percentual é derivado para que
 *   salarioMensal * (1 + encargosPercent/100) === custoTotal da planilha.
 * Assim o custo/dia mostrado no sistema (custoTotal / diasUteisMes) bate com
 * a planilha.
 *
 * Idempotente: atualiza a função se ela já existir (casada pelo nome).
 *
 * Rodar com: npx tsx --env-file=.env scripts/importar-funcoes.ts
 */
import { supabase } from "../src/lib/supabase";

type LinhaPlanilha = {
  funcao: string;
  /** Coluna "SALÁRIO TOTAL" (salário base novo + adicional 30%). */
  salarioTotal: number;
  /** Coluna "CUSTO TOTAL" (salário + todos os encargos e benefícios). */
  custoTotal: number;
};

const PLANILHA: LinhaPlanilha[] = [
  { funcao: "Ajudante", salarioTotal: 1611.0, custoTotal: 3954.8 },
  { funcao: "ASG", salarioTotal: 1611.0, custoTotal: 3955.8 },
  { funcao: "Pedreiro", salarioTotal: 2013.75, custoTotal: 4468.08 },
  { funcao: "Auxiliar de Almoxarifado", salarioTotal: 1737.88, custoTotal: 4116.5 },
  { funcao: "Operador de Retroescavadeira", salarioTotal: 2770.3, custoTotal: 5432.26 },
  { funcao: "Operador de Munk", salarioTotal: 2770.3, custoTotal: 5432.26 },
  { funcao: "Operador de Rolo Compactador", salarioTotal: 2770.3, custoTotal: 5432.26 },
  { funcao: "Operador de Caminhão Melosa", salarioTotal: 3601.39, custoTotal: 6491.44 },
  { funcao: "Sinaleiro", salarioTotal: 1939.04, custoTotal: 4372.87 },
  { funcao: "Almoxarife", salarioTotal: 2915.05, custoTotal: 6366.74 },
  { funcao: "Eletricista Montador", salarioTotal: 3615.96, custoTotal: 7260.01 },
  { funcao: "Eletricista FC", salarioTotal: 4584.5, custoTotal: 8494.36 },
  { funcao: "Eletricista", salarioTotal: 3007.51, custoTotal: 5734.57 },
  { funcao: "Operador de PTA", salarioTotal: 2770.3, custoTotal: 5432.26 },
  { funcao: "Operador de Mini Rolo Compactador", salarioTotal: 2770.3, custoTotal: 5432.26 },
  { funcao: "Operador de Caminhão Munk", salarioTotal: 2770.3, custoTotal: 5432.26 },
  { funcao: "Operador de Caminhão Pipa", salarioTotal: 2359.88, custoTotal: 4909.2 },
  { funcao: "Motorista de Jipe 12 Lugares", salarioTotal: 1939.04, custoTotal: 4372.87 },
  { funcao: "Motorista Caminhão Caveirão", salarioTotal: 2440.0, custoTotal: 5011.31 },
  { funcao: "Operador de Manipulador Telescópico (Manitou)", salarioTotal: 3368.82, custoTotal: 6195.04 },
  { funcao: "Encarregado", salarioTotal: 4058.97, custoTotal: 7074.6 },
  { funcao: "Líder de Turma", salarioTotal: 2416.05, custoTotal: 4980.79 },
  { funcao: "Supervisor de Campo", salarioTotal: 2416.05, custoTotal: 4980.79 },
  { funcao: "Encarregado de Elétrica", salarioTotal: 8450.0, custoTotal: 13420.72 },
  { funcao: "Encarregado de Mecânica", salarioTotal: 8450.0, custoTotal: 13420.72 },
  { funcao: "Montador Mecânico", salarioTotal: 2781.51, custoTotal: 6196.55 },
  // "Equipe de Cravação" e "Equipe de Topografia" da planilha ficam de fora:
  // elas não têm salário, só PLR + cesta do sindicato, então não dá para
  // derivar um custo/dia de colaborador a partir delas.
  { funcao: "Eng. ou Téc. Seg. do Trabalho", salarioTotal: 4800.0, custoTotal: 8769.0 },
  { funcao: "Técnico de Qualidade", salarioTotal: 4800.0, custoTotal: 8769.0 },
  { funcao: "Auxiliar de ADM", salarioTotal: 2700.0, custoTotal: 5342.67 },
  { funcao: "Coordenador de RH", salarioTotal: 5000.0, custoTotal: 8273.89 },
  { funcao: "Auxiliar de RH", salarioTotal: 2700.0, custoTotal: 5342.67 },
  { funcao: "Administrativo / RH", salarioTotal: 4800.0, custoTotal: 8769.0 },
  { funcao: "Planejador", salarioTotal: 13693.5, custoTotal: 19353.27 },
];

function converter({ funcao, salarioTotal, custoTotal }: LinhaPlanilha) {
  const salarioMensal = salarioTotal;
  const encargosPercent =
    Math.round((custoTotal / salarioTotal - 1) * 1_000_000) / 10_000;
  return { nome: funcao, salarioMensal, encargosPercent };
}

async function main() {
  const { data: admin } = await supabase
    .from("Usuario")
    .select("id")
    .eq("perfil", "admin")
    .limit(1)
    .maybeSingle();

  let inseridos = 0;
  let atualizados = 0;

  for (const linha of PLANILHA) {
    const registro = converter(linha);
    const { data: existente } = await supabase
      .from("Funcao")
      .select("id")
      .eq("nome", registro.nome)
      .maybeSingle();

    if (existente) {
      // `ativo` fica de fora do update: rodar o script após um reajuste não
      // pode ressuscitar uma função que alguém desativou de propósito.
      const { error } = await supabase
        .from("Funcao")
        .update({ ...registro, atualizadoEm: new Date().toISOString() })
        .eq("id", existente.id);
      if (error) throw error;
      atualizados++;
    } else {
      const { error } = await supabase
        .from("Funcao")
        .insert({ ...registro, criadoPorId: admin?.id ?? null });
      if (error) throw error;
      inseridos++;
    }
  }

  console.log(`Funções importadas: ${inseridos} inseridas, ${atualizados} atualizadas.`);
}

main();
