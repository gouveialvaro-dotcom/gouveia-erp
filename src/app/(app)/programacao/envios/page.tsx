import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { formatarDataHora } from "@/lib/format";
import { formatarTelefone } from "@/lib/pos-venda-whatsapp";
import { ROTULO_PAPEL, type PapelDestinatario } from "@/lib/programacao";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BotaoReenviar } from "@/components/programacao/botao-reenviar";

export default async function PaginaEnvios() {
  const { perfil } = await acessoModulo("programacao");
  // Só quem publica tem o que fazer aqui: o reenvio é ação de escrita.
  if (!podeEscrever(perfil, "programacao")) redirect("/programacao");

  const { data } = await supabase
    .from("EnvioWhatsapp")
    .select(
      "id, telefone, papel, mensagem, urgente, status, tentativas, erro, criadoEm, enviadoEm, usuario:Usuario(nome), funcionario:Funcionario(nome)"
    )
    .order("criadoEm", { ascending: false })
    .limit(200);

  const envios = data ?? [];
  const falhas = envios.filter((envio) => envio.status === "falha").length;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Avisos de programação enviados pelo número corporativo. A linha é gravada antes da
        tentativa de envio: falha aqui <strong>não</strong> desfaz a publicação — a
        programação publicada é a verdade do sistema, a mensagem é o aviso.
      </p>

      {falhas > 0 && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {falhas} aviso(s) não chegaram. Reenvie ou avise a pessoa por outro caminho.
        </p>
      )}

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quando</TableHead>
              <TableHead>Destinatário</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Mensagem</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {envios.map((envio) => (
              <TableRow key={envio.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatarDataHora(envio.criadoEm)}
                </TableCell>
                <TableCell>
                  <span className="block font-medium">
                    {envio.usuario?.nome ?? envio.funcionario?.nome ?? "—"}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {formatarTelefone(envio.telefone)}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <Badge variant="outline">
                      {ROTULO_PAPEL[envio.papel as PapelDestinatario]}
                    </Badge>
                    {envio.urgente && <Badge variant="destructive">Urgente</Badge>}
                  </div>
                </TableCell>
                <TableCell className="max-w-md">
                  <details>
                    <summary className="cursor-pointer text-xs text-muted-foreground">
                      {envio.mensagem.split("\n")[0]}
                    </summary>
                    <pre className="mt-1 whitespace-pre-wrap font-sans text-xs">
                      {envio.mensagem}
                    </pre>
                  </details>
                </TableCell>
                <TableCell>
                  {envio.status === "enviado" ? (
                    <Badge variant="secondary">Enviado</Badge>
                  ) : envio.status === "falha" ? (
                    <div className="flex flex-col gap-1">
                      <Badge variant="destructive">Falha</Badge>
                      <span className="text-xs text-muted-foreground">{envio.erro}</span>
                    </div>
                  ) : (
                    <Badge variant="outline">Pendente</Badge>
                  )}
                  {envio.tentativas > 1 && (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {envio.tentativas} tentativas
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {envio.status !== "enviado" && <BotaoReenviar envioId={envio.id} />}
                </TableCell>
              </TableRow>
            ))}
            {envios.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhum aviso enviado ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
