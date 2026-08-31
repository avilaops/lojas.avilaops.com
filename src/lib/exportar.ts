import { prisma } from "./db";
import { clientesDaLoja } from "./clientes";

/**
 * Exportação em CSV.
 *
 * Serve a dois donos ao mesmo tempo: o lojista que quer os pedidos no Excel e
 * a obrigação de LGPD de entregar os dados dos clientes finais quando pedidos
 * por escrito — a única exceção ao padrão fechado da plataforma
 * (ver docs/CONFORMIDADE.md).
 *
 * Separador é ponto e vírgula e o arquivo leva BOM: é o que faz o Excel em
 * português abrir o arquivo já com as colunas separadas, sem assistente de
 * importação. Vírgula decimal pelo mesmo motivo.
 */
const BOM = "\uFEFF";

function celula(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  const texto = String(valor);
  // Aspas duplicadas e o campo inteiro entre aspas quando há separador, aspas
  // ou quebra de linha — é o que a planilha espera.
  return /[;"\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function montarCsv(linhas: unknown[][]): string {
  return BOM + linhas.map((l) => l.map(celula).join(";")).join("\r\n") + "\r\n";
}

const reais = (centavos: number) => (centavos / 100).toFixed(2).replace(".", ",");
const data = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

export async function pedidosEmCsv(tenantId: string): Promise<string> {
  const pedidos = await prisma.pedido.findMany({
    where: { tenantId },
    include: { itens: true },
    orderBy: { criadoEm: "desc" },
    take: 5000,
  });

  const linhas: unknown[][] = [[
    "Numero", "Referencia", "Data", "Status", "Cliente", "E-mail", "Telefone", "Documento",
    "Subtotal", "Desconto", "Cupom", "Frete", "Total", "Pagamento", "Entrega", "Rastreio", "Itens",
  ]];

  for (const p of pedidos) {
    const e = p.entrega as { logradouro?: string; numero?: string; bairro?: string; cidade?: string; uf?: string; cep?: string } | null;
    linhas.push([
      p.numero, p.referencia, data(p.criadoEm), p.status, p.clienteNome, p.clienteEmail, p.clienteTelefone, p.clienteDocumento,
      reais(p.subtotalCentavos), reais(p.descontoCentavos), p.cupomCodigo ?? "", reais(p.freteCentavos), reais(p.totalCentavos),
      p.meioPagamento,
      e ? `${e.logradouro ?? ""}, ${e.numero ?? ""} - ${e.bairro ?? ""}, ${e.cidade ?? ""}/${e.uf ?? ""} ${e.cep ?? ""}` : "Retirada na loja",
      p.rastreio ?? "",
      p.itens.map((i) => `${i.quantidade}x ${i.nome}${i.varianteNome ? ` (${i.varianteNome})` : ""}`).join(" | "),
    ]);
  }
  return montarCsv(linhas);
}

export async function clientesEmCsv(tenantId: string): Promise<string> {
  // A apuração é a mesma que alimenta a tela de Clientes (src/lib/clientes.ts):
  // arquivo e painel não podem discordar sobre quanto alguém gastou.
  const clientes = await clientesDaLoja(tenantId);
  const linhas: unknown[][] = [["Nome", "E-mail", "Telefone", "Documento", "Tem conta", "Pedidos", "Total gasto", "Primeira compra", "Ultima compra", "Endereco"]];
  for (const c of clientes) {
    linhas.push([c.nome, c.email, c.telefone, c.documento, c.temConta ? "sim" : "nao", c.pedidos, reais(c.gastoCentavos), data(c.primeiraCompra), data(c.ultimaCompra), c.endereco]);
  }
  return montarCsv(linhas);
}
