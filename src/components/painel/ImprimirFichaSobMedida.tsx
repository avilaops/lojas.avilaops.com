"use client";

import { Printer } from "lucide-react";

export default function ImprimirFichaSobMedida() {
  return (
    <button type="button" className="btn-secundario ficha-sob-medida-nao-imprimir" onClick={() => window.print()}>
      <Printer aria-hidden="true" size={16} /> Imprimir ficha
    </button>
  );
}
