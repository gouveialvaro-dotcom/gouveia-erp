import bcrypt from "bcryptjs";
import { supabase } from "../src/lib/supabase";
import type { Database } from "../src/lib/database.types";

type PerfilUsuario = Database["public"]["Enums"]["PerfilUsuario"];

const TEXTO_IMPOSTOS_PADRAO = `ISS: Incluso em todas as notas fiscais de serviços, alíquota conforme legislação em vigor (5%);
ICMS: Considerado alíquota de 18%;
PIS/COFINS: Consideramos 0,65% de PIS e 3% de COFINS;
IRPJ / CSLL: Considerado 11%;
INSS: Considerado alíquota de 11%;
Empresa optante do Simples Nacional.`;

async function upsertUsuario(nome: string, email: string, senhaHash: string, perfil: PerfilUsuario) {
  const { data } = await supabase
    .from("Usuario")
    .upsert({ nome, email, senhaHash, perfil }, { onConflict: "email" })
    .select()
    .single();
  return data!;
}

async function main() {
  const senhaHash = await bcrypt.hash("Senha123!", 10);

  const admin = await upsertUsuario("Álvaro Gouveia", "admin@gouveiaengenharia.com.br", senhaHash, "admin");
  const comercial = await upsertUsuario("Carla Mendes", "comercial@gouveiaengenharia.com.br", senhaHash, "comercial");
  const engenharia = await upsertUsuario("Francisco Thiago", "engenharia@gouveiaengenharia.com.br", senhaHash, "engenharia");
  await upsertUsuario("Roberto Silva", "obra@gouveiaengenharia.com.br", senhaHash, "obra");

  const { data: parametroExistente } = await supabase.from("ParametroGeral").select("id").limit(1).maybeSingle();
  if (!parametroExistente) {
    await supabase.from("ParametroGeral").insert({
      bdiPadrao: 25,
      encargosSociais: 80,
      impostos: 6,
      margemMinima: 15,
      validadePropostaPadraoDias: 15,
      textoImpostosPadrao: TEXTO_IMPOSTOS_PADRAO,
      diasUteisMes: 22,
      atualizadoPorId: admin.id,
    });
  }

  // Contrato de manutenção de um ano a partir de hoje: sem vigência ativa o
  // pós-venda recusa abrir chamado do cliente solar.
  const hoje = new Date().toISOString().slice(0, 10);
  const daquiUmAno = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);

  const clientesSeed = [
    {
      razaoSocial: "Smartfit Academias Ltda",
      cnpj: "12.345.678/0001-90",
      ramo: "energia_solar" as const,
      contato: "Filipe Linhares",
      telefone: "(84) 99999-0001",
      email: "filipe.linhares@smartfit.com.br",
      manutencaoInicio: hoje,
      manutencaoFim: daquiUmAno,
    },
    {
      razaoSocial: "Enel Green Power Brasil S.A.",
      cnpj: "23.456.789/0001-01",
      ramo: "redes_subestacoes" as const,
      endereco: "Rod. BR-304, km 12",
      cidade: "Mossoró",
      uf: "RN",
      contato: "Marina Costa",
      telefone: "(84) 99999-0002",
      email: "marina.costa@enel.com",
    },
    {
      razaoSocial: "Casa dos Ventos Energias Renováveis S.A.",
      cnpj: "34.567.890/0001-12",
      ramo: "redes_subestacoes" as const,
      endereco: "Rua do Sol, 200",
      cidade: "João Câmara",
      uf: "RN",
      contato: "Roberto Almeida",
      telefone: "(84) 99999-0003",
      email: "roberto.almeida@casadosventos.com.br",
    },
  ];

  const clientesCriados = [];
  for (const cliente of clientesSeed) {
    const { data: clienteCriado } = await supabase
      .from("Cliente")
      .upsert({ ...cliente, criadoPorId: comercial.id }, { onConflict: "cnpj" })
      .select()
      .single();
    clientesCriados.push(clienteCriado);
  }

  const materiaisSeed = [
    { codigo: "MAT-001", descricao: "Poste de concreto DT 11/600", categoria: "Estrutura", unidade: "un", custoUnitario: 850 },
    { codigo: "MAT-002", descricao: "Chave fusível 15kV 100A", categoria: "Proteção", unidade: "un", custoUnitario: 320 },
    { codigo: "MAT-003", descricao: "Para-raios de distribuição 15kV", categoria: "Proteção", unidade: "un", custoUnitario: 180 },
    { codigo: "MAT-004", descricao: "Isolador de disco de vidro", categoria: "Isolação", unidade: "un", custoUnitario: 45 },
    { codigo: "MAT-005", descricao: "Cabo de cobre 0,6/1kV 3#70mm² + 1#35mm²", categoria: "Cabeamento", unidade: "m", custoUnitario: 62 },
    { codigo: "MAT-006", descricao: "Disjuntor termomagnético tripolar 350A", categoria: "Proteção", unidade: "un", custoUnitario: 1250 },
    { codigo: "MAT-007", descricao: "Caixa metálica de medição padrão COSERN 1500x1300x400mm", categoria: "Medição", unidade: "un", custoUnitario: 2100 },
    { codigo: "MAT-008", descricao: "Haste de aterramento 5/8\" x 2,40m", categoria: "Aterramento", unidade: "un", custoUnitario: 38 },
    { codigo: "MAT-009", descricao: "Cabo de aço cobreado 2AWG", categoria: "Aterramento", unidade: "m", custoUnitario: 22 },
    { codigo: "MAT-010", descricao: "Eletroduto FºGº 2x2\"", categoria: "Infraestrutura", unidade: "m", custoUnitario: 55 },
  ];

  const { data: materiais } = await supabase
    .from("Material")
    .upsert(
      materiaisSeed.map((m) => ({ ...m, fornecedor: "Distribuidora Elétrica RN", criadoPorId: engenharia.id })),
      { onConflict: "codigo" }
    )
    .select()
    .order("codigo", { ascending: true });

  const { data: kitExistente } = await supabase
    .from("Kit")
    .select("id")
    .eq("nome", "Subestação Aérea 225kVA (CE3-TT)")
    .maybeSingle();

  if (!kitExistente && materiais) {
    const { data: kitCriado } = await supabase
      .from("Kit")
      .insert({ nome: "Subestação Aérea 225kVA (CE3-TT)", categoria: "Subestações", criadoPorId: engenharia.id })
      .select()
      .single();

    if (kitCriado) {
      const quantidades = [1, 3, 3, 12, 15, 1, 1, 4, 12, 8];
      await supabase.from("KitItem").insert(
        materiais.map((material, i) => ({
          kitId: kitCriado.id,
          materialId: material.id,
          quantidade: quantidades[i],
        }))
      );
    }
  }

  // O catálogo de mão de obra vem da planilha de custo real da empresa:
  // rode `npx tsx --env-file=.env scripts/importar-funcoes.ts`.
  const descricoesSeed = [
    {
      nome: "Usina Solar · Geração distribuída (telhado/solo)",
      tipoProposta: "usina_solar" as const,
      texto: "Implantação de usina solar fotovoltaica para geração distribuída, com fornecimento e instalação de módulos e inversores, estruturas de fixação, cabeamento CC/CA, proteções elétricas e sistema de monitoramento remoto, visando compensação de energia junto à concessionária local.",
    },
    {
      nome: "Usina Solar · Geração centralizada (usina própria)",
      tipoProposta: "usina_solar" as const,
      texto: "Implantação de usina solar fotovoltaica de geração centralizada, com fornecimento e instalação de módulos, inversores centrais/string, estruturas metálicas, cabeamento CC/CA, subestação elevadora e sistema de monitoramento remoto.",
    },
    {
      nome: "Redes · Subestação abaixadora",
      tipoProposta: "redes" as const,
      texto: "Projeto e execução de subestação abaixadora, incluindo regularização junto à concessionária local, fornecimento e montagem de estrutura, equipamentos de proteção e medição, e sistema de aterramento conforme normas técnicas vigentes.",
    },
    {
      nome: "Redes · Linha de transmissão",
      tipoProposta: "redes" as const,
      texto: "Projeto e execução de linha de transmissão em alta tensão, incluindo fornecimento de estruturas, cabos condutores, isoladores e ferragens, montagem eletromecânica e comissionamento.",
    },
  ];

  for (const d of descricoesSeed) {
    const { data: existente } = await supabase.from("DescricaoPadrao").select("id").eq("nome", d.nome).maybeSingle();
    if (!existente) {
      await supabase.from("DescricaoPadrao").insert({ ...d, criadoPorId: engenharia.id });
    }
  }

  console.log("Seed concluído.");
  console.log({ clientes: clientesCriados.map((c) => c?.razaoSocial) });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
