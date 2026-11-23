"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  atualizarModulosUsuario,
  type EstadoFormUsuario,
} from "@/app/(app)/administracao/actions";
import { modulosDoPerfil } from "@/lib/modulos-menu";
import type { Perfil } from "@/lib/permissoes";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Caixa de marcação dos módulos que a pessoa vê. Só aparecem os módulos que o
// perfil dela já lê: aqui se restringe, não se libera. Administração não entra
// na lista porque é por ela que cada um troca a própria senha.
export function ModulosUsuarioDialog({
  usuarioId,
  nome,
  perfil,
  ocultos,
}: {
  usuarioId: string;
  nome: string;
  perfil: Perfil;
  ocultos: string[];
}) {
  const [aberto, setAberto] = useState(false);
  const disponiveis = modulosDoPerfil(perfil);
  const escondidos = disponiveis.filter((m) => ocultos.includes(m.chave)).length;

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      {/* type="button": o gatilho fica dentro do <form> da linha do usuário. */}
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto px-0 text-xs"
            title={escondidos ? `${escondidos} módulo(s) escondido(s)` : "Vê todos os módulos do perfil"}
          >
            Módulos{escondidos ? ` (−${escondidos})` : ""}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Módulos de {nome}</DialogTitle>
          <DialogDescription>
            Desmarque o que esta pessoa não deve ver no menu. A lista mostra só o que o perfil
            dela permite; dentro de Suprimentos, as abas seguem os papéis definidos em
            Suprimentos → Configuração.
          </DialogDescription>
        </DialogHeader>
        <FormModulos
          usuarioId={usuarioId}
          nome={nome}
          disponiveis={disponiveis}
          ocultos={ocultos}
          aoSalvar={() => setAberto(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function FormModulos({
  usuarioId,
  nome,
  disponiveis,
  ocultos,
  aoSalvar,
}: {
  usuarioId: string;
  nome: string;
  disponiveis: ReturnType<typeof modulosDoPerfil>;
  ocultos: string[];
  aoSalvar: () => void;
}) {
  const salvar = atualizarModulosUsuario.bind(null, usuarioId);
  const [estado, formAction, pendente] = useActionState<EstadoFormUsuario, FormData>(salvar, undefined);

  useEffect(() => {
    if (estado?.ok) {
      toast.success(`Módulos de ${nome} atualizados.`);
      aoSalvar();
    }
  }, [estado, nome, aoSalvar]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {disponiveis.length === 0 ? (
        <p className="text-sm text-muted-foreground">O perfil desta pessoa não tem módulos para escolher.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {disponiveis.map((m) => (
            <Label key={m.chave} className="flex items-center gap-2 text-sm font-normal">
              <Checkbox name="modulo" value={m.chave} defaultChecked={!ocultos.includes(m.chave)} />
              {m.titulo}
            </Label>
          ))}
        </div>
      )}

      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}

      <Button type="submit" disabled={pendente || disponiveis.length === 0}>
        {pendente ? "Salvando..." : "Salvar módulos"}
      </Button>
    </form>
  );
}
