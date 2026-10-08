"use client";

import { createContext, useContext, type ComponentProps, type ReactNode } from "react";
import Link from "next/link";

/**
 * O link dos componentes da loja: o `next/link`, com uma chave a mais.
 *
 * A prévia do tema (`/painel/previa`) desenha a home da loja no domínio do
 * painel, onde `/produtos` e `/categoria/<slug>` não existem. O `next/link`
 * pré-carrega todo link que aparece na tela, e cada um voltava 404. O Next 16
 * não tem chave global para isso, só `prefetch={false}` link a link; então a
 * decisão mora num contexto, que a prévia liga com `SemPreCarregamento`.
 *
 * Sem provedor o contexto está desligado e `prefetch` não é tocado: na loja
 * publicada vale o padrão do Next, como sempre valeu.
 *
 * Componente de `src/components/` fora de `painel/` e `aplicacao/` importa
 * daqui, não de `next/link` (preso em `src/lib/previa-tema.test.ts`).
 */
const SemPreCarregamentoContexto = createContext(false);

export function SemPreCarregamento({ children }: { children: ReactNode }) {
  return <SemPreCarregamentoContexto.Provider value={true}>{children}</SemPreCarregamentoContexto.Provider>;
}

export default function LinkLoja(props: ComponentProps<typeof Link>) {
  const semPreCarregamento = useContext(SemPreCarregamentoContexto);
  return semPreCarregamento ? <Link {...props} prefetch={false} /> : <Link {...props} />;
}
