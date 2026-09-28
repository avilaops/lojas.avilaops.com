"use client";

import { useState } from "react";

type Props = { src: string; alt: string; className?: string; loading?: "eager" | "lazy"; secondary?: boolean };

export default function SafeProductImage({ src, alt, className = "", loading = "lazy", secondary = false }: Props) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return secondary ? null : <div className="produto-sem-foto flex h-full w-full items-center justify-center text-xs text-muted-foreground">Imagem em preparação</div>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading={loading} onError={() => setFailed(true)} className={className} />;
}
