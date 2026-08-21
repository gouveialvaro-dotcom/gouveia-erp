"use client";

import { useRef, useState } from "react";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

// O <input type="date"> nativo exibe a data no formato do idioma do NAVEGADOR,
// não da página: numa máquina com Chrome em inglês ele mostra MM/DD/AAAA por
// mais que o app declare lang="pt-BR". Como o formato tem que ser o mesmo para
// todo mundo, aqui o que aparece é um campo de texto sempre em DD/MM/AAAA, e o
// input nativo fica escondido só para abrir o calendário.
//
// O valor enviado no formulário continua sendo "YYYY-MM-DD" (campo oculto), que
// é o que as server actions e o Postgres esperam — nada muda do lado de lá.

function isoParaBr(iso: string) {
  const limpo = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(limpo)) return "";
  const [ano, mes, dia] = limpo.split("-");
  return `${dia}/${mes}/${ano}`;
}

function brParaIso(br: string) {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  const [, dia, mes, ano] = m;
  // Data impossível (31/02, mês 13) não vira valor: o campo fica vazio e a
  // validação do formulário reclama, em vez de gravar lixo.
  const data = new Date(`${ano}-${mes}-${dia}T00:00:00Z`);
  if (Number.isNaN(data.getTime()) || data.getUTCDate() !== Number(dia)) return "";
  return `${ano}-${mes}-${dia}`;
}

/** Aplica a máscara conforme se digita: 31122026 -> 31/12/2026. */
function mascarar(texto: string) {
  const digitos = texto.replace(/\D/g, "").slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

export function CampoData({
  id,
  name,
  defaultValue,
  value,
  aoMudar,
  required,
  className,
}: {
  id?: string;
  name: string;
  /** ISO "YYYY-MM-DD" — uso não controlado. */
  defaultValue?: string | null;
  /** ISO "YYYY-MM-DD" — uso controlado; exige `aoMudar`. */
  value?: string;
  aoMudar?: (iso: string) => void;
  required?: boolean;
  className?: string;
}) {
  const controlado = value !== undefined;
  const [texto, setTexto] = useState(isoParaBr(value ?? defaultValue ?? ""));
  const nativoRef = useRef<HTMLInputElement>(null);

  const textoAtual = controlado ? isoParaBr(value ?? "") : texto;
  const iso = brParaIso(textoAtual);

  function atualizar(novoTexto: string) {
    const mascarado = mascarar(novoTexto);
    if (!controlado) setTexto(mascarado);
    aoMudar?.(brParaIso(mascarado));
  }

  function abrirCalendario() {
    const nativo = nativoRef.current;
    if (!nativo) return;
    // showPicker é o jeito suportado de abrir o calendário de um input oculto;
    // onde não existir, o clique no próprio input ainda resolve.
    if (typeof nativo.showPicker === "function") nativo.showPicker();
    else nativo.click();
  }

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        value={textoAtual}
        onChange={(e) => atualizar(e.target.value)}
        placeholder="DD/MM/AAAA"
        inputMode="numeric"
        maxLength={10}
        required={required}
        pattern="\d{2}/\d{2}/\d{4}"
        title="Use o formato DD/MM/AAAA"
        className="pr-8"
        aria-label={id ? undefined : name}
      />

      {/* É este que o formulário envia. */}
      <input type="hidden" name={name} value={iso} />

      <button
        type="button"
        onClick={abrirCalendario}
        className="absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground hover:text-foreground"
        aria-label="Abrir calendário"
      >
        <CalendarIcon className="size-4" />
      </button>

      <input
        ref={nativoRef}
        type="date"
        value={iso}
        onChange={(e) => {
          const br = isoParaBr(e.target.value);
          if (!controlado) setTexto(br);
          aoMudar?.(e.target.value);
        }}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-2 h-0 w-0 opacity-0"
      />
    </div>
  );
}
