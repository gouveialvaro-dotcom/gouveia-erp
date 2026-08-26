# Gouveia Engenharia — Sistema de Gestão Interna

> Documento de contexto do projeto, para uso como base de conhecimento em um
> Projeto do Claude. Descreve o que o sistema faz, como está construído, quais
> são as regras de negócio e as convenções que qualquer alteração deve seguir.
>
> Última atualização: 21/08/2026 · Versão do app: 0.1 (Fase 1 — MVP)

---

## 1. O que é

ERP interno da **Gouveia Engenharia**, empresa que atua em dois ramos:

- **Energia solar** — usinas fotovoltaicas, com unidades consumidoras
  (geradora/beneficiárias), plano de manutenção e pós-venda.
- **Redes e subestações** — obras elétricas, com cadastro mais simples.

O sistema cobre o ciclo comercial e operacional completo:

```
Cliente → Orçamento (materiais + mão de obra + BDI/impostos)
        → Proposta comercial (PDF/Word, numerada e revisada)
        → Oportunidade no CRM (funil de vendas)
        → Obra (acompanhamento de custo e avanço físico)
        → Pós-venda (chamados com SLA, para clientes solares com manutenção ativa)
        → Dashboards (pipeline, custo de obras, orçamentos)
```

Nome do pacote: `gouveia-erp`. Interface inteiramente em **português do Brasil**
— inclusive nomes de arquivos, funções, variáveis e tabelas do banco.

---

## 2. Stack técnica

| Camada | Tecnologia |
|---|---|
| Framework | **Next.js 16.3.1** (App Router, Server Components, Server Actions) |
| Runtime UI | React 19.2.8 |
| Linguagem | TypeScript 5 (strict), path alias `@/*` → `src/*` |
| Estilo | Tailwind CSS v4 (`@import "tailwindcss"` no `globals.css`, sem `tailwind.config`) |
| Componentes | shadcn/ui (estilo `base-nova`, base color `neutral`) sobre **@base-ui/react** |
| Ícones | lucide-react |
| Gráficos | recharts |
| Toasts | sonner |
| Tema | next-themes (claro/escuro) |
| Banco | **Supabase (Postgres)** acessado direto via `@supabase/supabase-js` — **sem ORM** |
| Auth | **NextAuth v5 (beta)**, provider Credentials + bcryptjs |
| Validação | zod v4 |
| Documentos | HTML → `.doc` (`application/msword`); `docxtemplater`/`pizzip` disponíveis |
| Valor por extenso | `extenso` |
| Deploy | Vercel |

**IMPORTANTE:** esta versão do Next.js tem mudanças de API em relação a versões
anteriores. O arquivo `AGENTS.md` do repositório instrui a consultar
`node_modules/next/dist/docs/` antes de escrever código. Detalhes já
observados: o middleware vive em **`src/proxy.ts`** (não `middleware.ts`),
`params` de rotas dinâmicas é uma **Promise** (`await params`), e componentes do
base-ui usam a prop `render={<Link/>}` em vez de `asChild`.

### Variáveis de ambiente (`.env`)

```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...   # server-only, ignora RLS
AUTH_SECRET=...                 # NextAuth
```

### Comandos

```bash
npm run dev     # servidor de desenvolvimento (porta 3000)
npm run build
npm run start
npm run lint
npm run seed    # popula o banco (tsx --env-file=.env scripts/seed.ts)
```

---

## 3. Estrutura de pastas

