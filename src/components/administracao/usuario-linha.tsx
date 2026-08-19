"use client";

import { useActionState, useState } from "react";
import { atualizarUsuario, type EstadoFormUsuario } from "@/app/(app)/administracao/actions";
import { cn } from "@/lib/utils";
import { ROTULO_PERFIL, podeLer, type Perfil } from "@/lib/permissoes";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SelectNativo } from "@/components/ui/select-nativo";

export const COLUNAS_USUARIO = "md:grid-cols-[1fr_11rem_6rem_9rem_auto]";

export type UsuarioLinhaValores = {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  ativo: boolean;
  notificaPosVenda: boolean;
};

export function UsuarioLinha({ usuario }: { usuario: UsuarioLinhaValores }) {
  const salvar = atualizarUsuario.bind(null, usuario.id);
  const [estado, formAction, pendente] = useActionState<EstadoFormUsuario, FormData>(
    salvar,
    undefined
  );
  const [perfil, setPerfil] = useState<Perfil>(usuario.perfil);

  // Trocar o perfil aqui muda na hora se a caixa de notificação faz sentido.
  const vePosVenda = podeLer(perfil, "posVenda");

  return (
    <form action={formAction} className={cn("grid gap-3 px-3 py-2 items-center", COLUNAS_USUARIO)}>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{usuario.nome}</p>
        <p className="text-xs text-muted-foreground truncate">{usuario.email}</p>
      </div>

      <SelectNativo
        name="perfil"
        aria-label="Perfil"
        value={perfil}
        onChange={(e) => setPerfil(e.target.value as Perfil)}
      >
        {(Object.keys(ROTULO_PERFIL) as Perfil[]).map((p) => (
          <option key={p} value={p}>
            {ROTULO_PERFIL[p]}
          </option>
        ))}
      </SelectNativo>

      <Label className="flex items-center gap-2 text-sm">
        <Checkbox name="ativo" defaultChecked={usuario.ativo} />
        Ativo
      </Label>

      {vePosVenda ? (
        <Label className="flex items-center gap-2 text-sm">
          <Checkbox name="notificaPosVenda" defaultChecked={usuario.notificaPosVenda} />
          Recebe avisos
        </Label>
      ) : (
        <span className="text-xs text-muted-foreground">Sem acesso ao pós-venda</span>
      )}

      <div className="flex items-center justify-end gap-2">
        {estado?.erro && <span className="text-xs text-destructive">{estado.erro}</span>}
        <Button type="submit" variant="outline" size="sm" disabled={pendente}>
          {pendente ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
