"use client";

import { useState } from "react";

/**
 * Foto do cartão de produto que não vira ícone quebrado.
 *
 * O endereço da foto pode estar certo no cadastro e mesmo assim não abrir: o
 * arquivo saiu do volume de uploads, a rota de fotos caiu (28/09/2026) ou a
 * origem externa removeu a imagem. Sem isto o navegador mostra o ícone de
 * imagem quebrada no meio da vitrine. Com isto a foto principal vira o mesmo
 * aviso de "sem foto" do produto que nunca teve uma, e a segunda foto (a do
 * hover) simplesmente some.
 *
 * Resgatado do trabalho que estava só no servidor (SafeProductImage, 28/09/2026).
 */
type Props = {
  src: string | null | undefined;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
  /** Segunda foto, a do hover: se falhar, some em vez de mostrar aviso. */
  secundaria?: boolean;
};

export default function FotoDoCartao({ src, alt, className = "", loading = "lazy", secundaria = false }: Props) {
  const [falhou, setFalhou] = useState(false);
  if (falhou || !src) {
    return secundaria ? null : (
      <div className="produto-sem-foto flex h-full w-full items-center justify-center text-xs text-muted-foreground">Sem foto do produto</div>
    );
  }
  // Foto enviada à plataforma tem variantes por largura (`?w=`): no celular o
  // cartão tem ~180 px e baixar a de 480 px era o que o PageSpeed apontava em
  // "melhorar a entrega de imagens". O navegador escolhe pela tela.
  const base = /\/uploads\//.test(src) && /\?w=\d+$/.test(src) ? src.replace(/\?w=\d+$/, "") : null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      srcSet={base ? `${base}?w=320 320w, ${base}?w=480 480w, ${base}?w=800 800w` : undefined}
      sizes={base ? "(max-width: 640px) 46vw, (max-width: 1024px) 31vw, 280px" : undefined}
      alt={alt}
      loading={loading}
      decoding="async"
      onError={() => setFalhou(true)}
      className={className}
    />
  );
}
