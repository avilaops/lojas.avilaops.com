import type { Tenant } from "@prisma/client";
import { FRETE_RETIRADA_ID, type ItemCarrinho, type OpcaoFrete } from "@avilaops/checkout";

/**
 * Cotação de frete da plataforma. Herdado de Websites/brilhax.com/src/lib/frete.ts
 * com duas mudanças:
 *
 *   1. Roda no SERVIDOR, com a chave de API (CEPCERTO_CONSULTA_KEY). Na Brilhax
 *      a chave pública ia no HTML e era liberada por domínio no painel deles;
 *      com N lojas isso seria N liberações. Aqui uma conta cota para todas.
 *   2. Origem, caixa e peso padrão são colunas do tenant, não constantes.
 *
 * Ordem de decisão:
 *   - CepCerto configurada e respondeu → cotação real (mais retirada, se houver)
 *   - senão → tabela por UF do tenant (mais retirada)
 *   - senão → só retirada, ou nada (o checkout mostra "frete a combinar")
 */

/**
 * API de servidor da CepCerto: a chave vai no caminho, não em cabeçalho.
 *
 * A plataforma chamava `widget_frete/api/cotacao` — o endpoint do widget, que
 * usa chave pública liberada por domínio — mandando a chave de API. Resultado:
 * 401 "domínio ou IP não autorizado" e toda loja caindo na tabela por UF sem
 * ninguém perceber. São credenciais diferentes para portas diferentes.
 */
const ENDPOINT = "https://cepcerto.com/ws/json-frete";
const BASE = process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com";

interface Caixa { altura: number; largura: number; comprimento: number }
interface FaixaTabela { ufs: string[]; preco: number; prazoDiasUteis: number; nome?: string }

