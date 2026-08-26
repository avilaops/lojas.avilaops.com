"use client";

import { useState } from "react";

/**
 * Código de rastreio com botão de copiar.
 *
 * O link vai para a página dos Correios sem o código na URL de propósito: o
 * endereço que aceita o objeto como parâmetro muda de tempos em tempos e um
 * link quebrado no e-mail de entrega gera mais atendimento do que resolve.
 * Copiar e colar sempre funciona.
 */
export default function Rastreio({ codigo, transportadora }: { codigo: string; transportadora: string }) {
  const [copiado, setCopiado] = useState(false);
  const correios = /^[A-Z]{2}\d{9}[A-Z]{2}$/i.test(codigo.trim());

  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-sm">
      <p className="font-semibold">Seu pedido está a caminho</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{transportadora}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="rounded bg-background px-2 py-1 font-mono text-sm">{codigo}</code>
        <button
          type="button"
          className="btn-secundario h-9 px-3 text-xs"
          onClick={() => {
            navigator.clipboard?.writeText(codigo).then(() => {
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2000);
            });
          }}
        >
          {copiado ? "Copiado" : "Copiar código"}
        </button>
        {correios && (
          <a className="btn-secundario h-9 px-3 text-xs" href="https://rastreamento.correios.com.br/app/index.php" target="_blank" rel="noopener">
            Rastrear nos Correios ↗
          </a>
        )}
      </div>
    </div>
  );
}
