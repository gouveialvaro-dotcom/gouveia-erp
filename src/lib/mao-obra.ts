export const DIAS_UTEIS_MES_PADRAO = 22;

// Custo diário de uma função: salário mensal rateado pelos dias úteis do mês e
// acrescido dos encargos do próprio cadastro. Fonte única usada no cadastro de
// funções, no cadastro de funcionários e na alocação de mão de obra em
// orçamentos, para que as três telas nunca mostrem números diferentes.
//
// Serve tanto para uma Funcao quanto para um Funcionario: a pessoa herda o
// custo da função, mas pode ter salário próprio (alguém acima do piso).
export function custoDiarioMaoObra(
  custo: { salarioMensal: number; encargosPercent: number },
  diasUteisMes: number = DIAS_UTEIS_MES_PADRAO
) {
  return (custo.salarioMensal / diasUteisMes) * (1 + custo.encargosPercent / 100);
}

// Custo mensal cheio (salário + encargos). É o "custo total" da planilha de
// mão de obra da empresa.
export function custoMensalMaoObra(custo: {
  salarioMensal: number;
  encargosPercent: number;
}) {
  return custo.salarioMensal * (1 + custo.encargosPercent / 100);
}
