"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { registrarEventoFunil } from "@/lib/eventos-loja";
import { CAMPOS_MEDIDA as CAMPOS, prepararBuscaMedida, type TipoBuscaMedida } from "@/lib/busca-medida";

/**
 * Localiza candidatos pelas dimensões cadastradas em milímetros.
 * A faixa aproximada não representa tolerância de fabricação ou montagem.
 */
export default function BuscaPorMedida() {
  const id = useId();
  const entradas = useRef<Record<string, HTMLInputElement | null>>({});
  const [tipo, setTipo] = useState<TipoBuscaMedida>("aproximada");
  const [valores, setValores] = useState<Record<string, string>>({ di: "", de: "", alt: "" });
  const [aviso, setAviso] = useState("");
  const [campoInvalido, setCampoInvalido] = useState<string>();

  function buscar(e: FormEvent) {
    e.preventDefault();
    const resultado = prepararBuscaMedida(valores, tipo);
    if (!resultado.ok) {
      setAviso(resultado.mensagem);
      setCampoInvalido(resultado.campo);
      entradas.current[resultado.campo ?? CAMPOS[0].prefixo]?.focus();
      return;
    }
    registrarEventoFunil("filter_apply");
    window.location.assign(`/produtos?${resultado.query}`);
  }

  return (
    <form className="industrial-medida" onSubmit={buscar} noValidate>
      <label className="mb-3">
        <span>Tipo de busca por medidas</span>
        <select
          className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
          value={tipo}
          aria-describedby={`${id}-ajuda`}
          onChange={(ev) => {
            setTipo(ev.target.value === "exata" ? "exata" : "aproximada");
            setAviso("");
            setCampoInvalido(undefined);
          }}
        >
          <option value="aproximada">Aproximada: até 0,5 mm acima ou abaixo</option>
          <option value="exata">Exata: somente a medida cadastrada</option>
        </select>
      </label>
      <div className="industrial-medida-campos">
        {CAMPOS.map(({ prefixo, rotulo }, i) => (
          <label key={prefixo}>
            <span>{rotulo}</span>
            <span className="industrial-medida-entrada">
              <input
                ref={(elemento) => { entradas.current[prefixo] = elemento; }}
                inputMode="decimal"
                autoComplete="off"
                placeholder={["50,8", "63,5", "9,52"][i]}
                value={valores[prefixo]}
                aria-invalid={campoInvalido === prefixo || undefined}
                aria-describedby={aviso ? `${id}-erro ${id}-ajuda` : `${id}-ajuda`}
                onChange={(ev) => { setAviso(""); setCampoInvalido(undefined); setValores({ ...valores, [prefixo]: ev.target.value }); }}
              />
              <abbr title="milímetros">mm</abbr>
            </span>
          </label>
        ))}
        <button type="submit" className="industrial-medida-botao">Buscar pela medida</button>
      </div>
      {aviso && <p id={`${id}-erro`} className="industrial-medida-ajuda" role="alert">{aviso}</p>}
      <p id={`${id}-ajuda`} className="industrial-medida-ajuda">
        {tipo === "aproximada" ? "Busca aproximada: até 0,5 mm acima ou abaixo." : "Busca exata: considera somente o valor cadastrado, sem ampliar a faixa."}{" "}
        Pode preencher apenas uma medida. Medidas iguais ou próximas não confirmam encaixe ou compatibilidade: confira perfil, material e aplicação.
      </p>
    </form>
  );
}
