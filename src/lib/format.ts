export function formatarMoeda(valor: number | string) {
  const numero = typeof valor === "string" ? Number(valor) : valor;
  return numero.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatarData(data: Date | string) {
  // Colunas date/timestamp do Postgres chegam como string ("2026-08-19" ou
  // "2026-08-19T00:00:00+00:00"). Formatar via Date()+toLocaleDateString
  // converte para o fuso local e pode exibir o dia anterior (ex.: meia-noite
  // UTC vira 21h do dia anterior em UTC-3). Como os 10 primeiros
  // caracteres já são o "YYYY-MM-DD" pretendido, extrai direto da string.
  if (typeof data === "string") {
    const [ano, mes, dia] = data.slice(0, 10).split("-");
    return `${dia}/${mes}/${ano}`;
  }
  return data.toLocaleDateString("pt-BR");
}

// Ao contrário de formatarData, aqui o instante importa (hora da mensagem),
// então converte de verdade em vez de fatiar a string ISO. Renderizado em
// Server Component, usa o fuso do servidor.
export function formatarDataHora(data: Date | string) {
  const instante = typeof data === "string" ? new Date(data) : data;
  return instante.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