function numero(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v.replace(/[^\d,.-]/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/**
 * Converte a resposta da CepCerto nas opções que o checkout mostra.
 *
 * Os campos `*_desconto_cepcerto` são o preço do contrato deles com os
 * Correios — mais barato que o balcão. É o que o comprador vê, e é o motivo de
 * a loja despachar pela CepCerto: cotar o contrato e postar no balcão faria o
 * lojista pagar a diferença do próprio bolso.
 */
function extrair(dados: Record<string, unknown>): OpcaoFrete[] {
  const preco = (v: unknown) => {
    const n = numero(v);
    return n === undefined ? undefined : Math.round(n * 100);
  };
  const prazo = (v: unknown) => Math.round(numero(v) ?? 7);

  const opcoes: OpcaoFrete[] = [];
  const servicos: Array<[string, string, unknown, unknown, unknown]> = [
    ["mini", "Mini Envios", dados.valorminienvios_cepcerto, undefined, dados.prazominienvios_cepcerto],
    ["pac", "PAC", dados.valorpac_desconto_cepcerto, dados.valorpac, dados.prazopac],
    ["sedex", "SEDEX", dados.valorsedex_desconto_cepcerto, dados.valorsedex, dados.prazosedex],
  ];

  for (const [id, nome, comDesconto, cheio, dias] of servicos) {
    const valor = preco(comDesconto) ?? preco(cheio);
    if (valor === undefined || valor <= 0) continue;
    opcoes.push({ id: `cepcerto:${id}`, nome, preco: valor, prazoDiasUteis: prazo(dias) });
  }
  return opcoes.sort((a, b) => a.preco - b.preco);
}

function caixaDoCarrinho(t: Tenant, itens: ItemCarrinho[]): Caixa {
  const padrao = (t.caixaPadrao as Caixa | null) ?? { altura: 15, largura: 20, comprimento: 25 };
  let altura = 0;
  let largura = 0;
  let comprimento = 0;

  for (const i of itens) {
    const a = i.alturaCm ?? padrao.altura;
    const l = i.larguraCm ?? padrao.largura;
    const c = i.comprimentoCm ?? padrao.comprimento;
    altura += a * i.quantidade;
    largura = Math.max(largura, l);
    comprimento = Math.max(comprimento, c);
  }

  // Mínimos dos Correios para encomenda em caixa: abaixo disso a cotação é
  // recusada e o comprador ficaria sem opção nenhuma de frete.
  return {
    altura: Math.max(altura, 2),
    largura: Math.max(largura, 11),
    comprimento: Math.max(comprimento, 16),
  };
}

function pesoTotalKg(t: Tenant, itens: ItemCarrinho[]): number {
  const total = itens.reduce((s, i) => s + ((i.pesoGramas ?? t.pesoPadraoKg * 1000) / 1000) * i.quantidade, 0);
  return Math.max(total, 0.3);
}

async function cotarCepCerto(t: Tenant, cep: string, itens: ItemCarrinho[]): Promise<OpcaoFrete[] | null> {
  const chave = process.env.CEPCERTO_CONSULTA_KEY ?? process.env.CEP_CERTO_CONSULTA_API_KEY;
  const origem = (t.cepOrigem ?? "").replace(/\D/g, "");
  if (!chave || origem.length !== 8) return null;

  const caixa = caixaDoCarrinho(t, itens);

  try {
    // Tudo no caminho: /cep-origem/cep-destino/peso-kg/altura/largura/comprimento/chave
    const url = [ENDPOINT, origem, cep, pesoTotalKg(t, itens), caixa.altura, caixa.largura, caixa.comprimento, chave].join("/");
    const r = await fetch(url, { headers: { "user-agent": BASE }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const dados = (await r.json()) as Record<string, unknown>;
    if (dados?.status === "erro" || dados?.erro) return null;
    const cotacoes = extrair(dados);
    return cotacoes.length ? cotacoes : null;
  } catch {
    return null;
  }
}

async function ufDoCep(cep: string): Promise<string | null> {
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: AbortSignal.timeout(5000) });
    const d = await r.json();
    return d?.erro ? null : String(d.uf ?? "") || null;
  } catch {
    return null;
  }
}

async function cotarTabela(t: Tenant, cep: string): Promise<OpcaoFrete[]> {
  const tabela = (t.tabelaFrete as FaixaTabela[] | null) ?? [];
  if (!tabela.length) return [];
  const uf = await ufDoCep(cep);
  if (!uf) return [];
  // Faixa específica da UF vence a curinga "*": a curinga é o "resto do Brasil".
  const especificas = tabela.filter((f) => f.ufs.includes(uf));
  const aplicaveis = especificas.length ? especificas : tabela.filter((f) => f.ufs.includes("*"));
  return aplicaveis
    .map((f, i) => ({
      id: `tabela:${i}`,
      nome: f.nome ?? "Entrega",
      preco: f.preco,
      prazoDiasUteis: f.prazoDiasUteis,
    }));
}

function retirada(t: Tenant): OpcaoFrete[] {
  if (!t.retiradaNaLoja) return [];
  return [{ id: FRETE_RETIRADA_ID, nome: "Retirar na loja", preco: 0, prazoDiasUteis: t.despachoDiasUteis }];
}

export async function cotarFrete(t: Tenant, cepBruto: string | null, itens: ItemCarrinho[], opcoesExtra: { freteGratisCupom?: boolean } = {}): Promise<OpcaoFrete[]> {
  const cep = (cepBruto ?? "").replace(/\D/g, "");
  if (cep.length !== 8) return retirada(t);

  let opcoes = (await cotarCepCerto(t, cep, itens)) ?? (await cotarTabela(t, cep));

  if (t.freteGratisAcima != null || opcoesExtra.freteGratisCupom) {
    const subtotal = itens.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0);
    if ((opcoesExtra.freteGratisCupom || (t.freteGratisAcima != null && subtotal >= t.freteGratisAcima)) && opcoes.length) {
      const maisBarata = opcoes[0];
      opcoes = [{ ...maisBarata, id: `gratis:${maisBarata.id}`, nome: `${maisBarata.nome} · grátis`, preco: 0 }, ...opcoes.slice(1)];
    }
  }

  return [...retirada(t), ...opcoes];
}

/** Endereço pelo CEP (ViaCEP, público e sem chave). */
export async function buscarEndereco(cepBruto: string) {
  const cep = cepBruto.replace(/\D/g, "");
  if (cep.length !== 8) return null;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: AbortSignal.timeout(5000) });
    const d = await r.json();
    if (d?.erro) return null;
    return { logradouro: String(d.logradouro ?? ""), bairro: String(d.bairro ?? ""), cidade: String(d.localidade ?? ""), uf: String(d.uf ?? "") };
  } catch {
    return null;
  }
}
