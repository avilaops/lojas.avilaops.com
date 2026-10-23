import { prisma } from "./db";
import { STATUS_VENDA_ANALYTICS, type PeriodoAnalytics } from "./analytics-vendas";

export const EVENTOS_FUNIL = [
  "search",
  "search_no_results",
  "filter_apply",
  "view_item",
  "technical_contact",
  "add_to_cart",
  "view_cart",
  "begin_checkout",
] as const;

export type EventoFunil = (typeof EVENTOS_FUNIL)[number];

export function camposDaSessaoParaEvento(evento: EventoFunil) {
  switch (evento) {
    case "search": return { buscou: true };
    case "search_no_results": return { buscou: true, buscaSemResultado: true };
    case "filter_apply": return { filtrou: true };
    case "view_item": return { viuProduto: true };
    case "technical_contact": return { contatoTecnico: true };
    case "add_to_cart": return { adicionouCarrinho: true };
    case "view_cart": return { abriuCarrinho: true };
    case "begin_checkout": return { iniciouCheckout: true };
  }
}

export function taxa(numerador: number, denominador: number): number | null {
  return denominador > 0 ? Math.round((numerador / denominador) * 1000) / 10 : null;
}

type SessaoDoFunil = {
  id: string;
  buscou: boolean;
  buscaSemResultado: boolean;
  filtrou: boolean;
  viuProduto: boolean;
  contatoTecnico: boolean;
  adicionouCarrinho: boolean;
  abriuCarrinho: boolean;
  iniciouCheckout: boolean;
  pedidos: Array<{ clienteEmail: string; status: string }>;
};

export function calcularFunil(sessoes: SessaoDoFunil[], clientesRecorrentes: Set<string>, clientesCompradores: Set<string>) {
  const contar = (campo: keyof Omit<SessaoDoFunil, "id" | "pedidos">) => sessoes.filter((sessao) => sessao[campo]).length;
  const statusPagos = new Set<string>(STATUS_VENDA_ANALYTICS);
  const sessaoPaga = (sessao: SessaoDoFunil) => sessao.pedidos.some((pedido) => statusPagos.has(pedido.status));
  const contagens = {
    sessoes: sessoes.length,
    buscas: contar("buscou"),
    buscasSemResultado: contar("buscaSemResultado"),
    filtros: contar("filtrou"),
    produtos: contar("viuProduto"),
    contatosTecnicos: contar("contatoTecnico"),
    carrinhosAdicionados: contar("adicionouCarrinho"),
    carrinhosAbertos: contar("abriuCarrinho"),
    checkouts: contar("iniciouCheckout"),
    pedidosCriados: sessoes.filter((sessao) => sessao.pedidos.length > 0).length,
    pagamentosAprovados: sessoes.filter(sessaoPaga).length,
    compras: sessoes.filter(sessaoPaga).length,
    clientesCompradores: clientesCompradores.size,
    clientesRecorrentes: clientesRecorrentes.size,
  };
  return {
    contagens,
    taxas: {
      buscaSemResultado: taxa(contagens.buscasSemResultado, contagens.buscas),
      produto: taxa(contagens.produtos, contagens.sessoes),
      carrinho: taxa(contagens.carrinhosAdicionados, contagens.produtos),
      checkout: taxa(contagens.checkouts, contagens.carrinhosAdicionados),
      compra: taxa(contagens.compras, contagens.sessoes),
      pagamento: taxa(contagens.pagamentosAprovados, contagens.pedidosCriados),
      contatoTecnico: taxa(contagens.contatosTecnicos, contagens.produtos),
      recompra: taxa(contagens.clientesRecorrentes, contagens.clientesCompradores),
    },
  };
}

const normalizarEmail = (email: string) => email.trim().toLowerCase();

export function recorrenciaNoPeriodo(pedidos: Array<{ clienteEmail: string; criadoEm: Date }>, inicio: Date) {
  const porCliente = new Map<string, { anteriores: number; atuais: number }>();
  for (const pedido of pedidos) {
    const email = normalizarEmail(pedido.clienteEmail);
    const contagem = porCliente.get(email) ?? { anteriores: 0, atuais: 0 };
    if (pedido.criadoEm < inicio) contagem.anteriores++;
    else contagem.atuais++;
    porCliente.set(email, contagem);
  }
  const compradores = new Set([...porCliente].filter(([, valor]) => valor.atuais > 0).map(([email]) => email));
  const recorrentes = new Set([...porCliente].filter(([, valor]) => valor.atuais > 0 && (valor.anteriores > 0 || valor.atuais > 1)).map(([email]) => email));
  return { compradores, recorrentes };
}

export async function relatorioDoFunil(tenantId: string, periodo: PeriodoAnalytics) {
  const [sessoes, pedidosAteOFim] = await Promise.all([
    prisma.sessaoVitrine.findMany({
      where: { tenantId, criadoEm: { gte: periodo.de, lte: periodo.ate } },
      select: {
        id: true,
        buscou: true,
        buscaSemResultado: true,
        filtrou: true,
        viuProduto: true,
        contatoTecnico: true,
        adicionouCarrinho: true,
        abriuCarrinho: true,
        iniciouCheckout: true,
        pedidos: { where: { criadoEm: { gte: periodo.de, lte: periodo.ate } }, select: { clienteEmail: true, status: true } },
      },
    }),
    prisma.pedido.findMany({
      where: { tenantId, status: { in: [...STATUS_VENDA_ANALYTICS] }, criadoEm: { lte: periodo.ate } },
      select: { clienteEmail: true, criadoEm: true },
      orderBy: { criadoEm: "asc" },
    }),
  ]);

  const { compradores, recorrentes } = recorrenciaNoPeriodo(pedidosAteOFim, periodo.de);
  return calcularFunil(sessoes, recorrentes, compradores);
}

