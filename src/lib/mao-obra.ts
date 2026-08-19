export const DIAS_UTEIS_MES_PADRAO = 22;

// Custo diário de um funcionário: salário mensal rateado pelos dias úteis do mês
// e acrescido dos encargos do próprio cadastro. Fonte única usada no cadastro de
// funcionários e na alocação de mão de obra em orçamentos, para que as duas
// telas nunca mostrem números diferentes.
export function custoDiarioFuncionario(
  funcionario: { salarioMensal: number; encargosPercent: number },
  diasUteisMes: number = DIAS_UTEIS_MES_PADRAO
) {
  return (funcionario.salarioMensal / diasUteisMes) * (1 + funcionario.encargosPercent / 100);
}
