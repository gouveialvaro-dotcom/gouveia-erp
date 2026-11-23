import { exigirCadastroVisivel } from "@/lib/modulos-visiveis";

// Acesso a este tipo de cadastro (perfil + Administração → Módulos).
export default async function Layout({ children }: { children: React.ReactNode }) {
  await exigirCadastroVisivel("tiposProblema");
  return children;
}
