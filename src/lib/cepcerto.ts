import type { OpcaoFrete } from "@avilaops/checkout";
import type { PedidoDeCotacao } from "@/lib/melhor-envio";

/**
 * Cotação de frete pela CepCerto, na conta da plataforma.
 *
 * É a cotação da loja que não conectou o próprio Melhor Envio: uma conta só
 * cota para todas, com o CEP de origem de cada uma. Este arquivo só conhece o
 * contrato da API e não toca no banco.
 *
 * **Qual porta.** A CepCerto tem três, e só esta serve hoje:
 *   - `api-cotacao-frete`, com o token de postagem: aceita o token e devolve
 *     500 "Não foi possível calcular o frete" até para o exemplo da própria
 *     documentação (conferido em 13/10/2026, com saldo R$ 0,00 na carteira);
 *   - `ws/json-frete`, com a chave de consumo: só Correios;
 *   - **`widget_frete/api/cotacao`, com a chave pública**: é a do "Frete no seu
 *     site", que cota Correios, Jadlog e Loggi no plano de consumo da conta. A
 *     chave é pública por definição (vai no HTML de quem usa o widget); o que
 *     protege a conta é a lista de domínios e IPs do painel deles. Como a
 *     chamada sai do servidor, **o IP de saída do servidor precisa estar
 *     autorizado lá** (CepCerto, Frete no seu site, Domínios e IPs). Sem isso a
 *     resposta é 401 "Chave pública, domínio ou IP não autorizado".
 *
 * A chamada fica no servidor, e não no navegador com o widget, porque o preço
 * do frete entra no total do pedido: o que o navegador calcula o comprador
 * pode alterar.
 */
const ENDPOINT = "https://cepcerto.com/widget_frete/api/cotacao";

export function chaveDaCepCerto(env: Record<string, string | undefined> = process.env): string {
  const chave = (env.CEPCERTO_PUBLIC_KEY ?? "").trim();
  return /^pk_[A-Za-z0-9_]{16,120}$/.test(chave) ? chave : "";
}

/** A plataforma tem a cotação da CepCerto configurada? */
export function cepCertoConfigurada(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(chaveDaCepCerto(env));
}

const semAcento = (v: unknown) => String(v ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const temPalavra = (texto: string, palavra: string) => new RegExp(`(^|[^a-z0-9])${palavra}([^a-z0-9]|$)`).test(texto);

/**
 * Que serviço é, pela mesma leitura que o widget da CepCerto faz do par
 * `servico` / `transportadora`. `null` é o que a loja não oferece:
 *
 *   - **preço de balcão** dos Correios: é a tabela cheia, sem o desconto do
 *     contrato. Mostrar os dois deixaria o comprador escolher o mais caro pelo
 *     mesmo serviço;
 *   - **Mini Envios**: a CepCerto cota mas não posta. Oferecer seria cobrar o
 *     Mini Envios e emitir uma etiqueta PAC, mais cara, em toda venda que
 *     escolhesse a opção mais barata;
 *   - drop-off e o que não for reconhecido.
 *
 * Os nomes são os que `servicoDoPedido` (`postagem.ts`) sabe despachar.
 */
function servicoDaCotacao(c: Record<string, unknown>): { id: string; nome: string } | null {
  const servico = semAcento(c.servico);
  const transportadora = semAcento(c.transportadora);
  if (servico.includes("balcao") || servico.includes("mini") || servico.includes("dropoff")) return null;
  if (transportadora.includes("loggi") || servico.includes("loggi")) return { id: "loggi", nome: "Loggi" };
  if (servico.includes("dotcom") || servico.includes(".com")) return { id: "jadlog-dotcom", nome: "Jadlog .com" };
  if (transportadora.includes("jadlog") || servico.includes("jadlog") || servico.includes("package")) return { id: "jadlog-package", nome: "Jadlog Package" };
  if (temPalavra(servico, "sedex")) return { id: "sedex", nome: "SEDEX" };
  if (temPalavra(servico, "pac")) return { id: "pac", nome: "PAC" };
  return null;
}

/** "15,90" → 1590. Vírgula decimal, como a CepCerto escreve. */
function centavos(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? "").replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : undefined;
}

/** "até 5 dias" → 5. Sem número reconhecível, assume uma semana. */
function diasDoPrazo(v: unknown): number {
  const n = Number.parseInt(String(v ?? "").replace(/\D+/g, " ").trim().split(" ")[0] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 7;
}

/**
 * Converte a resposta da CepCerto nas opções que o checkout mostra. A resposta
 * é `{ status: "sucesso", cotacoes: [{ servico, transportadora, valor, prazo }] }`.
 * Serviço repetido fica com o menor preço.
 */
export function extrairCotacoesCepCerto(dados: unknown): OpcaoFrete[] {
  const d = (dados ?? {}) as { status?: unknown; cotacoes?: unknown };
  if (d.status !== "sucesso" || !Array.isArray(d.cotacoes)) return [];

  const porServico = new Map<string, OpcaoFrete>();
  for (const bruto of d.cotacoes) {
    const c = (bruto ?? {}) as Record<string, unknown>;
    const servico = servicoDaCotacao(c);
    const preco = centavos(c.valor);
    if (!servico || preco === undefined) continue;
    const atual = porServico.get(servico.id);
    if (atual && atual.preco <= preco) continue;
    porServico.set(servico.id, { id: `cepcerto:${servico.id}`, nome: servico.nome, preco, prazoDiasUteis: diasDoPrazo(c.prazo) });
  }
  return [...porServico.values()].sort((a, b) => a.preco - b.preco);
}

/**
 * Cota o trecho na conta da plataforma. Devolve `null` quando não dá para
 * cotar, e quem chama cai na tabela da loja. A falha vai para o log com o
 * motivo: foi por falhar calada que esta cotação ficou meses devolvendo nada.
 */
export async function cotarCepCerto(p: PedidoDeCotacao): Promise<OpcaoFrete[] | null> {
  const chave = chaveDaCepCerto();
  if (!chave) return null;

  try {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", "x-cepcerto-public-key": chave },
      body: JSON.stringify({
        public_key: chave,
        cep_remetente: p.cepOrigem,
        cep_destinatario: p.cepDestino,
        peso: String(p.pesoKg),
        altura: String(p.caixa.altura),
        largura: String(p.caixa.largura),
        comprimento: String(p.caixa.comprimento),
        // O seguro da CepCerto vai de R$ 50 a R$ 35.000: fora disso a cotação
        // inteira é recusada, e o pedido barato ficaria sem frete.
        valor_encomenda: Math.min(Math.max(p.valorDeclarado, 50), 35_000).toFixed(2),
      }),
      signal: AbortSignal.timeout(8000),
    });

    const dados: unknown = await r.json().catch(() => null);
    if (!r.ok) {
      console.error(`[frete] CepCerto respondeu ${r.status}:`, String((dados as { mensagem?: unknown } | null)?.mensagem ?? "").slice(0, 300));
      return null;
    }
    const cotacoes = extrairCotacoesCepCerto(dados);
    if (!cotacoes.length) {
      console.error(`[frete] CepCerto sem serviço para ${p.cepOrigem} → ${p.cepDestino}:`, JSON.stringify(dados ?? null).slice(0, 300));
      return null;
    }
    return cotacoes;
  } catch (erro) {
    console.error("[frete] CepCerto indisponível:", erro instanceof Error ? erro.message : erro);
    return null;
  }
}
