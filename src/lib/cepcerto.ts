import type { OpcaoFrete } from "@avilaops/checkout";
import type { PedidoDeCotacao } from "@/lib/melhor-envio";

/**
 * PAC e SEDEX pela API de consumo da conta da plataforma.
 * Produto, carrinho e checkout consultam pelo servidor com o token de consulta.
 * A API básica não recebe valor declarado e não confirma seguro adicional.
 * O contrato das lojas conectadas ao Melhor Envio é resolvido em frete.ts.
 */
const ENDPOINT = "https://cepcerto.com/ws/json-frete";

export function chaveDaCepCerto(env: Record<string, string | undefined> = process.env): string {
  const chave = (env.CEPCERTO_CONSULTA_KEY ?? "").trim();
  return chave && !/\s/u.test(chave) ? chave : "";
}

/** A plataforma tem o token de consulta da CepCerto configurado? */
export function cepCertoConfigurada(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(chaveDaCepCerto(env));
}

/** Valores em reais, sem aceitar preço parcial, infinito ou sem confirmação. */
function centavos(v: unknown): number | undefined {
  const bruto = typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : "";
  const decimal = /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(bruto)
    ? bruto.replace(/\./g, "").replace(",", ".")
    : bruto.replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(decimal)) return undefined;
  const n = Math.round(Number(decimal) * 100);
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
}

function diasDoPrazo(v: unknown): number | undefined {
  const texto = typeof v === "number" || typeof v === "string" ? String(v).trim() : "";
  const prazo = /^(?:até\s+)?(\d+)(?:\s+dias?(?:\s+(?:útil|úteis))?)?$/iu.exec(texto);
  const n = prazo ? Number(prazo[1]) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
}

/**
 * A API /ws/json-frete retorna um objeto plano.
 * Oferece apenas o preço com desconto da conta; balcão e Mini Envios não
 * correspondem às etiquetas oferecidas pela plataforma.
 */
export function extrairCotacoesCepCerto(dados: unknown): OpcaoFrete[] {
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) return [];
  const d = dados as Record<string, unknown>;
  if (d.erro || d.status === "erro") return [];

  const opcoes: OpcaoFrete[] = [];
  for (const [id, nome] of [["pac", "PAC"], ["sedex", "SEDEX"]] as const) {
    const preco = centavos(d["valor" + id + "_desconto_cepcerto"]);
    const prazoDiasUteis = diasDoPrazo(d["prazo" + id]);
    if (preco === undefined || prazoDiasUteis === undefined) continue;
    opcoes.push({ id: "cepcerto:" + id, nome, preco, prazoDiasUteis });
  }
  return opcoes.sort((a, b) => a.preco - b.preco);
}

/** Falha de consulta retorna null para manter as alternativas cadastradas. */
export async function cotarCepCerto(p: PedidoDeCotacao): Promise<OpcaoFrete[] | null> {
  const chave = chaveDaCepCerto();
  if (!chave) return null;

  const origem = p.cepOrigem.replace(/\D/g, "");
  const destino = p.cepDestino.replace(/\D/g, "");
  const medidas = [p.caixa.altura, p.caixa.largura, p.caixa.comprimento];
  const gramas = Math.round(p.pesoKg * 1000);
  if (!/^\d{8}$/.test(origem) || !/^\d{8}$/.test(destino)
    || !Number.isFinite(p.pesoKg) || p.pesoKg <= 0 || p.pesoKg > 30 || gramas < 1
    || !medidas.every(n => Number.isFinite(n) && n > 0 && n <= 100)
    || medidas.reduce((soma, n) => soma + n, 0) > 200) return null;

  const caminho = [origem, destino, gramas, ...medidas, chave]
    .map(v => encodeURIComponent(String(v))).join("/");
  try {
    const r = await fetch(ENDPOINT + "/" + caminho, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) {
      console.error("[frete] CepCerto respondeu HTTP " + r.status + " na API de consulta.");
      return null;
    }
    const dados: unknown = await r.json().catch(() => null);
    const cotacoes = extrairCotacoesCepCerto(dados);
    if (!cotacoes.length) {
      console.error("[frete] CepCerto sem PAC ou SEDEX com preço e prazo confirmados.");
      return null;
    }
    return cotacoes;
  } catch {
    // A URL contém o token: nunca registrar erro bruto, corpo ou endereço da chamada.
    console.error("[frete] CepCerto indisponível na API de consulta.");
    return null;
  }
}
