"use client";

import { useSyncExternalStore } from "react";

/**
 * Consentimento de cookies (LGPD, art. 7º e 8º).
 *
 * Cookie de carrinho e de sessão são necessários para o serviço pedido pelo
 * comprador e não dependem de consentimento. Pixel de anúncio depende: sem
 * "aceito", Meta e TikTok nem são carregados e o Google roda em Consent Mode
 * com armazenamento negado.
 *
 * A escolha fica só no navegador de quem visitou — a loja não guarda perfil de
 * visitante em lugar nenhum, o que também é o que mantém o custo por loja baixo.
 */
export type Escolha = "aceito" | "essencial";

/** Muda quando o texto ou o alcance do consentimento mudar: quem já respondeu é perguntado de novo. */
export const VERSAO = 1;
export const CHAVE = "loja_consentimento";
/** Marca no `<html>` de quem já respondeu; o CSS esconde o aviso por ela antes da hidratação. */
export const ATRIBUTO_RESPONDIDO = "data-cookies-respondido";
const EVENTO = "loja:consentimento";

function lerDoNavegador(): Escolha | null {
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (!bruto) return null;
    const v = JSON.parse(bruto) as { escolha?: string; versao?: number };
    if (v.versao !== VERSAO) return null;
    return v.escolha === "aceito" || v.escolha === "essencial" ? v.escolha : null;
  } catch {
    // Navegador anônimo ou storage bloqueado: trata como "ainda não respondeu",
    // que é o estado mais restritivo — nenhum pixel de terceiro carrega.
    return null;
  }
}

/**
 * Fonte da verdade para o React. `undefined` é "ainda não sabemos" — é o que o
 * servidor devolve, e o que evita o banner piscar para quem já respondeu.
 */
let cache: Escolha | null | undefined;

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

/** Reabre a decisão (link "Cookies" no rodapé). */
export function reabrirConsentimento() {
  cache = null;
  document.documentElement.removeAttribute(ATRIBUTO_RESPONDIDO);
  try {
    window.localStorage.removeItem(CHAVE);
  } catch {
    /* idem */
  }
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: null }));
}

export function assinarConsentimento(aoMudar: () => void): () => void {
  window.addEventListener(EVENTO, aoMudar);
  return () => window.removeEventListener(EVENTO, aoMudar);
}
