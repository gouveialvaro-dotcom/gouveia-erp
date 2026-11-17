"use client";

import { useActionState } from "react";
import type { Database } from "@/lib/database.types";
import { salvarEmpresa, salvarFaturamentoObras } from "@/app/(app)/suprimentos/empresas/actions";
import { salvarFornecedor } from "@/app/(app)/suprimentos/fornecedores/actions";
import { salvarProduto } from "@/app/(app)/suprimentos/produtos/actions";
import {
  ROTULO_TIPO_PRODUTO,
  UFS,
  UF_EMPRESA,
  UNIDADES_SUGERIDAS,
  formatarCnpj,
  type TipoProduto,
} from "@/lib/suprimentos";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNativo } from "@/components/ui/select-nativo";
import { Textarea } from "@/components/ui/textarea";

function Erro({ estado }: { estado: { erro?: string; ok?: string } | undefined }) {
  if (estado?.erro) return <p className="text-sm text-destructive">{estado.erro}</p>;
  if (estado?.ok) return <p className="text-sm text-emerald-600">{estado.ok}</p>;
  return null;
}

function Campo({
  id,
  rotulo,
  dica,
  className,
  children,
}: {
  id: string;
  rotulo: string;
  dica?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>{rotulo}</Label>
      {children}
      {dica && <p className="text-xs text-muted-foreground">{dica}</p>}
    </div>
  );
}

function SelectUf({ valor, obrigatorio }: { valor?: string | null; obrigatorio?: boolean }) {
  return (
    <SelectNativo id="uf" name="uf" defaultValue={valor ?? ""} required={obrigatorio}>
      <option value="">—</option>
      {UFS.map((uf) => (
        <option key={uf} value={uf}>
          {uf}
        </option>
      ))}
    </SelectNativo>
  );
}

// ---------------------------------------------------------------------------

export function EmpresaForm({
  empresa,
}: {
  empresa?: {
    id: string;
    razaoSocial: string;
    nomeFantasia: string | null;
    cnpj: string;
    uf: string | null;
    ativo: boolean;
  };
}) {
  const [estado, acao, pendente] = useActionState(
    salvarEmpresa.bind(null, empresa?.id ?? null),
    undefined
  );

  return (
    <form action={acao} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
        <Campo id="razaoSocial" rotulo="Razão social" className="sm:col-span-2">
          <Input id="razaoSocial" name="razaoSocial" defaultValue={empresa?.razaoSocial} required />
        </Campo>
        <Campo id="nomeFantasia" rotulo="Nome fantasia (opcional)" className="sm:col-span-2">
          <Input id="nomeFantasia" name="nomeFantasia" defaultValue={empresa?.nomeFantasia ?? ""} />
        </Campo>
        <Campo id="cnpj" rotulo="CNPJ">
          <Input
            id="cnpj"
            name="cnpj"
            defaultValue={empresa ? formatarCnpj(empresa.cnpj) : ""}
            placeholder="00.000.000/0000-00"
            required
          />
        </Campo>
        <Campo id="uf" rotulo="UF">
          <SelectUf valor={empresa?.uf ?? UF_EMPRESA} />
        </Campo>
        <Label className="flex items-center gap-2 font-normal sm:col-span-2">
          <Checkbox name="ativo" defaultChecked={empresa?.ativo ?? true} />
          Ativa (aparece para faturamento)
        </Label>
      </div>
      <Erro estado={estado} />
      <div>
        <Button type="submit" disabled={pendente}>
          {pendente ? "Salvando..." : "Salvar empresa"}
        </Button>
      </div>
    </form>
  );
}

