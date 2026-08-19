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
  return (
    <header className="flex h-14 shrink-0 items-center justify-end border-b bg-background px-4">
      {/* No desktop o botão de recolher vive dentro da própria sidebar. No
          mobile ela vira um painel deslizante, e um gatilho interno ficaria
          inalcançável com o painel fechado — por isso este permanece aqui. */}
      <SidebarTrigger className="mr-auto md:hidden" />
      <div className="flex items-center gap-3">
        {mostrarNotificacoes && <SinoNotificacoes />}
        <div className="flex flex-col items-end leading-tight">
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
