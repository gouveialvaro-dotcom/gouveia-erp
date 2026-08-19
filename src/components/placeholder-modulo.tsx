import { auth } from "@/auth";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { podeLer, type Modulo, type Perfil } from "@/lib/permissoes";

export async function PlaceholderModulo({
  titulo,
  descricao,
  modulos,
}: {
  titulo: string;
  descricao: string;
  modulos: Modulo[];
}) {
  const session = await auth();
  const perfil = session?.user?.perfil as Perfil | undefined;
  const autorizado = perfil ? modulos.some((m) => podeLer(perfil, m)) : false;

  if (!autorizado) {
    return (
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Acesso restrito</CardTitle>
          <CardDescription>
            Seu perfil não tem permissão para acessar este módulo.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Em construção</CardTitle>
          <CardDescription>{descricao}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