export function FaturamentoObrasForm({
  obras,
  empresas,
  valores,
}: {
  obras: { id: string; nome: string; cliente: string | null }[];
  empresas: { id: string; nome: string }[];
  valores: Record<string, string>;
}) {
  const [estado, acao, pendente] = useActionState(salvarFaturamentoObras, undefined);

  if (obras.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma obra cadastrada.</p>;
  }

  return (
    <form action={acao} className="flex flex-col gap-4">
      {/* Remonta os selects com o que foi gravado: o React limpa o form depois
          da action e eles voltariam ao valor da primeira renderização. */}
      <div key={JSON.stringify(valores)} className="rounded-md border bg-card divide-y max-w-3xl">
        {obras.map((obra) => (
          <div key={obra.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
            <div className="min-w-0">
              <div className="text-sm font-medium">{obra.nome}</div>
              {obra.cliente && <div className="text-xs text-muted-foreground">{obra.cliente}</div>}
            </div>
            <SelectNativo
              name={`obra:${obra.id}`}
              defaultValue={valores[obra.id] ?? ""}
              className="w-72"
              disabled={empresas.length === 0}
            >
              <option value="">Sem empresa definida</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </SelectNativo>
          </div>
        ))}
      </div>
      <Erro estado={estado} />
      <div>
        <Button type="submit" disabled={pendente || empresas.length === 0}>
          {pendente ? "Salvando..." : "Salvar faturamento"}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------

type FornecedorRow = Database["public"]["Tables"]["Fornecedor"]["Row"];

export function FornecedorForm({ fornecedor }: { fornecedor?: FornecedorRow }) {
  const [estado, acao, pendente] = useActionState(
    salvarFornecedor.bind(null, fornecedor?.id ?? null),
    undefined
  );

  return (
    <form action={acao} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
        <Campo id="razaoSocial" rotulo="Razão social / nome" className="sm:col-span-2">
          <Input id="razaoSocial" name="razaoSocial" defaultValue={fornecedor?.razaoSocial} required />
        </Campo>
        <Campo id="nomeFantasia" rotulo="Nome fantasia (opcional)">
          <Input id="nomeFantasia" name="nomeFantasia" defaultValue={fornecedor?.nomeFantasia ?? ""} />
        </Campo>
        <Campo id="cnpj" rotulo="CNPJ ou CPF (opcional)">
          <Input
            id="cnpj"
            name="cnpj"
            defaultValue={fornecedor?.cnpj ? formatarCnpj(fornecedor.cnpj) : ""}
            placeholder="CNPJ, ou CPF se for pessoa física"
          />
        </Campo>
        <Campo
          id="uf"
          rotulo="UF"
          dica={`Fornecedor de fora do ${UF_EMPRESA} acende o alerta de DIFAL na cotação.`}
        >
          <SelectUf valor={fornecedor?.uf} obrigatorio />
        </Campo>
        <Campo id="cidade" rotulo="Cidade">
          <Input id="cidade" name="cidade" defaultValue={fornecedor?.cidade ?? ""} />
        </Campo>
        <Campo id="vendedor" rotulo="Vendedor / contato">
          <Input id="vendedor" name="vendedor" defaultValue={fornecedor?.vendedor ?? ""} />
        </Campo>
        <Campo id="telefone" rotulo="Telefone">
          <Input id="telefone" name="telefone" defaultValue={fornecedor?.telefone ?? ""} />
        </Campo>
        <Campo id="email" rotulo="E-mail" className="sm:col-span-2">
          <Input id="email" name="email" type="email" defaultValue={fornecedor?.email ?? ""} />
        </Campo>
        <Campo id="observacoes" rotulo="Observações" className="sm:col-span-2">
          <Textarea id="observacoes" name="observacoes" defaultValue={fornecedor?.observacoes ?? ""} />
        </Campo>
        <Label className="flex items-center gap-2 font-normal sm:col-span-2">
          <Checkbox name="ativo" defaultChecked={fornecedor?.ativo ?? true} />
          Ativo
        </Label>
      </div>
      <Erro estado={estado} />
      <div>
        <Button type="submit" disabled={pendente}>
          {pendente ? "Salvando..." : "Salvar fornecedor"}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------

export function ProdutoForm({
  produto,
}: {
  produto?: {
    id: string;
    descricao: string;
    unidade: string;
    categoria: string | null;
    tipo: TipoProduto;
    observacoes: string | null;
    ativo: boolean;
    revisar: boolean;
  };
}) {
  const [estado, acao, pendente] = useActionState(
    salvarProduto.bind(null, produto?.id ?? null),
    undefined
  );

  return (
    <form action={acao} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3 max-w-2xl">
        <Campo id="descricao" rotulo="Descrição" className="sm:col-span-3">
          <Input id="descricao" name="descricao" defaultValue={produto?.descricao} required />
        </Campo>
        <Campo id="unidade" rotulo="Unidade">
          <Input
            id="unidade"
            name="unidade"
            list="unidades-sugeridas"
            defaultValue={produto?.unidade ?? "UN"}
            required
          />
          <datalist id="unidades-sugeridas">
            {UNIDADES_SUGERIDAS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </Campo>
        <Campo id="tipo" rotulo="Tipo">
          <SelectNativo id="tipo" name="tipo" defaultValue={produto?.tipo ?? "material"}>
            {(Object.keys(ROTULO_TIPO_PRODUTO) as TipoProduto[]).map((t) => (
              <option key={t} value={t}>
                {ROTULO_TIPO_PRODUTO[t]}
              </option>
            ))}
          </SelectNativo>
        </Campo>
        <Campo id="categoria" rotulo="Categoria (opcional)">
          <Input
            id="categoria"
            name="categoria"
            defaultValue={produto?.categoria ?? ""}
            placeholder="Elétrico, Hidráulico, EPI…"
          />
        </Campo>
        <Campo id="observacoes" rotulo="Observações" className="sm:col-span-3">
          <Textarea id="observacoes" name="observacoes" defaultValue={produto?.observacoes ?? ""} />
        </Campo>
        <div className="flex flex-col gap-2 sm:col-span-3">
          <Label className="flex items-center gap-2 font-normal">
            <Checkbox name="ativo" defaultChecked={produto?.ativo ?? true} />
            Ativo (aparece para vincular nas requisições)
          </Label>
          <Label className="flex items-center gap-2 font-normal">
            <Checkbox name="revisar" defaultChecked={produto?.revisar ?? false} />
            A revisar (unidade ou categoria ainda não conferidas)
          </Label>
        </div>
      </div>
      <Erro estado={estado} />
      <div>
        <Button type="submit" disabled={pendente}>
          {pendente ? "Salvando..." : "Salvar produto"}
        </Button>
      </div>
    </form>
  );
}
