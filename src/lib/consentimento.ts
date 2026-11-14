"use client";

import { useSyncExternalStore } from "react";
import { CHAVE, VERSAO, escolhaValida, type Escolha } from "./consentimento-config";
export { ATRIBUTO_RESPONDIDO, CHAVE, VERSAO } from "./consentimento-config";
export type { Escolha } from "./consentimento-config";

/**
 * Consentimento de cookies (LGPD, art. 7º e 8º).
 *
 * Cookie de carrinho e de sessão são necessários para o serviço pedido pelo
 * comprador e não dependem de consentimento. Pixel de anúncio depende: sem
 * permissão de publicidade, Meta e TikTok não são carregados. A medição e as
 * permissões de publicidade do Google são independentes e começam negadas.
 *
 * A escolha fica só no navegador de quem visitou • a loja não guarda perfil de
 * visitante em lugar nenhum, o que também é o que mantém o custo por loja baixo.
 */
const EVENTO = "loja:consentimento";
export const EVENTO_PREFERENCIAS = "loja:abrir-preferencias-cookies";

function lerDoNavegador(): Escolha | null {
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (!bruto) return null;
    const v = JSON.parse(bruto) as { escolha?: string; versao?: number };
    if (v.versao !== VERSAO) return null;
    return escolhaValida(v.escolha) ? v.escolha : null;
  } catch {
    // Navegador anônimo ou storage bloqueado: trata como "ainda não respondeu",
    // que é o estado mais restritivo — nenhum pixel de terceiro carrega.
    return null;
  }
}

/**
 * Fonte da verdade para o React. `undefined` é "ainda não sabemos" — é o que o
 * servidor devolve antes de conhecer a escolha local.
 */
let cache: Escolha | null | undefined;

/** Também protege disparos com SDK já carregado e storage indisponível. */
export function lerConsentimentoAtual(): Escolha | null {
  return cache === undefined ? lerDoNavegador() : cache;
}

function snapshot(): Escolha | null {
  if (cache === undefined) cache = lerDoNavegador();
  return cache;
}

const snapshotNoServidor = () => undefined;

/** `undefined` enquanto não hidratou, `null` quando o visitante ainda não respondeu. */
export function useConsentimento(): Escolha | null | undefined {
  return useSyncExternalStore(assinarConsentimento, snapshot, snapshotNoServidor);
}

export function salvarConsentimento(escolha: Escolha) {
  cache = escolha;
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify({ escolha, versao: VERSAO, em: new Date().toISOString() }));
  } catch {
    /* sem storage, vale só para esta navegação */
  }
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: escolha }));
}

/** Abrir o painel não modifica a decisão nem o armazenamento. */
export function reabrirConsentimento() {
  window.dispatchEvent(new Event(EVENTO_PREFERENCIAS));
}

export function assinarConsentimento(aoMudar: () => void): () => void {
  window.addEventListener(EVENTO, aoMudar);
  return () => window.removeEventListener(EVENTO, aoMudar);
}
