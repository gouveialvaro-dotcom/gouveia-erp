import extenso from "extenso";
import { formatarData, formatarMoeda } from "@/lib/format";
import { ROTULO_MODELO, formatarNumeroProposta, type DadosProposta } from "@/lib/proposta";

// O documento é montado como string de HTML com estilos inline em vez de JSX:
// a mesma marcação alimenta a página de impressão (PDF pelo navegador) e a rota
// que devolve o arquivo .doc — e route handlers do Next não podem importar
// `react-dom/server` para serializar um componente.

function esc(valor: unknown) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const CINZA = "#666666";
const BORDA = "1px solid #cccccc";

const PAGINA = `font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#111111;line-height:1.5;max-width:760px;margin:0 auto;padding:24px`;
const TITULO_SECAO = `font-size:12pt;font-weight:bold;text-transform:uppercase;border-bottom:2px solid #111111;padding-bottom:4px;margin:28px 0 12px`;
const TD = `border:${BORDA};padding:6px 8px;font-size:10pt`;
const TD_DIR = `${TD};text-align:right`;
const TD_LIMPO = `padding:6px 8px;font-size:10pt`;

function porExtenso(valor: number) {
  try {
    return extenso(Number(valor.toFixed(2)), {
      mode: "currency",
      currency: { code: "BRL" },
    });
  } catch {
    return null;
  }
}