```
src/
├── app/
│   ├── (app)/                    # área autenticada (layout com sidebar + topbar)
│   │   ├── page.tsx              # home
│   │   ├── cadastros/            # clientes, materiais, kits, funcionários,
│   │   │                         # funções, descrições, parâmetros, tipos de problema
│   │   ├── orcamentos/           # orçamento + composição de custo + propostas
│   │   ├── crm/                  # funil de oportunidades (Kanban)
│   │   ├── pos-venda/            # chamados com SLA (Kanban)
│   │   ├── obras/                # acompanhamento de obras
│   │   ├── dashboards/           # indicadores
│   │   └── administracao/        # usuários, perfis, notificações
│   ├── api/
│   │   ├── auth/[...nextauth]/   # handlers do NextAuth
│   │   ├── propostas/[id]/word/  # download da proposta em .doc
│   │   └── pos-venda/            # anexos e notificações
│   ├── login/                    # tela de login (fora do grupo (app))
│   ├── propostas/[id]/           # página de impressão da proposta (PDF via navegador)
│   ├── globals.css
│   └── layout.tsx
├── auth.ts                       # NextAuth com provider Credentials (Node runtime)
├── auth.config.ts                # config compatível com edge (usada no proxy)
├── proxy.ts                      # middleware de autenticação
├── components/
│   ├── ui/                       # shadcn + componentes próprios (combobox, campo-data, botao-excluir)
│   ├── app-sidebar.tsx           # navegação filtrada por perfil
│   ├── topbar.tsx
│   └── <modulo>/                 # formulários e widgets por módulo
├── lib/
│   ├── supabase.ts               # client service-role (SERVER ONLY)
│   ├── database.types.ts         # tipos gerados do schema Supabase
│   ├── permissoes.ts             # matriz perfil × módulo (fonte única de verdade)
│   ├── pagina-auth.ts            # guarda de Server Components
│   ├── api-auth.ts               # guarda de Server Actions e rotas de API
│   ├── proposta.ts               # cálculo de totais + carga de dados da proposta
│   ├── proposta-html.ts          # montagem do documento (HTML string)
│   ├── mao-obra.ts               # custo diário/mensal de função
│   ├── clientes.ts               # ramos + plano de manutenção
│   ├── crm.ts / obras.ts / pos-venda.ts   # constantes e rótulos por módulo
│   ├── notificacoes-pos-venda.ts
│   └── format.ts                 # moeda e data pt-BR
├── hooks/use-mobile.ts
└── types/next-auth.d.ts          # amplia Session/JWT com `perfil` e `id`
scripts/
├── seed.ts                       # dados de teste
├── importar-funcoes.ts           # planilha de mão de obra → tabela Funcao
└── sql/                          # registro das migrações aplicadas no Supabase
```

---

## 4. Autenticação e autorização

### Autenticação

- **NextAuth v5**, estratégia **JWT** (sem tabela de sessão).
- Provider **Credentials**: e-mail + senha, hash `bcryptjs` na coluna
  `Usuario.senhaHash`. Usuário inativo (`ativo = false`) não entra.
- O JWT carrega `id` e `perfil`; a sessão os expõe em `session.user`.
- **Supabase Auth não é usado.** O acesso ao banco é sempre pela *service role
  key*, que ignora RLS — nenhuma policy foi criada de propósito. Consequência:
  `src/lib/supabase.ts` **nunca** pode ser importado por Client Component.
- `src/proxy.ts` (middleware) protege tudo exceto `api`, estáticos e favicon;
  não logado → `/login`; logado em `/login` → `/`.

### Autorização — matriz de permissões

`src/lib/permissoes.ts` é a **fonte única de verdade**, usada tanto para
esconder itens na UI quanto para bloquear de fato no servidor.

**Perfis:** `comercial`, `engenharia`, `obra`, `atendimento`, `admin`
**Níveis:** `nenhum` | `leitura` | `escrita`

| Módulo | comercial | engenharia | obra | atendimento | admin |
|---|---|---|---|---|---|
| `clientes` | escrita | leitura | nenhum | leitura | escrita |
| `cadastrosGerais` | leitura | escrita | leitura | nenhum | escrita |
| `orcamentos` | escrita | escrita | nenhum | nenhum | escrita |
| `crm` | escrita | leitura | nenhum | nenhum | escrita |
| `posVenda` | leitura | leitura | nenhum | **escrita** | escrita |
| `obras` | leitura | escrita | escrita | leitura | escrita |
| `dashboards` | leitura | leitura | leitura | leitura | leitura |
| `administracao` | nenhum | nenhum | nenhum | nenhum | escrita |

Helpers: `nivelAcesso(perfil, modulo)`, `podeLer`, `podeEscrever`.

### Como aplicar a permissão

- **Server Component de página:** `await acessoModulo("orcamentos")` →
  `{ userId, nome, perfil, nivel }` (redireciona para `/login` se não houver sessão).
- **Server Action / Route Handler:** `await exigirPermissao("posVenda", "escrita")`
  → `{ session, perfil, usuarioId }`. Lança `ApiAuthError` (401/403); em rotas,
  capturar e responder com `respostaErroApi(erro)`.
- `exigirAlgumaPermissao([...módulos], nível)` existe para dado com dois donos —
  as **unidades consumidoras** ficam na tela do cliente (`clientes`) mas são
  insumo do chamado (`posVenda`).
