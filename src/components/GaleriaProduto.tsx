"use client";

import { useState } from "react";
import { avisoDaImagem } from "@/lib/imagem-origem";

/** Galeria: foto principal com zoom ao passar o mouse e miniaturas clicáveis. */
export default function GaleriaProduto({ imagens, alt, origem = "propria" }: { imagens: string[]; alt: string; origem?: string }) {
  const aviso = avisoDaImagem(origem, imagens.length > 0);
  const [atual, setAtual] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const principal = imagens[atual];
  const grande = principal && /\/uploads\//.test(principal) && !/\.svg$/i.test(principal) ? `${principal}?w=1200` : principal;

  return (
    <div className="grid gap-2">
      <div
        className="relative aspect-square overflow-hidden rounded-xl bg-muted"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
        }}
        onMouseLeave={() => setZoom(null)}
      >
        {grande ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={grande}
            alt={alt}
            className="h-full w-full object-cover transition-transform duration-200"
            style={zoom ? { transform: "scale(2)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Imagem em preparação</div>
        )}
      </div>
      {aviso && <p className="text-xs leading-snug text-muted-foreground">{aviso}</p>}
      {imagens.length > 1 && (
        <div className="grid grid-cols-5 gap-2">
          {imagens.slice(0, 10).map((img, i) => (
            <button key={img} type="button" onClick={() => setAtual(i)} className={`aspect-square overflow-hidden rounded-lg border-2 ${i === atual ? "border-primary" : "border-transparent"}`} aria-label={`Foto ${i + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={/\/uploads\//.test(img) && !/\.svg$/i.test(img) ? `${img}?w=160` : img} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
