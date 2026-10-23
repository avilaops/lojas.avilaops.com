"use client";

import { useState, type FormEvent } from "react";
import { registrarEventoFunil } from "@/lib/eventos-loja";
import { CAMPOS_MEDIDA as CAMPOS, prepararBuscaMedida } from "@/lib/busca-medida";

/**
 * Busca pela medida da peça, que é como vedação se compra: diâmetro interno,
 * diâmetro externo e altura, em milímetros, medidos no alojamento.
 *
 * Cada campo preenchido vira uma faixa de meio milímetro para cada lado nos
 * filtros que o catálogo já tem (`di_de`/`di_ate` etc.): paquímetro e peça
 * usada não dão o número do catálogo, e busca exata devolveria lista vazia
 * para quem mediu 50,7 numa peça de 50,8.
 */
export default function BuscaPorMedida() {
  const [valores, setValores] = useState<Record<string, string>>({ di: "", de: "", alt: "" });
  const [aviso, setAviso] = useState("");
  const [campoInvalido, setCampoInvalido] = useState<string>();

  function buscar(e: FormEvent) {
    e.preventDefault();
    const resultado = prepararBuscaMedida(valores);
    if (!resultado.ok) {
      setAviso(resultado.mensagem);
      setCampoInvalido(resultado.campo);
      return;
    }
    registrarEventoFunil("filter_apply");
    window.location.assign(`/produtos?${resultado.query}`);
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
                aria-invalid={campoInvalido === prefixo || undefined}
                aria-describedby={aviso ? "busca-medida-erro busca-medida-ajuda" : "busca-medida-ajuda"}
                onChange={(ev) => { setAviso(""); setCampoInvalido(undefined); setValores({ ...valores, [prefixo]: ev.target.value }); }}
              />
              <abbr title="milímetros">mm</abbr>
            </span>
          </label>
        ))}
        <button type="submit" className="industrial-medida-botao">Buscar pela medida</button>
      </div>
      {aviso && <p id="busca-medida-erro" className="industrial-medida-ajuda" role="alert">{aviso}</p>}
      <p id="busca-medida-ajuda" className="industrial-medida-ajuda">
        Busca aproximada: até 0,5 mm acima ou abaixo. Pode preencher apenas uma medida. Essa faixa não confirma encaixe ou compatibilidade: confira perfil, material e aplicação.
      </p>
    </form>
  );
}
