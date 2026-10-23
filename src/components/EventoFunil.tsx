"use client";

import { useEffect, useRef, type AnchorHTMLAttributes, type ReactNode } from "react";
import { registrarEventoFunil } from "@/lib/eventos-loja";
import type { EventoFunil as NomeEventoFunil } from "@/lib/funil-analytics";

export function EventoFunil({ eventos }: { eventos: NomeEventoFunil[] }) {
  const enviados = useRef<Set<NomeEventoFunil>>(new Set());
  useEffect(() => {
    for (const evento of eventos) {
      if (enviados.current.has(evento)) continue;
      enviados.current.add(evento);
      registrarEventoFunil(evento);
    }
  }, [eventos]);
  return null;
}

export function LinkContatoMedido({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode }) {
  return <a {...props} onClick={(evento) => { registrarEventoFunil("technical_contact"); props.onClick?.(evento); }}>{children}</a>;
}

