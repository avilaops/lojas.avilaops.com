"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useConsentimento } from "@/lib/consentimento";

/**
 * A medição da vitrine, do lado do navegador.
 *
 * Avisa o servidor a cada página vista. É de propósito um `fetch` com
 * `keepalive`, e não um pixel ou um script de terceiro: a loja mede a própria
 * audiência no próprio domínio, sem nada sair para fora.
 *
 * Três cuidados que valem explicação:
 *
 * - **O referrer só vai na primeira página.** Dentro da navegação em SPA, o
 *   `document.referrer` continua sendo o de quem trouxe a pessoa ao site, e
 *   remandá-lo em cada clique faria o servidor tentar abrir sessão nova a cada
 *   página. Da segunda em diante, o servidor só precisa saber que houve mais
 *   uma página.
 * - **Falha é silêncio.** Medição que derruba a página é pior do que não medir:
 *   o `catch` vazio existe para que um bloqueador de conteúdo, um modo anônimo
 *   ou uma rede ruim não virem erro na loja de um cliente.
 * - **Espera a resposta do consentimento.** `undefined` é "ainda não
 *   hidratou": mandar antes disso registraria como "sem consentimento" quem já
 *   tinha aceitado.
 */
export default function MedirSessao() {
  const pathname = usePathname();
  const parametros = useSearchParams();
  const consentimento = useConsentimento();
  /** Endereço já contado, para o React 18 em modo estrito não contar duas vezes. */
  const contado = useRef<string | null>(null);
  const primeira = useRef(true);

  useEffect(() => {
    if (consentimento === undefined) return;
    const busca = parametros.toString();
    const endereco = busca ? `${pathname}?${busca}` : pathname;
    if (contado.current === endereco) return;
    contado.current = endereco;

    const inicial = primeira.current;
    primeira.current = false;

    void fetch("/api/vitrine/sessao", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        caminho: pathname,
        busca,
        referrer: inicial ? document.referrer || null : null,
        consentimento,
      }),
    }).catch(() => {});
  }, [pathname, parametros, consentimento]);

  return null;
}
