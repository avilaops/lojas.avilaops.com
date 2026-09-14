"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

/** Adaptado do Product Carousel de ravikatiyar162 / 21st.dev (8297).
 * Conteúdo permanece no servidor. Sem autoplay, dados de demonstração ou
 * dependência de animação; scroll nativo, ResizeObserver e movimento reduzido.
 */
export default function Trilho({ children, titulo, compacto = false }: { children: React.ReactNode; titulo: string; compacto?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const [estado, setEstado] = useState({ inicio: true, fim: true });
  const conferir = useCallback(() => {
    const el = ref.current;
    if (el) setEstado({ inicio: el.scrollLeft <= 2, fim: el.scrollWidth - el.clientWidth - el.scrollLeft <= 2 });
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(conferir);
    observer.observe(el);
    conferir();
    return () => observer.disconnect();
  }, [conferir, children]);
  function rolar(direcao: number) {
    const el = ref.current;
    el?.scrollBy({ left: direcao * el.clientWidth * 0.8, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  return <div className={`ap-trilho-wrap ${compacto ? "ap-trilho-compacto" : ""}`}>
    <div id={id} ref={ref} className="ap-trilho" onScroll={conferir} tabIndex={0} role="region" aria-label={titulo}>{children}</div>
    {(!estado.inicio || !estado.fim) && <div className="ap-trilho-controles">
      <button type="button" className="ap-icone" disabled={estado.inicio} onClick={() => rolar(-1)} aria-controls={id} aria-label={`Voltar em ${titulo}`}><ArrowLeft size={18}/></button>
      <button type="button" className="ap-icone" disabled={estado.fim} onClick={() => rolar(1)} aria-controls={id} aria-label={`Avançar em ${titulo}`}><ArrowRight size={18}/></button>
    </div>}
  </div>;
}
