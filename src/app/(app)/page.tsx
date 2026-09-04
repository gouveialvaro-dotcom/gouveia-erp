import { auth } from "@/auth";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TituloPagina } from "@/components/titulo-pagina";

export default async function PaginaInicial() {
  const session = await auth();
  const primeiroNome = session?.user?.name?.split(" ")[0] ?? "";

  return (
    <div className="flex flex-col gap-6">
      <TituloPagina
        titulo={`Olá, ${primeiroNome}`}
        subtitulo="Painel de gestão interna da Gouveia Engenharia."
      />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Base do sistema em construção</CardTitle>
          <CardDescription>
            Autenticação, banco de dados e navegação por perfil estão prontos.
            Os módulos de Cadastros, Orçamentos e CRM serão liberados em
            seguida, nesta ordem.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
