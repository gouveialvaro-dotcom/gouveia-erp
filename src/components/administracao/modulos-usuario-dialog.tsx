"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  atualizarModulosUsuario,
  type EstadoFormUsuario,
} from "@/app/(app)/administracao/actions";
import {
  cadastrosConfiguraveis,
  cadastrosVisiveis,
  chaveCadastro,
  modulosDoPerfil,
} from "@/lib/modulos-menu";
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

// Caixa de marcação dos módulos e dos tipos de cadastro que a pessoa vê. Para
// o que o perfil já dá, desmarcar esconde. Centros de custo não depende do
// perfil: é liberado aqui, pessoa a pessoa. Administração não entra na lista
// porque é por ela que cada um troca a própria senha.
export function ModulosUsuarioDialog({
  usuarioId,
  nome,
  perfil,
  ocultos,
  liberados,
}: {
  usuarioId: string;
  nome: string;
  perfil: Perfil;
  ocultos: string[];
  liberados: string[];
}) {
  const [aberto, setAberto] = useState(false);
  const modulos = modulosDoPerfil(perfil);
  const cadastros = cadastrosConfiguraveis(perfil);
  const visiveis = new Set(cadastrosVisiveis(perfil, ocultos, liberados).map((c) => c.tipo));
  const restritos =
    modulos.filter((m) => ocultos.includes(m.chave)).length + cadastros.filter((c) => !visiveis.has(c.tipo)).length;

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
            title={restritos ? `${restritos} item(ns) sem acesso` : "Vê tudo o que o perfil permite"}
          >
            Módulos{restritos ? ` (−${restritos})` : ""}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Módulos de {nome}</DialogTitle>
          <DialogDescription>
            Marque o que esta pessoa pode ver. A lista mostra só o que o perfil dela permite, mais os
            cadastros liberados por pessoa. Dentro de Suprimentos, as abas seguem os papéis de
            Suprimentos → Configuração.
          </DialogDescription>
        </DialogHeader>
        <FormModulos
          usuarioId={usuarioId}
          nome={nome}
          perfil={perfil}
          modulos={modulos}
          cadastros={cadastros}
          ocultos={ocultos}
          visiveis={visiveis}
          aoSalvar={() => setAberto(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function FormModulos({
  usuarioId,
  nome,
  perfil,
  modulos,
  cadastros,
  ocultos,
  visiveis,
  aoSalvar,
}: {
  usuarioId: string;
  nome: string;
  perfil: Perfil;
  modulos: ReturnType<typeof modulosDoPerfil>;
  cadastros: ReturnType<typeof cadastrosConfiguraveis>;
  ocultos: string[];
  visiveis: Set<string>;
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
    <form action={formAction} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Módulos</legend>
        {modulos.length === 0 ? (
          <p className="text-sm text-muted-foreground">O perfil desta pessoa não tem módulos para escolher.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {modulos.map((m) => (
              <Label key={m.chave} className="flex items-center gap-2 text-sm font-normal">
                <Checkbox name="modulo" value={m.chave} defaultChecked={!ocultos.includes(m.chave)} />
                {m.titulo}
              </Label>
            ))}
          </div>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Cadastros</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {cadastros.map((c) => {
            // O admin vê todos os cadastros; não há o que desmarcar no liberado por pessoa.
            const fixo = !c.modulo && perfil === "admin";
            return (
              <Label key={c.tipo} className="flex items-center gap-2 text-sm font-normal">
                <Checkbox
                  name="modulo"
                  value={chaveCadastro(c.tipo)}
                  defaultChecked={visiveis.has(c.tipo)}
                  disabled={fixo}
                />
                {c.titulo}
                {!c.modulo && !fixo && <span className="text-xs text-muted-foreground">(por pessoa)</span>}
              </Label>
            );
          })}
        </div>
      </fieldset>

      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}

      <Button type="submit" disabled={pendente}>
        {pendente ? "Salvando..." : "Salvar módulos"}
      </Button>
    </form>
  );
}
