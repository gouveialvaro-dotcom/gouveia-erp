"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";

const ROTULO_PERFIL: Record<string, string> = {
  comercial: "Comercial",
  engenharia: "Engenharia",
  obra: "Obra",
  admin: "Administrador",
};

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
}: {
  nome: string;
  perfil: string;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4">
      <SidebarTrigger />
      <div className="flex items-center gap-3">
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
