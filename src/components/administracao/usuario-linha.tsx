"use client";

import { useActionState, useState } from "react";
import {
  atualizarUsuario,
  excluirUsuario,
  type EstadoFormUsuario,
} from "@/app/(app)/administracao/actions";
import { cn } from "@/lib/utils";
import { ROTULO_PERFIL, podeEscrever, type Perfil } from "@/lib/permissoes";
import { BotaoExcluir } from "@/components/ui/botao-excluir";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SelectNativo } from "@/components/ui/select-nativo";
import { COLUNAS_USUARIO } from "@/components/administracao/colunas";
import { RedefinirSenhaDialog } from "@/components/administracao/redefinir-senha-dialog";

export type UsuarioLinhaValores = {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  ativo: boolean;
  notificaWhatsappSemDono: boolean;
};

export function UsuarioLinha({
  usuario,
  ehVoce = false,
}: {
  usuario: UsuarioLinhaValores;
  /** Na sua própria linha não aparecem "Senha" nem "Excluir": a action recusa
   *  os dois, e a troca da sua senha é no cartão "Minha senha" logo acima. */
  ehVoce?: boolean;
}) {
  const salvar = atualizarUsuario.bind(null, usuario.id);
  const [estado, formAction, pendente] = useActionState<EstadoFormUsuario, FormData>(
    salvar,
    undefined
  );
  const [perfil, setPerfil] = useState<Perfil>(usuario.perfil);

  // Trocar o perfil aqui muda na hora se a caixa de notificação faz sentido.
  const escrevePosVenda = podeEscrever(perfil, "posVenda");

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

      {/* O aviso de conversa parada vai para todo mundo com escrita em
          posVenda, sem depender do flag acima — fila parada é problema do time.
          Este é o desligamento por usuário, para o canal não virar um aviso que
          ninguém consegue silenciar. */}
      {escrevePosVenda ? (
        <Label className="flex items-center gap-2 text-sm">
          <Checkbox
            name="notificaWhatsappSemDono"
            defaultChecked={usuario.notificaWhatsappSemDono}
          />
          Conversa sem dono
        </Label>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      )}

      <div className="flex items-center justify-end gap-2">
        {estado?.erro && <span className="text-xs text-destructive">{estado.erro}</span>}
        <Button type="submit" variant="outline" size="sm" disabled={pendente}>
          {pendente ? "Salvando..." : "Salvar"}
        </Button>
        {!ehVoce && (
          <RedefinirSenhaDialog
            usuarioId={usuario.id}
            nome={usuario.nome}
            email={usuario.email}
          />
        )}
        {!ehVoce && (
          <BotaoExcluir
            acao={excluirUsuario}
            campos={{ usuarioId: usuario.id }}
            titulo={`Excluir ${usuario.nome}?`}
            descricao={
              <>
                O acesso de <strong>{usuario.email}</strong> é apagado do sistema. Só dá
                certo se ele ainda não tiver orçamento, chamado, mensagem ou proposta no
                nome dele — nesse caso, desmarque &quot;Ativo&quot; para tirar o acesso sem
                perder o histórico.
              </>
            }
          />
        )}
      </div>
    </form>
  );
}