- **Sempre usar o `usuarioId` devolvido** ao gravar colunas que referenciam
  `Usuario` — nunca `session.user.id` direto. O JWT sobrevive a mudanças no
  banco e pode carregar um id órfão; `resolverUsuarioId` confere no banco e, se
  necessário, recupera pelo e-mail.

### Usuários de teste (seed) — senha `Senha123!`

| Perfil | E-mail |
|---|---|
| Admin | admin@gouveiaengenharia.com.br |
| Comercial | comercial@gouveiaengenharia.com.br |
| Engenharia | engenharia@gouveiaengenharia.com.br |
| Obra | obra@gouveiaengenharia.com.br |

---

## 5. Banco de dados

Postgres no Supabase. **Não há migrations locais** — mudanças de schema são
feitas no dashboard/SQL Editor do Supabase (ou via MCP) e depois registradas em
`scripts/sql/` como documentação. Os tipos em `src/lib/database.types.ts` são
gerados a partir do schema.

Convenções: tabelas em **PascalCase** singular (`Cliente`, `Orcamento`),
colunas em **camelCase** com aspas duplas no SQL (`"salarioMensal"`), PK `id`
em `uuid` com `gen_random_uuid()`.

### Tabelas

**Cadastro / base**
- `Usuario` — nome, email, senhaHash, `perfil`, `ativo`,
  `notificaWhatsappSemDono`. A coluna `notificaPosVenda` continua no banco mas
  está **inativa** desde `010-chamado-responsavel.sql` — o destinatário do aviso
  passou a ser derivado do chamado.
- `Cliente` — razaoSocial, cnpj, `ramo`, contato, endereço, `manutencaoInicio`/`manutencaoFim`.
- `ContatoCliente` — contatos adicionais (nome, cargo, e-mail, telefone).
- `UnidadeConsumidora` — numero, `tipo` (geradora/beneficiaria), `geradoraId`,
  `percentualRateio`, `potenciaKwp`, `concessionariaId`, `obraId`.
- `Concessionaria` — nome, sigla, uf.
- `Material` — codigo, descricao, categoria, unidade, `custoUnitario`, fornecedor.
- `Kit` + `KitItem` — agrupamento de materiais com quantidade.
- `Funcao` — **catálogo de custo de mão de obra** (nome único, `salarioMensal`, `encargosPercent`).
- `Funcionario` — a pessoa; aponta para `Funcao` (`funcaoId`) e herda o custo,
  mas mantém salário/encargos próprios (alguém pode ganhar acima do piso).
- `ParametroGeral` — `bdiPadrao`, `impostos`, `encargosSociais`, `margemMinima`,
  `diasUteisMes`, `validadePropostaPadraoDias`, `textoImpostosPadrao`,
  `diasSemMovimentoChamado` (padrão 2), além dos parâmetros de horário
  comercial e do teto diário do WhatsApp.
- `DescricaoPadrao` — textos reaproveitáveis de escopo, por `tipoProposta`.
- `TipoProblemaPosVenda` — nome, `prazoDias` (SLA), `diasAlerta`,
  `dependeConcessionaria`, `ordem`, `ativo`.

**Orçamento e proposta**
- `Orcamento` — nomeProjeto, cliente, `tipoProposta`, `status`,
  `bdiPersonalizado`, `impostosPersonalizado`, `ajusteMaoObraPercent`,
  `descontoPercent`, `camposEspecificos` (JSON).
- `OrcamentoItem` — material ou kit, quantidade, `custoUnitarioNoMomento`, subtotal.
- `OrcamentoMaoObra` — alocação de **função** (`funcaoId`) × `diasAlocados`, com `custoCalculado`.
- `PropostaDadosComplementares` — escopo técnico, prazo, condições de pagamento,
  validade, texto de impostos, cidade/UF de execução, contato destinatário.
- `PropostaDadosSolar` — dados específicos de usina solar: consumo, geração
  mensal (JSON), equipamentos (JSON), payback, economia, CO₂ evitado, garantias,
  vida útil, perda de eficiência.
- `Proposta` — `numero`/`ano`/`revisao`/`versao`, `valorFinal`, `modeloUsado`,
  `arquivoUrl`, geradoPor/geradoEm.

**CRM, obras e pós-venda**
- `Oportunidade` — cliente, orçamento, `estagio`, responsável, `valorEstimado`,
  `proximaAcaoData`, `motivoPerda`.
