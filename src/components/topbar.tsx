"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SinoNotificacoes } from "@/components/pos-venda/sino-notificacoes";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { ROTULO_PERFIL, type Perfil } from "@/lib/permissoes";
import { useTituloPagina } from "@/components/titulo-pagina";

function iniciais(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join("");
}

export function Topbar({
  nome,
  perfil,
  mostrarNotificacoes,
}: {
  nome: string;
  perfil: Perfil;
  mostrarNotificacoes: boolean;
}) {
  const tituloPagina = useTituloPagina();

  return (
    // px acompanha o padding do main para o título nascer alinhado com o
    // conteúdo da página, e não deslocado alguns pixels à esquerda.
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4 sm:px-6">
      {/* No desktop o botão de recolher vive dentro da própria sidebar. No
          mobile ela vira um painel deslizante, e um gatilho interno ficaria
          inalcançável com o painel fechado — por isso este permanece aqui. */}
      <SidebarTrigger className="md:hidden" />

      {/* H1 de toda página do sistema (ver components/titulo-pagina). Enquanto
          nenhuma rota publica — no primeiro paint, antes da hidratação — o
          bloco fica vazio e só serve de espaçador. */}
      <div className="mr-auto flex min-w-0 flex-col leading-tight">
        {tituloPagina && (
          <>
            <h1 className="truncate text-base font-semibold tracking-tight">
              {tituloPagina.titulo}
            </h1>
            {tituloPagina.subtitulo && (
              <span className="truncate text-xs text-muted-foreground">
                {tituloPagina.subtitulo}
              </span>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        {mostrarNotificacoes && <SinoNotificacoes />}
        {/* O nome some no estreito: com título na barra, os dois brigam pela
            mesma linha e o título é que precisa da largura. */}
        <div className="hidden flex-col items-end leading-tight sm:flex">
          <span className="text-sm font-medium">{nome}</span>
          <span className="text-xs text-muted-foreground">
            {ROTULO_PERFIL[perfil] ?? perfil}
          </span>
        </div>
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
            {iniciais(nome)}
          </AvatarFallback>
        </Avatar>
        <Button
          variant="ghost"
          size="icon"
          title="Sair"
          onClick={() => signOut({ redirectTo: "/login" })}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
