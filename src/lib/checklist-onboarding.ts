import type { Tenant } from "@prisma/client";
import { retiradaPublicaDisponivel } from "./retirada-publica";

/**
 * Checklist de onboarding da visão geral do painel.
 *
 * O estado é derivado do que a loja já tem gravado: não existe coluna nem
 * evento "onboarding concluído". Por isso nunca fica desatualizado e vale
 * também para as lojas que já existiam antes dele.
 */

export type IdPasso = "identidade" | "dominio" | "catalogo" | "recebimento" | "entrega" | "publicacao";

/** Exatamente o que a regra lê; nada além disso entra na conta. */
export type EntradaChecklist = {
  status: string;
  url: string;
  logoUrl: string | null;
  whatsapp: string | null;
  dominioPrincipal: string | null;
  produtosAtivos: number;
  mpConfigurado: boolean;
  cepOrigem: string | null;
  tabelaFrete: readonly unknown[];
  entregaLocal: readonly unknown[];
  retiradaNaLoja: boolean;
  enderecoPublico: boolean;
  endereco: Record<string, unknown> | null;
};

export type PassoChecklist = {
  id: IdPasso;
  titulo: string;
  feito: boolean;
  /** Passo opcional não segura a publicação nem o "completo". */
  opcional: boolean;
  detalhe: string;
  /** Caminho do painel; no último passo já feito, a URL da loja. */
  href: string;
  acao: string;
};

export type ResumoChecklist = {
  feitos: number;
  total: number;
  obrigatoriosPendentes: number;
  completo: boolean;
  proximo: PassoChecklist | null;
};

const preenchido = (texto: string | null | undefined) => typeof texto === "string" && texto.trim().length > 0;

function identidade(e: EntradaChecklist): PassoChecklist {
  const temLogo = preenchido(e.logoUrl);
  const temWhatsapp = preenchido(e.whatsapp);
  const feito = temLogo && temWhatsapp;
  const detalhe = feito
    ? "Símbolo da marca e WhatsApp de atendimento estão na loja."
    : !temLogo && !temWhatsapp
      ? "Faltam o símbolo da marca e o WhatsApp de atendimento."
      : !temLogo
        ? "Falta o símbolo da marca."
        : "Falta o WhatsApp de atendimento.";
  return { id: "identidade", titulo: "Identidade", feito, opcional: false, detalhe, href: "/painel/configuracoes/marca", acao: "Completar a identidade" };
}

function dominio(e: EntradaChecklist): PassoChecklist {
  const feito = preenchido(e.dominioPrincipal);
  const detalhe = feito
    ? `A loja atende em ${e.dominioPrincipal!.trim()}.`
    : `A loja já atende em ${e.url}. O domínio próprio pode vir depois.`;
  return { id: "dominio", titulo: "Domínio", feito, opcional: true, detalhe, href: "/painel/configuracoes/dominio", acao: "Ligar um domínio próprio" };
}

function catalogo(e: EntradaChecklist): PassoChecklist {
  const feito = e.produtosAtivos >= 1;
  const detalhe = feito
    ? e.produtosAtivos === 1
      ? "1 produto ativo na vitrine."
      : `${e.produtosAtivos.toLocaleString("pt-BR")} produtos ativos na vitrine.`
    : "Nenhum produto ativo: a vitrine está vazia.";
  return { id: "catalogo", titulo: "Catálogo", feito, opcional: false, detalhe, href: "/painel/produtos", acao: "Cadastrar o primeiro produto" };
}

function recebimento(e: EntradaChecklist): PassoChecklist {
  const feito = e.mpConfigurado === true;
  const detalhe = feito
    ? "A conta do Mercado Pago está ligada: o cliente consegue pagar."
    : "Sem a conta do Mercado Pago, o cliente monta o carrinho e não consegue pagar.";
  return { id: "recebimento", titulo: "Recebimento", feito, opcional: false, detalhe, href: "/painel/configuracoes/recebimento", acao: "Ligar o Mercado Pago" };
}

function entrega(e: EntradaChecklist): PassoChecklist {
  const feito =
    (e.cepOrigem ?? "").replace(/\D/g, "").length === 8 ||
    e.tabelaFrete.length > 0 ||
    e.entregaLocal.length > 0 ||
    // `retiradaNaLoja` nasce `true` no schema: sozinho não prova nada, então
    // vale a mesma regra da vitrine (endereço público completo).
    retiradaPublicaDisponivel({ retiradaNaLoja: e.retiradaNaLoja, enderecoPublico: e.enderecoPublico, endereco: e.endereco as Tenant["endereco"] });
  const detalhe = feito
    ? "A loja tem pelo menos uma forma de entregar o pedido."
    : "Falta uma forma de entrega: CEP de origem, tabela de frete, entrega local ou retirada com endereço público.";
  return { id: "entrega", titulo: "Entrega", feito, opcional: false, detalhe, href: "/painel/configuracoes/entrega", acao: "Configurar a entrega" };
}

const ESTADO_FORA_DO_AR: Record<string, string> = {
  PROVISIONANDO: "A loja ainda está sendo configurada.",
  SUSPENSA: "A loja está suspensa.",
  CANCELADA: "A loja está cancelada.",
};

function publicacao(e: EntradaChecklist, obrigatorios: PassoChecklist[]): PassoChecklist {
  const pendentes = obrigatorios.filter((p) => !p.feito);
  const base = { id: "publicacao" as const, titulo: "Publicação", opcional: false };

  if (e.status !== "ATIVA") {
    const assinatura = e.status === "SUSPENSA" || e.status === "CANCELADA";
    return {
      ...base,
      feito: false,
      detalhe: ESTADO_FORA_DO_AR[e.status] ?? "A loja não está no ar.",
      href: assinatura ? "/painel/configuracoes/assinatura" : (pendentes[0]?.href ?? "/painel"),
      acao: assinatura ? "Ver a assinatura" : pendentes[0] ? pendentes[0].acao : "Voltar à visão geral",
    };
  }
  if (pendentes.length > 0) {
    return {
      ...base,
      feito: false,
      detalhe: `Para a loja vender ainda falta: ${pendentes.map((p) => p.titulo).join(", ")}.`,
      href: pendentes[0].href,
      acao: pendentes[0].acao,
    };
  }
  return { ...base, feito: true, detalhe: `A loja está no ar e pronta para vender em ${e.url}.`, href: e.url, acao: "Abrir a loja" };
}

/** Sempre seis passos, na ordem do roadmap. */
export function checklistDeOnboarding(entrada: EntradaChecklist): PassoChecklist[] {
  const a = identidade(entrada);
  const b = dominio(entrada);
  const c = catalogo(entrada);
  const d = recebimento(entrada);
  const f = entrega(entrada);
  return [a, b, c, d, f, publicacao(entrada, [a, c, d, f])];
}

export function resumoDoChecklist(passos: PassoChecklist[]): ResumoChecklist {
  const pendentes = passos.filter((p) => !p.opcional && !p.feito);
  return {
    feitos: passos.filter((p) => p.feito).length,
    total: passos.length,
    obrigatoriosPendentes: pendentes.length,
    completo: pendentes.length === 0,
    proximo: pendentes[0] ?? null,
  };
}
