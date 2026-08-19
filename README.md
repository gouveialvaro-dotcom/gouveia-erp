# Gouveia Engenharia — Gestão Interna

Sistema de gestão interna: cálculo de custos, geração de propostas comerciais e CRM.

## Rodando localmente

```bash
npm install
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

O banco de dados é o Postgres do Supabase, acessado direto via
`@supabase/supabase-js` (ver `src/lib/supabase.ts`) — sem ORM. Configure
`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no `.env` (a service role key
ignora RLS e só é usada no servidor, nunca é exposta ao navegador).

## Usuários de teste (seed)

Senha para todos: `Senha123!`

| Perfil | E-mail |
|---|---|
| Admin | admin@gouveiaengenharia.com.br |
| Comercial | comercial@gouveiaengenharia.com.br |
| Engenharia | engenharia@gouveiaengenharia.com.br |
| Obra | obra@gouveiaengenharia.com.br |

## Comandos úteis

```bash
npm run seed   # popular o banco novamente (scripts/seed.ts)
```

Alterações de schema (tabelas, colunas, enums) são feitas diretamente no
Postgres do Supabase (dashboard, SQL editor ou MCP), não por migrations
locais.

## Status

Fase 1 (MVP) em andamento. Base pronta: autenticação, banco de dados,
navegação por perfil. Próximo passo: módulo de Cadastros.
