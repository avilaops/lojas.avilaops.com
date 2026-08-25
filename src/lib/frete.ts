import type { Tenant } from "@prisma/client";
import { FRETE_RETIRADA_ID, type ItemCarrinho, type OpcaoFrete } from "@avilaops/checkout";

/**
 * Cotação de frete da plataforma. Herdado de Websites/brilhax.com/src/lib/frete.ts
 * com duas mudanças:
 *
 *   1. Roda no SERVIDOR. Na Brilhax a chave pública da CepCerto ia no HTML e
 *      era liberada por domínio no painel deles; com N lojas isso seria N
 *      liberações. Aqui uma conta da plataforma cota para todas.
 *   2. Origem, caixa e peso padrão são colunas do tenant, não constantes.
 *
 * Ordem de decisão:
 *   - CepCerto configurada e respondeu → cotação real (mais retirada, se houver)
 *   - senão → tabela por UF do tenant (mais retirada)
 *   - senão → só retirada, ou nada (o checkout mostra "frete a combinar")
 */

const ENDPOINT = "https://cepcerto.com/widget_frete/api/cotacao";
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

/** A resposta da CepCerto muda de nome conforme o plano; lemos todas as formas. */
function extrair(dados: unknown): OpcaoFrete[] {
  const raiz = dados as Record<string, unknown> | undefined;
  const lista =
    (Array.isArray(raiz?.cotacoes) && raiz.cotacoes) ||
    (Array.isArray(raiz?.resultado) && raiz.resultado) ||
    (Array.isArray(raiz?.fretes) && raiz.fretes) ||
    (Array.isArray(dados) && dados) ||
    [];
  const out: OpcaoFrete[] = [];
  for (const item of lista as Array<Record<string, unknown>>) {
    const valor = numero(item.valor ?? item.preco ?? item.price);
    if (valor === undefined) continue;
    const nome = String(item.servico ?? item.nome ?? item.service ?? "Envio");
    out.push({
      id: `cepcerto:${nome.toLowerCase().replace(/\W+/g, "-")}`,
      nome: item.transportadora ? `${item.transportadora} · ${nome}` : nome,
      preco: Math.round(valor * 100),
      prazoDiasUteis: Math.round(numero(item.prazo ?? item.prazo_dias ?? item.dias) ?? 7),
    });
  }
  return out.sort((a, b) => a.preco - b.preco);
}

function pesoTotalKg(t: Tenant, itens: ItemCarrinho[]): number {
  const total = itens.reduce((s, i) => s + ((i.pesoGramas ?? t.pesoPadraoKg * 1000) / 1000) * i.quantidade, 0);
  return Math.max(total, 0.3);
}

async function cotarCepCerto(t: Tenant, cep: string, itens: ItemCarrinho[]): Promise<OpcaoFrete[] | null> {
  const chave = process.env.CEPCERTO_PUBLIC_KEY;
  const origem = (t.cepOrigem ?? "").replace(/\D/g, "");
  if (!chave || origem.length !== 8) return null;

  const caixa = (t.caixaPadrao as Caixa | null) ?? { altura: 15, largura: 20, comprimento: 25 };
  const valorEncomenda = itens.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0) / 100;

  try {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-CepCerto-Public-Key": chave,
        // A chave é liberada por domínio; a cotação sai em nome da plataforma.
        origin: `https://${BASE}`,
        referer: `https://${BASE}/`,
      },
      body: JSON.stringify({
        public_key: chave,
        cep_remetente: origem,
        cep_destinatario: cep,
        peso: String(pesoTotalKg(t, itens)),
        altura: String(caixa.altura),
        largura: String(caixa.largura),
        comprimento: String(caixa.comprimento),
        valor_encomenda: valorEncomenda.toFixed(2),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const dados = await r.json();
    if (dados?.status === "erro") return null;
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
