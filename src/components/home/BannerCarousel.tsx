"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Campanha = { imagemUrl: string; imagemMobileUrl?: string; link: string; alt: string };

export default function BannerCarousel({ campanhas }: { campanhas: Campanha[] }) {
  const trilho = useRef<HTMLDivElement>(null);
  const [ativa, setAtiva] = useState(0);
  const [pausado, setPausado] = useState(false);

  useEffect(() => {
    if (campanhas.length < 2 || pausado || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const temporizador = window.setInterval(() => {
      const elemento = trilho.current;
      if (!elemento) return;
      const destino = ativa >= campanhas.length - 1 ? 0 : ativa + 1;
      elemento.scrollTo({ left: elemento.clientWidth * destino });
    }, 6000);
    return () => window.clearInterval(temporizador);
  }, [ativa, campanhas.length, pausado]);

  if (!campanhas.length) return null;

  function navegar(direcao: -1 | 1) {
    const elemento = trilho.current;
    if (!elemento) return;
    const destino = Math.max(0, Math.min(campanhas.length - 1, ativa + direcao));
    elemento.scrollTo({ left: elemento.clientWidth * destino });
  }

  return (
    <section
      className="banner-campanhas"
      aria-label="Campanhas da loja"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocusCapture={() => setPausado(true)}
      onBlurCapture={(evento) => {
        if (!evento.currentTarget.contains(evento.relatedTarget as Node | null)) setPausado(false);
      }}
      onTouchStart={() => setPausado(true)}
      onTouchEnd={() => setPausado(false)}
    >
      <div
        className="banner-campanhas-trilho"
        ref={trilho}
        onScroll={(evento) => {
          const elemento = evento.currentTarget;
          setAtiva(Math.round(elemento.scrollLeft / elemento.clientWidth));
        }}
      >
        {campanhas.map((campanha, indice) => {
          const mobileVertical = campanha.imagemMobileUrl?.endsWith("campanha-geral-v3-mobile.svg") ?? false;
          return (
          <Link className={`banner-campanha${mobileVertical ? " banner-campanha-mobile-vertical" : ""}`} key={`${campanha.imagemUrl}-${indice}`} href={campanha.link}>
            <picture>
              {campanha.imagemMobileUrl && <source media="(max-width: 640px)" srcSet={campanha.imagemMobileUrl} />}
              <img
                src={campanha.imagemUrl}
                alt={campanha.alt}
                width={1600}
                height={900}
                fetchPriority={indice === 0 ? "high" : "auto"}
                loading={indice === 0 ? "eager" : "lazy"}
              />
            </picture>
          </Link>
          );
        })}
      </div>
      {campanhas.length > 1 && <>
        <button className="banner-campanhas-seta anterior" type="button" aria-label="Campanha anterior" onClick={() => navegar(-1)} disabled={ativa === 0}>
          <ChevronLeft aria-hidden="true" />
        </button>
        <button className="banner-campanhas-seta proxima" type="button" aria-label="Próxima campanha" onClick={() => navegar(1)} disabled={ativa === campanhas.length - 1}>
          <ChevronRight aria-hidden="true" />
        </button>
        <div className="banner-campanhas-pontos" aria-label={`Campanha ${ativa + 1} de ${campanhas.length}`}>
          {campanhas.map((campanha, indice) => (
            <button
              key={`${campanha.imagemUrl}-ponto-${indice}`}
              type="button"
              aria-label={`Mostrar campanha ${indice + 1}`}
              aria-current={ativa === indice ? "true" : undefined}
              onClick={() => trilho.current?.scrollTo({ left: (trilho.current?.clientWidth ?? 0) * indice })}
            />
          ))}
        </div>
      </>}
    </section>
  );
}
