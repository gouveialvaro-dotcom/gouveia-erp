"use client";

import { useActionState } from "react";
import {
  salvarAlcadas,
  salvarPapeis,
  type EstadoConfiguracao,
} from "@/app/(app)/suprimentos/configuracao/actions";
import { DESCRICAO_PAPEL, PAPEIS, ROTULO_PAPEL } from "@/lib/suprimentos";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// O React limpa o form depois da action e os campos não controlados voltariam
// ao valor da primeira renderização. A chave abaixo muda com o que foi gravado
// e remonta só os campos — a mensagem de "salvo" continua na tela.
function versao(valor: unknown) {
  return JSON.stringify(valor);
}

function Mensagem({ estado }: { estado: EstadoConfiguracao }) {
  if (estado?.erro) return <p className="text-sm text-destructive">{estado.erro}</p>;
  if (estado?.ok) return <p className="text-sm text-emerald-600">{estado.ok}</p>;
  return null;
}

export function FormAlcadas({
  parametros,
}: {
  parametros: { limiteComprador: number; limiteGerencia: number; minimoCotacoes: number };
}) {
  const [estado, acao, pendente] = useActionState(salvarAlcadas, undefined);

  return (
    <form action={acao} className="flex flex-col gap-4">
      <div key={versao(parametros)} className="grid gap-4 sm:grid-cols-3 max-w-3xl">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="limiteComprador">Comprador aprova até (R$)</Label>
          <Input
            id="limiteComprador"
            name="limiteComprador"
            inputMode="decimal"
            defaultValue={parametros.limiteComprador}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="limiteGerencia">Gerência aprova até (R$)</Label>
          <Input
            id="limiteGerencia"
            name="limiteGerencia"
            inputMode="decimal"
            defaultValue={parametros.limiteGerencia}
            required
          />
          <p className="text-xs text-muted-foreground">
            Acima disso: gerência e depois diretoria.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="minimoCotacoes">Cotações recomendadas</Label>
          <Input
            id="minimoCotacoes"
            name="minimoCotacoes"
            type="number"
            min={1}
            defaultValue={parametros.minimoCotacoes}
            required
          />
          <p className="text-xs text-muted-foreground">
            Abaixo disso a compra segue, com alerta ao comprador e ao requisitante.
          </p>
        </div>
      </div>
      <Mensagem estado={estado} />
      <div>
        <Button type="submit" disabled={pendente}>
          {pendente ? "Salvando..." : "Salvar alçadas"}
        </Button>
      </div>
    </form>
  );
}

export function FormPapeis({
  usuarios,
  marcados,
}: {
  usuarios: { id: string; nome: string; email: string; perfil: string }[];
  marcados: string[];
}) {
  const [estado, acao, pendente] = useActionState(salvarPapeis, undefined);
  const conjunto = new Set(marcados);

  return (
    <form action={acao} className="flex flex-col gap-4">
      <div key={versao([...marcados].sort())} className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              {PAPEIS.map((papel) => (
                <TableHead key={papel} className="text-center" title={DESCRICAO_PAPEL[papel]}>
                  {ROTULO_PAPEL[papel]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.map((usuario) => (
              <TableRow key={usuario.id}>
                <TableCell>
                  <div className="font-medium">{usuario.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {usuario.perfil} · {usuario.email}
                  </div>
                </TableCell>
                {PAPEIS.map((papel) => (
                  <TableCell key={papel} className="text-center">
                    <Checkbox
                      name={`papel:${usuario.id}:${papel}`}
                      defaultChecked={conjunto.has(`${usuario.id}:${papel}`)}
                      aria-label={`${ROTULO_PAPEL[papel]} — ${usuario.nome}`}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Mensagem estado={estado} />
      <div>
        <Button type="submit" disabled={pendente}>
          {pendente ? "Salvando..." : "Salvar papéis"}
        </Button>
      </div>
    </form>
  );
}