- `Interacao` / `Anexo` — histórico e arquivos da oportunidade.
- `Obra` — vinculada à oportunidade; `status`, `custoOrcado`, `custoRealizado`,
  `avancoFisicoPercent`, datas de início e previsão.
- `Chamado` — `numero`, cliente, `tipoProblemaId`, `estagio`, `prioridade`,
  **`responsavelId`** (FK `Usuario`, obrigatória — todo chamado tem dono),
  `criadoPorId` (quem abriu), `abertoEm`, **`prazoLimite`**,
  `unidadeConsumidoraId`, `obraId`, `protocoloConcessionaria`, `solucao`,
  `concluidoEm`.
- `InteracaoChamado` — tipo, `direcao` (cliente/concessionária/interno), protocolo.
- `AnexoChamado` — caminho no Storage, nome, tamanho, MIME.
- `NotificacaoPosVenda` — usuário, chamado, `tipo`, título, `referencia` (chave
  de deduplicação), `lidaEm`.

### Enums

```
PerfilUsuario           comercial | engenharia | obra | admin | atendimento
RamoCliente             energia_solar | redes_subestacoes
TipoProposta            usina_solar | redes
StatusOrcamento         em_elaboracao | finalizado | revisao
TipoOrcamentoItem       material | kit
EstagioOportunidade     lead | levantamento_escopo | orcamento_elaboracao
                        | proposta_enviada | negociacao | aprovada | perdida
TipoInteracao           ligacao | email | reuniao | visita
StatusObra              em_andamento | concluida | atrasada
EstagioChamado          aberto | em_analise | aguardando_concessionaria | concluido
PrioridadeChamado       baixa | media | alta | critica
TipoInteracaoChamado    ligacao | email | whatsapp | reuniao | visita | protocolo | nota_interna
DirecaoInteracao        cliente | concessionaria | interno
TipoUnidadeConsumidora  geradora | beneficiaria
TipoNotificacaoPosVenda chamado_novo | chamado_vencido | chamado_atualizado
                        | interacao_registrada | conversa_sem_dono
                        | conversa_atribuida | chamado_direcionado
                        | responsavel_alterado | chamado_sem_movimento
                        (chamado_novo não é mais emitido; permanece pelos
                         registros históricos)
```

### Funções no banco

- `excluir_cliente_cascata(p_cliente_id)` — apaga o cliente e tudo que depende
  dele em **uma transação**. Existe no banco (e não como sequência de deletes no
  app) porque precisa ser tudo-ou-nada. Segue a ordem das FKs `RESTRICT`;
  o que é `CASCADE` sai junto. Os **arquivos no Storage não** são apagados aqui —
  quem remove é a Server Action, depois da função responder ok.

### Storage

Bucket **`pos-venda`** — anexos de chamado (print de fatura, relatório de
geração). Limite de 10 MB por arquivo; `next.config.ts` eleva o
`serverActions.bodySizeLimit` para `11mb` para cobrir o overhead do multipart.

---

## 6. Módulos e regras de negócio

### 6.1 Cadastros

Sub-navegação própria (`/cadastros`), com telas de lista → `novo` → `[id]`.

**Clientes** são separados por ramo: `/cadastros/clientes/solar` e
`/cadastros/clientes/redes`. A URL fala `solar`/`redes`, o banco fala
`energia_solar`/`redes_subestacoes` (tradução em `lib/clientes.ts`). Solar tem
unidades consumidoras e plano de manutenção; redes é cadastro simples.

**Plano de manutenção** (só para solar) — é o contrato que autoriza o pós-venda.
`situacaoManutencao()` devolve `sem_plano | a_iniciar | ativo | encerrado`
comparando strings `"YYYY-MM-DD"` (que ordenam lexicograficamente).
`impedimentoDeAbertura()` devolve o texto do bloqueio ou `null` — a **mesma
função** é usada no aviso da tela e no bloqueio real da Server Action.

**Funções × Funcionários** (mudança importante, migração `001-funcoes.sql`):
- `Funcao` = quanto custa uma função (vem da planilha de custo da empresa).
- `Funcionario` = a pessoa, aponta para uma função e herda o custo.
- **O orçamento aloca função, não pessoa** ("Eletricista × 30 dias").

**Custo de mão de obra** (`lib/mao-obra.ts`) — fonte única para as três telas:

