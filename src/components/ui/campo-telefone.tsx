"use client";

import { useState } from "react";
import { apenasDigitos, chaveTelefone } from "@/lib/pos-venda-whatsapp";
import { Input } from "@/components/ui/input";

// Campo de WhatsApp com máscara brasileira. O valor enviado é o texto com
// máscara — o mesmo formato em que o telefone do cliente já vive no cadastro.
// Quem normaliza para comparar e para enviar é chaveTelefone/telefoneParaEnvio,
// no servidor: a regra de telefone mora em UM lugar só (lib/pos-venda-whatsapp),
// e este componente não escreve uma segunda.

function mascarar(bruto: string) {
  let d = apenasDigitos(bruto);
  // Colado do WhatsApp costuma vir com o 55 na frente; o DDI não é digitado.
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  d = d.slice(0, 11);

  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function CampoTelefone({
  id,
  name,
  defaultValue,
  required,
}: {
  id?: string;
  name: string;
  defaultValue?: string | null;
  required?: boolean;
}) {
  const [texto, setTexto] = useState(mascarar(defaultValue ?? ""));

  // Aceita 10 ou 11 dígitos (fixo ou celular). Vazio não é erro: o telefone é
  // opcional no cadastro — só impede a pessoa de ser responsável ou motorista.
  const invalido = texto.length > 0 && chaveTelefone(texto) === null;

  return (
    <>
      <Input
        id={id}
        name={name}
        value={texto}
        onChange={(e) => setTexto(mascarar(e.target.value))}
        placeholder="(84) 99999-8888"
        inputMode="numeric"
        maxLength={15}
        required={required}
        aria-invalid={invalido || undefined}
      />
      {invalido && (
        <p className="text-xs text-destructive">Informe DDD + número (10 ou 11 dígitos).</p>
      )}
    </>
  );
}