export function construirHtmlProposta(dados: DadosProposta) {
  const { proposta, orcamento, complementares, parametros, totais } = dados;
  const cliente = orcamento.cliente;
  const extensoValor = porExtenso(proposta.valorFinal);

  const validadeDias =
    complementares?.validadePropostaDias ?? parametros?.validadePropostaPadraoDias ?? null;
  const textoImpostos = complementares?.textoImpostos ?? parametros?.textoImpostosPadrao ?? null;
  const endereco =
    [cliente?.endereco, cliente?.cidade, cliente?.uf].filter(Boolean).join(" — ") || "—";

  // O documento é voltado ao cliente: a composição de custos (materiais, mão de
  // obra, BDI, impostos) fica só no sistema, na aba Resumo de custos. Aqui vai o
  // que descreve o serviço e o preço fechado.
  const descricaoServicos = complementares?.escopoTecnico ?? orcamento.descricao ?? null;

  const secaoDescricao = descricaoServicos
    ? `<h2 style="${TITULO_SECAO}">3. Descrição dos serviços</h2>
  <p style="margin:0;text-align:justify;white-space:pre-wrap">${esc(descricaoServicos)}</p>`
    : "";

  const secaoObservacoes = complementares?.observacoesFinais
    ? `<h2 style="${TITULO_SECAO}">6. Observações</h2>
  <p style="margin:0;text-align:justify;white-space:pre-wrap">${esc(complementares.observacoesFinais)}</p>`
    : "";

  return `<div style="${PAGINA}">
  <header style="border-bottom:3px solid #111111;padding-bottom:12px">
    <div style="font-size:16pt;font-weight:bold">Gouveia Engenharia</div>
    <div style="font-size:10pt;color:${CINZA}">Proposta Comercial · ${esc(
      ROTULO_MODELO[proposta.modeloUsado] ?? proposta.modeloUsado
    )}</div>
  </header>

  <table style="width:100%;border-collapse:collapse;margin-top:12px"><tbody><tr>
    <td style="${TD_LIMPO};padding-left:0"><strong>Proposta nº</strong> ${esc(
      formatarNumeroProposta(proposta.numero, proposta.ano, proposta.revisao)
    )}</td>
    <td style="${TD_LIMPO};text-align:right;padding-right:0"><strong>Data:</strong> ${esc(
      formatarData(proposta.geradoEm)
    )}</td>
  </tr></tbody></table>

  <h2 style="${TITULO_SECAO}">1. Destinatário</h2>
  <table style="width:100%;border-collapse:collapse"><tbody>
    <tr><td style="${TD_LIMPO};padding-left:0;width:120px"><strong>Cliente</strong></td><td style="${TD_LIMPO}">${esc(
      cliente?.razaoSocial ?? "—"
    )}</td></tr>
    <tr><td style="${TD_LIMPO};padding-left:0"><strong>CNPJ</strong></td><td style="${TD_LIMPO}">${esc(
      cliente?.cnpj ?? "—"
    )}</td></tr>
    <tr><td style="${TD_LIMPO};padding-left:0"><strong>Endereço</strong></td><td style="${TD_LIMPO}">${esc(
      endereco
    )}</td></tr>
  </tbody></table>

  <h2 style="${TITULO_SECAO}">2. Objeto</h2>
  <p style="margin:0 0 8px"><strong>${esc(orcamento.nomeProjeto)}</strong></p>
  ${
    // Sem resumo próprio cadastrado, o texto fica só na seção 3 — repetir o
    // mesmo parágrafo duas vezes seguidas polui o documento.
    complementares?.objetoResumo
      ? `<p style="margin:0;text-align:justify">${esc(complementares.objetoResumo)}</p>`
      : ""
  }
  ${
    complementares?.cidadeExecucao
      ? `<p style="margin:8px 0 0;font-size:10pt;color:${CINZA}">Local de execução: ${esc(
          complementares.cidadeExecucao
        )}${complementares.ufExecucao ? ` / ${esc(complementares.ufExecucao)}` : ""}</p>`
      : ""
  }

  ${secaoDescricao}

  <h2 style="${TITULO_SECAO}">4. Valor da proposta</h2>
  <table style="width:100%;border-collapse:collapse"><tbody>
    ${
      totais.percentualDesconto > 0
        ? `<tr><td style="${TD}">Valor dos serviços</td><td style="${TD_DIR}">${esc(
            formatarMoeda(totais.subtotal)
          )}</td></tr>
    <tr><td style="${TD}"><strong>Desconto concedido (${esc(
      totais.percentualDesconto
    )}%)</strong></td><td style="${TD_DIR}"><strong>− ${esc(
            formatarMoeda(totais.valorDesconto)
          )}</strong></td></tr>`
        : ""
    }
    <tr>
      <td style="${TD};background-color:#f2f2f2;font-size:12pt"><strong>VALOR TOTAL DA PROPOSTA</strong></td>
      <td style="${TD_DIR};background-color:#f2f2f2;font-size:12pt"><strong>${esc(
        formatarMoeda(proposta.valorFinal)
      )}</strong></td>
    </tr>
  </tbody></table>
  ${
    extensoValor
      ? `<p style="margin:8px 0 0;font-size:10pt;font-style:italic">(${esc(extensoValor)})</p>`
      : ""
  }
  <p style="margin:8px 0 0;font-size:10pt;color:${CINZA}">
    Valor global, incluindo fornecimento de materiais, mão de obra, encargos, tributos e demais
    custos necessários à execução dos serviços descritos.
  </p>

  <h2 style="${TITULO_SECAO}">5. Condições comerciais</h2>
  <table style="width:100%;border-collapse:collapse"><tbody>
    <tr><td style="${TD};width:200px"><strong>Prazo de execução</strong></td><td style="${TD}">${
      complementares?.prazoExecucaoDias
        ? `${esc(complementares.prazoExecucaoDias)} dias`
        : "A definir"
    }</td></tr>
    <tr><td style="${TD}"><strong>Condições de pagamento</strong></td><td style="${TD}">${esc(
      complementares?.condicoesPagamento ?? "A definir"
    )}</td></tr>
    <tr><td style="${TD}"><strong>Validade da proposta</strong></td><td style="${TD}">${
      validadeDias ? `${esc(validadeDias)} dias a contar da data de emissão` : "A definir"
    }</td></tr>
  </tbody></table>
  ${
    textoImpostos
      ? `<p style="margin-top:12px;font-size:10pt;text-align:justify;white-space:pre-wrap">${esc(
          textoImpostos
        )}</p>`
      : ""
  }

  ${secaoObservacoes}

  <div style="margin-top:56px;text-align:center">
    <div style="border-top:1px solid #111111;width:280px;margin:0 auto;padding-top:6px">${esc(
      proposta.geradoPor?.nome ?? ""
    )}</div>
    <div style="font-size:10pt;color:${CINZA}">Gouveia Engenharia</div>
  </div>
</div>`;
}
