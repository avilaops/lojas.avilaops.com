import type { MensagemWhatsapp } from "./whatsapp";
import { numeroParaMeta } from "./whatsapp";
import { brl } from "./emails-do-evento";

/**
 * Qual template do WhatsApp cada evento dispara, e com que parâmetros.
 *
 * O texto de cada template está aprovado no WhatsApp Manager e transcrito em
 * `docs/WHATSAPP-TEMPLATES.md`. Aqui só entram nome, idioma e a **ordem** dos
 * parâmetros — errar a ordem manda o nome do cliente no lugar do valor, e a
 * Meta não tem como saber.
 *
 * Função pura, como a do e-mail: entra o envelope, sai a mensagem ou `null`.
 */

type Envelope = Record<string, unknown>;

function texto(e: Envelope, campo: string): string | null {
  const v = e[campo];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function inteiro(e: Envelope, campo: string): number | null {
  const v = e[campo];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** "Ana Silva" → "Ana". O template trata por primeiro nome. */
function primeiroNome(nome: string | null): string {
  return nome?.split(/\s+/)[0] ?? "";
}

/** "189,90" — o template já escreve "R$" antes do parâmetro. */
function reaisSemSimbolo(centavos: number): string {
  return brl(centavos).replace(/^R\$\s*/u, "");
}

/**
 * Os templates ligados a um evento direto.
 *
 * `loja_indicacoes` (3 dias depois de ativar) e `pix_pendente` (30 min depois
 * do pedido) ficam de fora: não são reação a um evento, são espera. Enquanto
 * não existir rotina que os dispare, esses dois continuam no n8n — e é por
 * isso que `pedido.criado` não está na lista de tipos que executamos.
 */
export function whatsappDoEvento(envelope: Envelope): MensagemWhatsapp | null {
  const tipo = texto(envelope, "tipo");
  if (!tipo) return null;

  switch (tipo) {
    case "loja.criada":
    case "loja.provisionada": {
      const para = texto(envelope, "whatsapp");
      const loja = texto(envelope, "nome");
      const url = texto(envelope, "url");
      if (!numeroParaMeta(para) || !loja || !url) return null;
      return {
        para: para!,
        template: tipo === "loja.criada" ? "loja_no_ar" : "loja_configurada",
        parametros: [loja, url],
      };
    }

    case "pedido.pago": {
      // Este vai para o lojista, não para o comprador: é ele que separa e envia.
      const para = texto(envelope, "lojistaWhatsapp");
      const total = inteiro(envelope, "totalCentavos");
      if (!numeroParaMeta(para) || total === null) return null;
      const numero = String(inteiro(envelope, "numero") ?? texto(envelope, "referencia") ?? "");
      const cliente = texto(envelope, "clienteNome") ?? "cliente";
      const itens = texto(envelope, "itensTexto") ?? "ver no painel";
      if (!numero) return null;
      return { para: para!, template: "pedido_pago_lojista", parametros: [numero, reaisSemSimbolo(total), cliente, itens] };
    }

    case "pedido.recusado": {
      const para = texto(envelope, "clienteTelefone");
      const loja = texto(envelope, "lojaNome");
      const url = texto(envelope, "lojaUrl");
      if (!numeroParaMeta(para) || !loja || !url) return null;
      return {
        para: para!,
        template: "pagamento_recusado",
        // `{{3}}` é onde refazer a compra. O evento não traz link de carrinho,
        // então vale o da loja — mandar um link quebrado seria pior.
        parametros: [primeiroNome(texto(envelope, "clienteNome")) || "tudo bem", loja, url],
      };
    }

    case "carrinho.abandonado": {
      const para = texto(envelope, "clienteTelefone");
      const loja = texto(envelope, "lojaNome");
      const link = texto(envelope, "linkCarrinho");
      const total = inteiro(envelope, "totalCentavos");
      const itens = texto(envelope, "itensTexto");
      if (!numeroParaMeta(para) || !loja || !link || total === null || !itens) return null;
      return {
        para: para!,
        template: "carrinho_abandonado",
        parametros: [primeiroNome(texto(envelope, "clienteNome")) || "tudo bem", loja, itens, reaisSemSimbolo(total), link],
      };
    }

    default:
      return null;
  }
}
