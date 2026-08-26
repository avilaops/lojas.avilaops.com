import { prisma } from "./db";
import { STATUS_VENDA } from "./relatorio";

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
  // Inclui quem comprou sem criar conta: o dado pessoal está no pedido, e a
  // LGPD não distingue quem se cadastrou de quem só comprou.
  const [compradores, pedidos] = await Promise.all([
    prisma.comprador.findMany({ where: { tenantId }, include: { enderecos: true }, orderBy: { criadoEm: "asc" } }),
    prisma.pedido.findMany({ where: { tenantId }, select: { clienteEmail: true, clienteNome: true, clienteTelefone: true, clienteDocumento: true, totalCentavos: true, status: true, criadoEm: true } }),
  ]);

  interface Resumo { nome: string; telefone: string; documento: string; pedidos: number; gasto: number; primeiro: Date; ultimo: Date; temConta: boolean; endereco: string }
  const porEmail = new Map<string, Resumo>();

  for (const p of pedidos) {
    const chave = p.clienteEmail.toLowerCase();
    const atual = porEmail.get(chave);
    const conta = STATUS_VENDA.includes(p.status as (typeof STATUS_VENDA)[number]);
    if (atual) {
      atual.pedidos += 1;
      if (conta) atual.gasto += p.totalCentavos;
      if (p.criadoEm < atual.primeiro) atual.primeiro = p.criadoEm;
      if (p.criadoEm > atual.ultimo) atual.ultimo = p.criadoEm;
    } else {
      porEmail.set(chave, { nome: p.clienteNome, telefone: p.clienteTelefone, documento: p.clienteDocumento, pedidos: 1, gasto: conta ? p.totalCentavos : 0, primeiro: p.criadoEm, ultimo: p.criadoEm, temConta: false, endereco: "" });
    }
  }

  for (const c of compradores) {
    const chave = c.email.toLowerCase();
    const e = c.enderecos[0];
    const endereco = e ? `${e.logradouro}, ${e.numero} - ${e.bairro}, ${e.cidade}/${e.uf} ${e.cep}` : "";
    const atual = porEmail.get(chave);
    if (atual) {
      atual.temConta = true;
      atual.endereco = endereco;
      atual.nome = c.nome || atual.nome;
    } else {
      porEmail.set(chave, { nome: c.nome, telefone: c.telefone ?? "", documento: c.documento ?? "", pedidos: 0, gasto: 0, primeiro: c.criadoEm, ultimo: c.criadoEm, temConta: true, endereco });
    }
  }

  const linhas: unknown[][] = [["Nome", "E-mail", "Telefone", "Documento", "Tem conta", "Pedidos", "Total gasto", "Primeira compra", "Ultima compra", "Endereco"]];
  for (const [email, r] of [...porEmail].sort((a, b) => b[1].gasto - a[1].gasto)) {
    linhas.push([r.nome, email, r.telefone, r.documento, r.temConta ? "sim" : "nao", r.pedidos, reais(r.gasto), data(r.primeiro), data(r.ultimo), r.endereco]);
  }
  return montarCsv(linhas);
}