```
custoDiario  = (salarioMensal / diasUteisMes) × (1 + encargosPercent/100)
custoMensal  = salarioMensal × (1 + encargosPercent/100)
```

`diasUteisMes` vem de `ParametroGeral` (padrão 22).

### 6.2 Orçamentos

Composição do orçamento: itens (materiais e kits) + alocações de mão de obra.
O **custo unitário é congelado no momento do lançamento**
(`custoUnitarioNoMomento`, `custoCalculado`) — reajuste na tabela de preços ou
na planilha de mão de obra **não** altera orçamento já fechado.

**Cálculo do preço** (`calcularTotais` em `lib/proposta.ts`) — BDI e impostos são
aplicados **por fora, em cascata**, cada parcela virando uma linha para permitir
conferência:

```
valorAjusteMaoObra = custoMaoObraBase × ajusteMaoObraPercent/100
custoMaoObra       = custoMaoObraBase + valorAjusteMaoObra
custoDireto        = custoMateriais + custoMaoObra
valorBdi           = custoDireto × bdi%
valorImpostos      = (custoDireto + valorBdi) × impostos%
subtotal           = custoDireto + valorBdi + valorImpostos
valorDesconto      = subtotal × desconto%
valorFinal         = subtotal − valorDesconto
margemPercent      = (valorFinal − valorImpostos − custoDireto) / valorFinal × 100
```

BDI e impostos usam `bdiPersonalizado`/`impostosPersonalizado` do orçamento com
fallback para `ParametroGeral`. Campo vazio devolve ao padrão.
**Se a regra mudar (ex.: imposto "por dentro", com gross-up), este é o único
ponto a alterar.**

### 6.3 Propostas

- **Numeração:** `NNN/AAAA`, ex. `001/2026`. Reemitir a proposta de um orçamento
  é uma **revisão**: mantém o número e avança `revisao` (`001/2026 — Rev. 01`).
  Cada revisão é uma linha nova; nada é sobrescrito.
- **Concorrência:** duas emissões simultâneas podem escolher o mesmo par
  (numero, ano); a unique constraint barra a segunda e o código repete
  avançando o contador **localmente** (reler o máximo devolveria o mesmo valor
  e o laço colidiria até esgotar). Trata `23505` (unique_violation); qualquer
  outro erro não se resolve repetindo.
- **O arquivo não é armazenado.** `arquivoUrl` aponta para a rota que renderiza
  o documento **sob demanda** a partir dos dados do orçamento.
- **Dois formatos, um conteúdo:** `lib/proposta-html.ts` monta o documento como
  **string de HTML com estilos inline** (não JSX — route handlers do Next não
  podem importar `react-dom/server`). A mesma marcação alimenta:
  - `/propostas/[id]` — página de impressão → PDF pelo navegador;
  - `/api/propostas/[id]/word` — envelope com namespaces
    `urn:schemas-microsoft-com` e `Content-Type: application/msword`, que faz o
    Word tratar o arquivo como documento editável.
- O documento é **voltado ao cliente**: a composição de custos (materiais, mão
  de obra, BDI, impostos) fica só no sistema, na aba *Resumo de custos*. Na
  proposta vai o escopo e o preço fechado, com o valor **por extenso**
  (biblioteca `extenso`).
- Emitir a proposta alimenta o funil: cria a oportunidade se não existir, ou
  puxa a existente até `proposta_enviada` — **nunca puxa para trás** uma
  oportunidade já em negociação ou aprovada.

### 6.4 CRM

Kanban do funil (`ORDEM_ESTAGIO_KANBAN`). O fluxo linear de avançar/voltar
(`ORDEM_ESTAGIO_FLUXO`) exclui `perdida`, que só é atingida explicitamente e
**com motivo** (`motivoPerda`). Cada oportunidade tem interações
(ligação/e-mail/reunião/visita) e anexos.

### 6.5 Obras

Criada a partir de uma oportunidade. Acompanha `custoOrcado` × `custoRealizado`
e `avancoFisicoPercent`. Status: em andamento, atrasada, concluída (o atraso
também é derivado da data prevista de conclusão nos dashboards).

### 6.6 Pós-venda

Módulo do perfil **atendimento** (comercial e engenharia só leem, para
acompanhar reincidência e falha de equipamento).

**Abertura condicionada:** só cliente de **energia solar** com **plano de
manutenção ativo na data**. O bloqueio vem de `impedimentoDeAbertura()`.

