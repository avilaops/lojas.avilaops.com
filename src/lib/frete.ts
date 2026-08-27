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
 * Cotação autenticada da CepCerto, com a chave de postagem no corpo.
 *
 * Existem três portas na CepCerto e só esta serve: o endpoint do widget
 * (`widget_frete/api/cotacao`) usa chave pública liberada por domínio e nos
 * devolvia 401; o público (`ws/json-frete`) aceita a chave no caminho mas só
 * traz Correios — Mini Envios, PAC e SEDEX. Este devolve **as seis
 * transportadoras**, incluindo Jadlog e Loggi, que costumam ser mais baratas
 * que o PAC. Cotar sem elas é entregar frete mais caro ao comprador.
 */
const ENDPOINT = "https://cepcerto.com/api-cotacao-frete/";

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

/** "até 5 dias" → 5. Sem número reconhecível, assume uma semana. */
function diasDoPrazo(v: unknown): number {
  const n = numero(String(v ?? "").replace(/[^\d]/g, " "));
  return n && n > 0 ? Math.round(n) : 7;
}

/**
 * Converte a resposta da CepCerto nas opções que o checkout mostra.
 *
 * Cada transportadora vem como um par `valor_x` / `prazo_x` no mesmo objeto —
 * não é uma lista. O `_balcao` que acompanha PAC e SEDEX é o preço de balcão
 * dos Correios; mostramos o do contrato, que é o que a loja paga de fato.
 *
 * **Mini Envios fica de fora de propósito.** A CepCerto cota (R$ 17,15 onde o
 * PAC pede 22,37) mas não posta: a emissão só aceita sedex, pac, jadlog e
 * loggi. Oferecer no checkout significaria cobrar 17,15 do comprador e emitir
 * uma etiqueta PAC de 22,37 — prejuízo em toda venda que escolhesse a opção
 * mais barata, que é justamente a que mais gente escolhe.
 */
function extrair(dados: Record<string, unknown>): OpcaoFrete[] {
  const frete = (dados.frete ?? dados) as Record<string, unknown>;
  const servicos: Array<[string, string, string, string]> = [
    ["jadlog-dotcom", "Jadlog .com", "valor_jadlog_dotcom", "prazo_jadlog_dotcom"],
    ["jadlog-package", "Jadlog Package", "valor_jadlog_package", "prazo_jadlog_package"],
    ["loggi", "Loggi", "valor_loggi", "prazo_loggi"],
    ["pac", "PAC", "valor_pac", "prazo_pac"],
    ["sedex", "SEDEX", "valor_sedex", "prazo_sedex"],
  ];

  const opcoes: OpcaoFrete[] = [];
  for (const [id, nome, campoValor, campoPrazo] of servicos) {
    const valor = numero(frete[campoValor]);
    if (valor === undefined || valor <= 0) continue;
    opcoes.push({
      id: `cepcerto:${id}`,
      nome,
      preco: Math.round(valor * 100),
      prazoDiasUteis: diasDoPrazo(frete[campoPrazo]),
    });
  }
  return opcoes.sort((a, b) => a.preco - b.preco);
}

export function caixaDoCarrinho(t: Tenant, itens: ItemCarrinho[]): Caixa {
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

export function pesoTotalKg(t: Tenant, itens: ItemCarrinho[]): number {
  const total = itens.reduce((s, i) => s + ((i.pesoGramas ?? t.pesoPadraoKg * 1000) / 1000) * i.quantidade, 0);
  return Math.max(total, 0.3);
}

async function cotarCepCerto(t: Tenant, cep: string, itens: ItemCarrinho[]): Promise<OpcaoFrete[] | null> {
  const chave = process.env.CEPCERTO_POSTAGEM_KEY ?? process.env.CEP_CERTO_POSTAGEM_API_KEY;
  const origem = (t.cepOrigem ?? "").replace(/\D/g, "");
  if (!chave || origem.length !== 8) return null;

  const caixa = caixaDoCarrinho(t, itens);

  try {
    // O seguro da CepCerto tem piso de R$ 50: pedido mais barato que isso é
    // cotado com o piso, senão a requisição inteira é recusada.
    const valorSeguro = Math.max(itens.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0) / 100, 50);
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        token_cliente_postagem: chave,
        cep_remetente: origem,
        cep_destinatario: cep,
        peso: String(pesoTotalKg(t, itens)),
        altura: String(caixa.altura),
        largura: String(caixa.largura),
        comprimento: String(caixa.comprimento),
        valor_encomenda: valorSeguro.toFixed(2),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const dados = (await r.json()) as Record<string, unknown>;
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
