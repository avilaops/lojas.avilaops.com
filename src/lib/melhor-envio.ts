import type { OpcaoFrete } from "@avilaops/checkout";

/**
 * Cotação de frete pelo Melhor Envio.
 *
 * A conta é do lojista: ele conecta por OAuth na seção Entrega do painel
 * (`melhor-envio-conta.ts`) e é o token dele que cota. Este arquivo só conhece
 * o contrato da API e não toca no banco, para a leitura da resposta poder ser
 * testada sem rede nem Postgres.
 *
 * Três detalhes do contrato que custam:
 *   - `User-Agent` com nome da aplicação e e-mail de contato é obrigatório; sem
 *     ele a API recusa a chamada, por mais que o token esteja certo;
 *   - a resposta é uma **lista** de serviços, e o que não atende o trecho vem na
 *     mesma lista com um campo `error` em vez de sumir;
 *   - o ambiente de testes é outro domínio (`sandbox.melhorenvio.com.br`), com
 *     outro aplicativo — `MELHOR_ENVIO_URL` troca um pelo outro.
 */
const PRODUCAO = "https://melhorenvio.com.br";

export function baseDoMelhorEnvio(): string {
  return (process.env.MELHOR_ENVIO_URL || PRODUCAO).replace(/\/+$/, "");
}

/** Cabeçalhos que toda chamada autenticada leva. */
export function cabecalhosDoMelhorEnvio(token: string): Record<string, string> {
  return {
    accept: "application/json",
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
    "user-agent": `Lojas Avila Ops (${process.env.MELHOR_ENVIO_CONTATO || "lojas@avilaops.com"})`,
  };
}

function numero(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number.parseFloat(v) : Number.NaN;
  return Number.isFinite(n) ? n : undefined;
}

/**
 * "PAC" e "SEDEX" já dizem de quem são; ".Package" sozinho não diz nada ao
 * comprador, e por isso leva o nome da transportadora na frente.
 */
function nomeDoServico(servico: string, transportadora: string): string {
  if (!transportadora || transportadora.toLowerCase() === "correios") return servico;
  if (servico.toLowerCase().includes(transportadora.toLowerCase())) return servico;
  return `${transportadora} ${servico}`;
}

/**
 * Converte a resposta do Melhor Envio nas opções que o checkout mostra.
 *
 * `custom_price` e `custom_delivery_time` vêm na frente porque já consideram o
 * que a conta configurou (seguro, dias a mais de manuseio); `price` é o valor
 * cru do serviço. Cobrar o cru e pagar o configurado seria a diferença saindo
 * do bolso de quem despacha.
 */
export function extrairCotacoes(dados: unknown): OpcaoFrete[] {
  if (!Array.isArray(dados)) return [];

  const opcoes: OpcaoFrete[] = [];
  for (const bruto of dados) {
    const s = (bruto ?? {}) as Record<string, unknown>;
    if (s.error) continue;

    const id = numero(s.id);
    const preco = numero(s.custom_price) ?? numero(s.price);
    const nome = String(s.name ?? "").trim();
    if (id === undefined || preco === undefined || preco <= 0 || !nome) continue;

    const prazo = numero(s.custom_delivery_time) ?? numero(s.delivery_time);
    const transportadora = String((s.company as { name?: unknown } | null)?.name ?? "").trim();

    opcoes.push({
      id: `melhorenvio:${id}`,
      nome: nomeDoServico(nome, transportadora),
      preco: Math.round(preco * 100),
      // Sem prazo reconhecível, assume uma semana, como a tabela própria faria.
      prazoDiasUteis: prazo !== undefined && prazo > 0 ? Math.round(prazo) : 7,
    });
  }
  return opcoes.sort((a, b) => a.preco - b.preco);
}

export interface PedidoDeCotacao {
  cepOrigem: string;
  cepDestino: string;
  pesoKg: number;
  caixa: { altura: number; largura: number; comprimento: number };
  /** Valor da mercadoria em reais: é o que a transportadora indeniza. */
  valorDeclarado: number;
}

/**
 * Cota o trecho com o token da loja. Devolve `null` quando não dá para cotar
 * — API fora do ar ou nenhum serviço atendendo —, e quem chama cai na tabela
 * da loja.
 *
 * A falha vai para o log com o motivo. A cotação da CepCerto falhava calada: a
 * conta ficou sem plano ativo e o checkout passou a oferecer só retirada, sem
 * um erro em lugar nenhum para alguém ver.
 */
export async function cotarMelhorEnvio(token: string, p: PedidoDeCotacao): Promise<OpcaoFrete[] | null> {
  if (!token) return null;

  // Opcional: restringe aos serviços que a plataforma sabe despachar
  // ("1,2,3,4"). Vazio deixa o Melhor Envio devolver todos os que atendem.
  const servicos = (process.env.MELHOR_ENVIO_SERVICOS ?? "").replace(/[^\d,]/g, "");

  try {
    const r = await fetch(`${baseDoMelhorEnvio()}/api/v2/me/shipment/calculate`, {
      method: "POST",
      headers: cabecalhosDoMelhorEnvio(token),
      body: JSON.stringify({
        from: { postal_code: p.cepOrigem },
        to: { postal_code: p.cepDestino },
        package: {
          height: p.caixa.altura,
          width: p.caixa.largura,
          length: p.caixa.comprimento,
          weight: p.pesoKg,
        },
        options: { insurance_value: Number(p.valorDeclarado.toFixed(2)), receipt: false, own_hand: false },
        ...(servicos ? { services: servicos } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!r.ok) {
      const corpo = await r.text().catch(() => "");
      console.error(`[frete] Melhor Envio respondeu ${r.status}:`, corpo.slice(0, 300));
      return null;
    }

    const dados: unknown = await r.json();
    const cotacoes = extrairCotacoes(dados);
    if (!cotacoes.length) {
      const motivos = Array.isArray(dados)
        ? dados.map((s) => `${(s as { name?: string })?.name ?? "?"}: ${(s as { error?: string })?.error ?? "sem preço"}`).join("; ")
        : "resposta fora do formato esperado";
      console.error(`[frete] Melhor Envio sem serviço para ${p.cepOrigem} → ${p.cepDestino}:`, motivos.slice(0, 500));
      return null;
    }
    return cotacoes;
  } catch (erro) {
    console.error("[frete] Melhor Envio indisponível:", erro instanceof Error ? erro.message : erro);
    return null;
  }
}
