"use client";

import { Search } from "lucide-react";
import { registrarEventoFunil } from "@/lib/eventos-loja";

export default function BuscaTecnica() {
  return (
    <form
      action="/produtos"
      method="get"
      className="industrial-busca-livre"
      role="search"
      onSubmit={() => registrarEventoFunil("search")}
    >
      <label htmlFor="industrial-busca">Código, referência, aplicação ou medida</label>
      <div>
        <Search aria-hidden="true" />
        <input
          id="industrial-busca"
          name="q"
          type="search"
          autoComplete="off"
          required
          placeholder="Ex.: 6204-2RS, 20 × 47 × 14 ou aplicação"
        />
        <button type="submit">Identificar peça</button>
      </div>
    </form>
  );
}
