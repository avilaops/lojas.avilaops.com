"use client";

import { useState } from "react";

/**
 * O que a vitrine diz quando a imagem não é do próprio item.
 *
 * Foto de família é aceitável em catálogo técnico (todo rolamento 6200 se
 * parece), mas só com o aviso: a peça da foto pode ter blindagem, vedação ou
 * marca diferentes da que vai na caixa. Sem dizer isso, a economia de
 * fotografia vira devolução.
 */
const AVISO: Record<string, string> = {
  representativa: "Imagem representativa da série. Confira as medidas e especificações deste produto.",
  ilustracao: "Ilustração técnica gerada a partir das medidas cadastradas, não é foto do produto.",
};

/** Galeria: foto principal com zoom ao passar o mouse e miniaturas clicáveis. */
export default function GaleriaProduto({ imagens, alt, origem = "propria" }: { imagens: string[]; alt: string; origem?: string }) {
  const aviso = imagens.length > 0 ? AVISO[origem] : undefined;
  const [atual, setAtual] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const principal = imagens[atual];
  const grande = principal && /\/uploads\//.test(principal) && !/\.svg$/i.test(principal) ? `${principal}?w=1200` : principal;

  return (
    <div className="grid gap-2">
      <div
        className="relative aspect-square overflow-hidden rounded-xl bg-muted"
        onPointerMove={(e) => {
          // O zoom por posição é útil com mouse, mas um gesto de toque no
          // celular não deve deixar a foto ampliada depois de rolar a página.
          if (e.pointerType !== "mouse") return;
          const r = e.currentTarget.getBoundingClientRect();
          setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
        }}
        onPointerLeave={() => setZoom(null)}
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
          {imagens.slice(0, 20).map((img, i) => (
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
