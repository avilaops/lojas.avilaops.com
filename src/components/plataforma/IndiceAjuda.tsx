"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, List } from "lucide-react";

type Capitulo = { id: string; titulo: string };

export default function IndiceAjuda({ capitulos, rotulo = "Capítulos da ajuda" }: { capitulos: readonly Capitulo[]; rotulo?: string }) {
  const [atual, setAtual] = useState(capitulos[0]?.id ?? "");
  const painel = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const telaAmpla = window.matchMedia("(min-width: 761px)");
    function ajustarIndice() {
      if (painel.current) painel.current.open = telaAmpla.matches;
    }
    ajustarIndice();
    telaAmpla.addEventListener("change", ajustarIndice);
    const secoes = capitulos.map(({ id }) => document.getElementById(id)).filter((secao) => secao !== null);
    let quadro: number | null = null;
    function atualizar() {
      quadro = null;
      let id = secoes[0]?.id ?? "";
      for (const secao of secoes) {
        if (secao.getBoundingClientRect().top <= 128) id = secao.id;
      }
      setAtual(id);
    }
    function agendar() {
      if (quadro === null) quadro = window.requestAnimationFrame(atualizar);
    }
    agendar();
    window.addEventListener("scroll", agendar, { passive: true });
    window.addEventListener("resize", agendar);
    return () => {
      telaAmpla.removeEventListener("change", ajustarIndice);
      window.removeEventListener("scroll", agendar);
      window.removeEventListener("resize", agendar);
      if (quadro !== null) window.cancelAnimationFrame(quadro);
    };
  }, [capitulos]);

  return <nav aria-label={rotulo}>
    <details ref={painel} className="ajuda-capitulos">
      <summary><List size={16} aria-hidden="true" /><span>Neste guia</span><ChevronDown size={16} aria-hidden="true" /></summary>
      <ol>{capitulos.map((capitulo) => <li key={capitulo.id}>
        <a href={`#${capitulo.id}`} aria-current={atual === capitulo.id ? "location" : undefined}
          onClick={() => {
            setAtual(capitulo.id);
            if (window.matchMedia("(max-width: 760px)").matches && painel.current) painel.current.open = false;
          }}>{capitulo.titulo}</a>
      </li>)}</ol>
    </details>
  </nav>;
}
