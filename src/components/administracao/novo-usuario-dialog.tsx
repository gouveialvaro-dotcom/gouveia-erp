"use client";

import { useActionState, useEffect, useState } from "react";
import { criarUsuario, type EstadoFormUsuario } from "@/app/(app)/administracao/actions";
import { ROTULO_PERFIL, type Perfil } from "@/lib/permissoes";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNativo } from "@/components/ui/select-nativo";
import { CampoTelefone } from "@/components/ui/campo-telefone";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function NovoUsuarioDialog() {
  const [aberto, setAberto] = useState(false);

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger render={<Button size="sm">+ Novo usuário</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
          <DialogDescription>
            O e-mail é o login. A senha definida aqui é provisória — quem entrar continua
            com ela até um administrador trocar.
          </DialogDescription>
        </DialogHeader>
        {/* O formulário vive dentro do popup, que o Base UI desmonta ao fechar:
            assim o estado da action (inclusive o `ok` da criação anterior) some
            junto e o diálogo não reabre já se fechando sozinho. */}
        <FormNovoUsuario aoCriar={() => setAberto(false)} />
      </DialogContent>
    </Dialog>
  );
}

function FormNovoUsuario({ aoCriar }: { aoCriar: () => void }) {
  const [estado, formAction, pendente] = useActionState<EstadoFormUsuario, FormData>(
    criarUsuario,
    undefined
  );
  const [perfil, setPerfil] = useState<Perfil>("comercial");

  useEffect(() => {
    if (estado?.ok) aoCriar();
  }, [estado, aoCriar]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" name="nome" required autoComplete="off" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-mail (login)</Label>
        <Input id="email" name="email" type="email" required autoComplete="off" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="senha">Senha provisória</Label>
        <Input
          id="senha"
          name="senha"
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
        />
        <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="telefone">WhatsApp (opcional)</Label>
        <CampoTelefone id="telefone" name="telefone" />
        <p className="text-xs text-muted-foreground">
          Necessário para a pessoa ser responsável por um destino na programação de
          logística — é por ele que ela recebe o aviso de alteração.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="perfil">Perfil de acesso</Label>
        <SelectNativo
          id="perfil"
          name="perfil"
          value={perfil}
          onChange={(e) => setPerfil(e.target.value as Perfil)}
        >
          {(Object.keys(ROTULO_PERFIL) as Perfil[]).map((p) => (
            <option key={p} value={p}>
              {ROTULO_PERFIL[p]}
            </option>
          ))}
        </SelectNativo>
      </div>

      <Label className="flex items-center gap-2 font-normal">
        <Checkbox name="ativo" defaultChecked />
        Ativo (pode entrar no sistema)
      </Label>

      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}

      <Button type="submit" disabled={pendente}>
        {pendente ? "Criando..." : "Criar usuário"}
      </Button>
    </form>
  );
}
