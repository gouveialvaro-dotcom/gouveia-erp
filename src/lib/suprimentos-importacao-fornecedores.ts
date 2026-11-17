import { UFS, chaveDescricao, documentoValido, normalizarCnpj } from "@/lib/suprimentos";

// Leitura da planilha de fornecedores exportada do Conta Azul. Roda no
// navegador (prévia); o servidor revalida antes de gravar.
//
// Formato: separado por ";", campos entre aspas (podem ter quebra de linha),
// cabeçalho "Nome;Razão Social;CNPJ;CPF;...;Estado;Cidade;Endereço;...".
// A tabela Fornecedor não tem endereço nem inscrição estadual: esses dados vão
// para as observações, para não se perderem.

export type LinhaFornecedor = {
  razaoSocial: string;
  nomeFantasia?: string;
  /** CNPJ ou CPF, só dígitos. */
  documento?: string;
  uf?: string;
  cidade?: string;
  vendedor?: string;
  telefone?: string;
  email?: string;
  observacoes?: string;
  ativo: boolean;
};

export type LeituraFornecedores = {
  linhas: LinhaFornecedor[];
  /** Linhas com CNPJ/CPF que não passou na conferência dos dígitos (entram sem documento). */
  documentoInvalido: string[];
  /** Mesmo CNPJ/CPF (ou, sem documento, mesmo nome) repetido no arquivo: vale a primeira linha. */
  repetidos: number;
  semNome: number;
};

/** Divide o arquivo inteiro em registros, respeitando aspas e quebras de linha dentro delas. */
function registrosCsv(texto: string) {
  const registros: string[][] = [];
  let registro: string[] = [];
  let campo = "";
  let entreAspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else entreAspas = false;
      } else campo += c;
    } else if (c === '"') entreAspas = true;
    else if (c === ";") {
      registro.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      registro.push(campo);
      registros.push(registro);
      registro = [];
      campo = "";
    } else campo += c;
  }
  if (campo || registro.length) {
    registro.push(campo);
    registros.push(registro);
  }
  return registros
    .map((r) => r.map((c) => c.replace(/\s+/g, " ").trim()))
    .filter((r) => r.some((c) => c !== ""));
}

/** Compara nomes ignorando acento, caixa e pontuação ("LTDA." = "LTDA"). */
const chaveNome = (nome: string) => chaveDescricao(nome).replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim();

/** Chave usada para achar fornecedor sem documento já cadastrado. */
export function chaveFornecedor(razaoSocial: string) {
  return chaveNome(razaoSocial);
}

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const vazioOuNd = (v: string) => !v || /^(N\/?D|NAO DECLARADO|ISENTO)$/i.test(v);

export function lerCsvFornecedores(texto: string): LeituraFornecedores {
  const registros = registrosCsv(texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto);
  if (registros.length === 0) throw new Error("O arquivo está vazio.");

  const cabecalho = registros[0].map((c) => chaveNome(c));
  const coluna = (...nomes: string[]) => cabecalho.findIndex((c) => nomes.includes(c));
  const idx = {
    nome: coluna("NOME"),
    razao: coluna("RAZAO SOCIAL"),
    cnpj: coluna("CNPJ"),
    cpf: coluna("CPF"),
    obs: coluna("OBSERVACOES"),
    status: coluna("STATUS"),
    ie: coluna("INSCRICAO ESTADUAL"),
    email: coluna("EMAIL PRINCIPAL", "EMAIL"),
    emailContato: coluna("EMAIL CONTATO"),
    telefone: coluna("TELEFONE PRINCIPAL", "TELEFONE"),
    cep: coluna("CEP"),
    uf: coluna("ESTADO", "UF"),
    cidade: coluna("CIDADE"),
    endereco: coluna("ENDERECO"),
    numero: coluna("NUMERO"),
    bairro: coluna("BAIRRO"),
    complemento: coluna("COMPLEMENTO"),
    contato: coluna("NOME CONTATO"),
  };
  if (idx.nome < 0 && idx.razao < 0) {
    throw new Error(
      'O arquivo não parece a planilha de fornecedores do Conta Azul (falta a coluna "Nome" ou "Razão Social").'
    );
  }

  const leitura: LeituraFornecedores = { linhas: [], documentoInvalido: [], repetidos: 0, semNome: 0 };
  const documentosVistos = new Set<string>();

  for (const campos of registros.slice(1)) {
    const v = (i: number) => (i >= 0 ? (campos[i] ?? "") : "");
    const nome = v(idx.nome);
    const razao = v(idx.razao) || nome;
    if (razao.length < 2) {
      leitura.semNome++;
      continue;
    }

    let documento = normalizarCnpj(v(idx.cnpj) || v(idx.cpf)) || undefined;
    if (documento && !documentoValido(documento)) {
      leitura.documentoInvalido.push(`${razao} (${v(idx.cnpj) || v(idx.cpf)})`);
      documento = undefined;
    }
    // Sem documento, o nome é a chave de duplicidade.
    const chave = documento ?? `nome:${chaveNome(razao)}`;
    if (documentosVistos.has(chave)) {
      leitura.repetidos++;
      continue;
    }
    documentosVistos.add(chave);

    const uf = v(idx.uf).toUpperCase();
    const email = [v(idx.email), v(idx.emailContato)]
      .map((e) => e.toLowerCase())
      .find((e) => RE_EMAIL.test(e));

    // "Nome Contato" no export costuma ser o próprio nome cortado; só vale
    // como vendedor quando é outra coisa.
    const contato = v(idx.contato);
    const vendedor =
      contato && !chaveNome(nome).startsWith(chaveNome(contato)) && !chaveNome(razao).startsWith(chaveNome(contato))
        ? contato
        : undefined;

    const endereco = [
      [v(idx.endereco), v(idx.numero)].filter(Boolean).join(", "),
      v(idx.bairro),
      v(idx.complemento),
    ]
      .filter(Boolean)
      .join(" - ");
    const ie = v(idx.ie);
    const observacoes = [
      v(idx.obs),
      vazioOuNd(ie) ? "" : `IE ${ie}`,
      endereco,
      v(idx.cep) ? `CEP ${v(idx.cep)}` : "",
    ]
      .filter(Boolean)
      .join(" · ");

    const status = chaveNome(v(idx.status));
    leitura.linhas.push({
      razaoSocial: razao.slice(0, 200),
      nomeFantasia: nome && chaveNome(nome) !== chaveNome(razao) ? nome.slice(0, 200) : undefined,
      documento,
      uf: (UFS as readonly string[]).includes(uf) ? uf : undefined,
      cidade: v(idx.cidade).slice(0, 100) || undefined,
      vendedor: vendedor?.slice(0, 100),
      telefone: v(idx.telefone).slice(0, 40) || undefined,
      email,
      observacoes: observacoes.slice(0, 1000) || undefined,
      ativo: !status || !/^(DESATIVADO|INATIVO|INATIVADO)$/.test(status),
    });
  }
  return leitura;
}
