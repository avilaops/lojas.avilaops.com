import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * O `state` das conexões por OAuth: Melhor Envio, Mercado Livre, Shopee,
 * Amazon e Magalu.
 *
 * O retorno de cada serviço é uma rota só para todas as lojas, porque o
 * aplicativo aceita uma URL de retorno. Quem diz de qual loja é a autorização é
 * o `state`, e por isso ele é assinado e vence em quinze minutos: com o slug em
 * claro, bastaria montar o endereço à mão para gravar a própria conta na loja
 * de outro lojista — e o que essa loja vende passaria a cair na conta errada.
 *
 * Assinatura não basta sozinha. Quem recebe o retorno confere também se o slug
 * é o da sessão de quem voltou (`sessaoDoPainel`): um `state` válido emitido
 * para uma loja não pode ser gasto por alguém logado em outra.
 */

const VALIDADE_MS = 15 * 60_000;

function segredo(): Buffer {
  const hex = process.env.LOJAS_SECRET ?? "";
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("LOJAS_SECRET ausente.");
  return Buffer.from(hex, "hex");
}

/**
 * O propósito entra na assinatura por dois motivos: separa este `state` do
 * cookie de sessão, que usa a mesma chave — sem ele, um `state` vazado num log
 * serviria de sessão do painel —, e impede que a autorização de um serviço seja
 * apresentada no retorno de outro.
 */
function assinar(proposito: string, corpo: string): string {
  return createHmac("sha256", segredo()).update(`${proposito}:${corpo}`).digest("base64url");
}

export function emitirState(proposito: string, slug: string): string {
  const corpo = Buffer.from(JSON.stringify({ slug, exp: Date.now() + VALIDADE_MS })).toString("base64url");
  return `${corpo}.${assinar(proposito, corpo)}`;
}

/** O slug da loja, ou `null` se o `state` foi forjado, é de outro serviço ou venceu. */
export function lerState(proposito: string, state: string | null | undefined): string | null {
  const [corpo, assinatura] = (state ?? "").split(".");
  if (!corpo || !assinatura) return null;
  const esperada = assinar(proposito, corpo);
  if (esperada.length !== assinatura.length || !timingSafeEqual(Buffer.from(esperada), Buffer.from(assinatura))) return null;
  try {
    const dados = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8")) as { slug?: unknown; exp?: unknown };
    return typeof dados.slug === "string" && typeof dados.exp === "number" && dados.exp > Date.now() ? dados.slug : null;
  } catch {
    return null;
  }
}