**SLA:** o `prazoLimite` **nasce do tipo de problema**, não da digitação —
`abertoEm + TipoProblemaPosVenda.prazoDias`, em **dias corridos**, e **nunca
pausa**, nem enquanto se aguarda a concessionária.

**Datas:** tudo é feito sobre strings `"YYYY-MM-DD"` em **UTC**
(`paraUtc`, `somarDias`, `diferencaEmDias`, `hojeIso` via `toLocaleDateString("sv-SE")`).
Converter para `Date` local desloca o dia em fusos negativos. A mesma razão vale
para `formatarData`, que fatia os 10 primeiros caracteres em vez de usar `Date`.

**Kanban com colunas derivadas:**

```
aberto | em_analise | a_vencer | aguardando_concessionaria | concluido | vencido
```

`a_vencer` e `vencido` **não são estágios gravados** — derivam do `prazoLimite`.
O chamado cai nelas sozinho quando a data chega, e o **estágio de fluxo de
origem continua visível no card** (sem isso perderíamos a informação de onde o
atendimento parou).

**Recorrência:** cliente é sinalizado como recorrente com **3 ou mais** chamados
do mesmo tipo em **6 meses** — sinal de que a causa não foi resolvida e o caso
pede ação preventiva.

**Responsável (dono do chamado):** obrigatório na abertura, escolhido em
combobox entre os usuários **ativos** com perfil `atendimento` ou `admin`
(`podeSerResponsavel` em `lib/pos-venda.ts`, mesma função na tela e no servidor).
Não há valor padrão: a escolha é consciente. O repasse é ação própria na tela do
chamado — permitida ao **dono atual** ou ao **admin**, barrada em chamado
concluído (`podeTrocarResponsavel`), registrada na linha do tempo como
`nota_interna`/`interno`. `atualizarChamado` **não** mexe no dono de propósito:
seria um segundo caminho sem autorização nem histórico.

**Sem movimento:** estado **derivado**, como `a_vencer` e `vencido` — nada é
gravado. A data de referência é a mais recente entre a última `InteracaoChamado`
e o `abertoEm`; passando de `ParametroGeral.diasSemMovimentoChamado` (padrão 2)
dias corridos, o card ganha destaque. Não vira coluna do Kanban: é ortogonal ao
prazo, e um chamado pode estar parado **e** vencido ao mesmo tempo.

**Notificações:**
- O destinatário é **derivado do chamado**, não de um flag por usuário.
  `Usuario.notificaPosVenda` está aposentado (coluna mantida, sem `DROP`).
  | Evento | Tipo | Quem recebe |
  |---|---|---|
  | Chamado criado | `chamado_direcionado` | só o responsável apontado |
  | Responsável trocado | `responsavel_alterado` | novo dono + dono anterior + admins ativos |
  | Vencido | `chamado_vencido` | dono + admins ativos |
  | Sem movimento | `chamado_sem_movimento` | dono + admins ativos |
  | Chamado atualizado | `chamado_atualizado` | dono + admins ativos |
  | Interação registrada | `interacao_registrada` | dono + admins ativos |
- Quem faz a alteração **não** é avisado da própria alteração — inclusive admin.
- A lista de destinatários é **deduplicada antes do upsert**: o admin que também
  é o dono recebe um aviso, não dois (e duas linhas iguais no mesmo insert
  fariam o Postgres recusar o lote).
- Deduplicação por `upsert` com
  `onConflict: "usuarioId,chamadoId,conversaId,tipo,referencia"` — a
  `referencia` torna o aviso único por evento.
- **Nem vencimento nem parada têm evento de escrita** para disparar o aviso: o
  chamado só atravessa a data, ou deixa de receber registro.
  `sincronizarChamados(usuarioId)` roda quando cada destinatário abre o app e
  resolve os dois numa passada só. A chave de dedupe carrega o prazo que
  estourou (ou a data em que o chamado parou), então prorrogar o prazo e vencer
  de novo — ou parar outra vez depois de uma interação — produz aviso **novo**.

### 6.7 Dashboards

Cada bloco só aparece se o perfil tiver leitura no módulo correspondente:
- **CRM** — pipeline ativo (soma de `valorEstimado` das oportunidades abertas),
  taxa de conversão (aprovadas ÷ (aprovadas + perdidas)), pipeline por estágio,
  ações atrasadas.
- **Obras** — em andamento / atrasadas / concluídas, orçado × realizado das
  obras ativas, desvio de custo, custo por obra, lista de atrasadas.
