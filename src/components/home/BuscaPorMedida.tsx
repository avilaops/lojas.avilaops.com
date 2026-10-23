"use client";

import { useState, type FormEvent } from "react";
import { registrarEventoFunil } from "@/lib/eventos-loja";
import { numeroEmMilimetros, urlDaBuscaPorMedida } from "@/lib/home-industrial";

/**
 * Busca pela medida da peça, que é como vedação se compra: diâmetro interno,
 * diâmetro externo e altura, em milímetros, medidos no alojamento.
 *
 * Cada campo preenchido vira uma faixa de meio milímetro para cada lado nos
 * filtros que o catálogo já tem (`di_de`/`di_ate` etc.): paquímetro e peça
 * usada não dão o número do catálogo, e busca exata devolveria lista vazia
 * para quem mediu 50,7 numa peça de 50,8.
 */
const CAMPOS = [
  { prefixo: "di", rotulo: "Diâmetro interno" },
  { prefixo: "de", rotulo: "Diâmetro externo" },
  { prefixo: "alt", rotulo: "Altura" },
] as const;

export const paraMilimetros = numeroEmMilimetros;

export default function BuscaPorMedida() {
  const [valores, setValores] = useState<Record<string, string>>({ di: "", de: "", alt: "" });
  const [aviso, setAviso] = useState("");

  function buscar(e: FormEvent) {
    e.preventDefault();
    const destino = urlDaBuscaPorMedida(valores as Record<"di" | "de" | "alt", string>);
    if (!destino) {
      setAviso("Informe ao menos uma medida, em milímetros.");
      return;
    }
    registrarEventoFunil("filter_apply");
    window.location.assign(destino);
  }

  return (
    <form className="industrial-medida" onSubmit={buscar} noValidate>
      <div className="industrial-medida-campos">
        {CAMPOS.map(({ prefixo, rotulo }, i) => (
          <label key={prefixo}>
            <span>{rotulo}</span>
            <span className="industrial-medida-entrada">
              <input
                inputMode="decimal"
                autoComplete="off"
                placeholder={["50,8", "63,5", "9,52"][i]}
                value={valores[prefixo]}
                onChange={(ev) => { setAviso(""); setValores({ ...valores, [prefixo]: ev.target.value }); }}
              />
              <abbr title="milímetros">mm</abbr>
            </span>
          </label>
        ))}
        <button type="submit" className="industrial-medida-botao">Buscar pela medida</button>
      </div>
      <p className="industrial-medida-ajuda" role="status">
        {aviso || "Aceita meio milímetro de diferença para mais ou para menos. Pode preencher só uma ou duas medidas."}
      </p>
    </form>
  );
}