- **Orçamentos** — contagem por status.

### 6.8 Administração

Só `admin`. Gerencia usuários: perfil, ativo/inativo e o silenciador do aviso
de conversa de WhatsApp sem dono. O flag `notificaPosVenda` **saiu da tela** —
o destinatário do aviso de pós-venda passou a ser derivado do próprio chamado.

---

## 7. Convenções de código

**Idioma** — tudo em português: rotas, componentes, funções, variáveis,
mensagens, colunas do banco. Nomes de funções em verbo no infinitivo
(`salvarCliente`, `carregarFuncoes`, `calcularTotais`).

**Server first** — páginas são Server Components; mutação é **Server Action**
(`"use server"` no topo do `actions.ts` do módulo), validada com **zod** e
seguida de `revalidatePath`. `"use client"` só em formulários e widgets
interativos, dentro de `src/components/`.

**Um `actions.ts` por módulo.** Arquivo `"use server"` só pode exportar funções
`async` — por isso constantes, rótulos e regras puras vivem em `src/lib/<modulo>.ts`
(`crm.ts`, `obras.ts`, `pos-venda.ts`, `clientes.ts`). Esse é o motivo explícito
da divisão.

**Regra de negócio em um só lugar.** Toda vez que a mesma verificação aparece na
tela e no servidor, é a **mesma função** que roda nos dois — `impedimentoDeAbertura`,
`custoDiarioMaoObra`, `calcularTotais`, a matriz de `permissoes.ts`. Nunca
confiar apenas na UI: esconder o botão não substitui o bloqueio no servidor.

**Segurança do client Supabase** — `lib/supabase.ts` usa a service role key e é
**server-only**. Módulos que o importam (`funcoes.ts`, `proposta.ts`,
`notificacoes-pos-venda.ts`, actions de clientes) carregam esse aviso no topo.

**Comentários** — o código é comentado em português explicando **o porquê**, não
o quê: por que o SLA usa string em UTC, por que o custo é congelado, por que a
exclusão em cascata mora no banco, por que a proposta é HTML string e não JSX.
Manter esse estilo ao alterar o projeto.

**Formatação** — `formatarMoeda` (pt-BR/BRL) e `formatarData` (dd/mm/aaaa
fatiando a string ISO). Componentes próprios: `campo-data` (data em pt-BR),
`combobox` / `combobox-campo`, `botao-excluir`, `select-nativo`.

---

## 8. Estado atual e histórico

**Fase 1 (MVP)** em andamento. Já entregue: autenticação e matriz de perfis,
banco e navegação, cadastros completos (clientes por ramo, materiais, kits,
funções, funcionários, parâmetros, descrições, tipos de problema), orçamentos
com composição de custo e ajustes comerciais, propostas em PDF/Word com
numeração e revisão, CRM, obras, pós-venda com SLA e notificações, dashboards e
administração.

Commits principais (mais recente primeiro):

```
0501f6d  merge: catálogo de funções e custo de mão de obra
0976fb3  chore(scripts): checagem da migração de Função
6794ac6  feat: exclusão de registros e campo de data em pt-BR
f9fb472  feat(orcamentos): catálogo de funções como base do custo de mão de obra
1e80899  fix(cadastros): alinha o cabeçalho da grade de tipos de problema
dec3c77  feat(cadastros): separa cliente de energia solar do de redes/subestações
9daa19c  feat(ui): botão de recolher dentro da sidebar
a7b8dc1  feat(orcamentos): propostas ao cliente, mão de obra e ajustes comerciais
f1ec95a  Implementa páginas de Dashboards e Obras
7912afe  Commit inicial: Gouveia Engenharia — Gestão Interna (Fase 1 MVP)
```

Mensagens de commit seguem **Conventional Commits em português**
(`feat(modulo): ...`, `fix(modulo): ...`, `chore(scripts): ...`).
O trabalho vai direto na `main`, sem branches de feature.

**Pontos de atenção conhecidos**
- `src/lib/database.types.ts` pode estar defasado em relação ao Postgres — a
  tabela `Funcao` e a coluna `Funcionario.funcaoId` da migração `001` ainda não
  aparecem lá. Regerar os tipos após mudança de schema.
- Não há testes automatizados; `playwright` está instalado como devDependency,
  mas sem suíte.
- Mudança de schema é manual no Supabase; registrar o SQL em `scripts/sql/`.
