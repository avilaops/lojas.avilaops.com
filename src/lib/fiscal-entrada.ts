import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { ErroApi } from "./api-resposta";
import { fiscalErpConfigurado } from "./erp-fiscal";
import { eventoCancelaNota, interpretarNotaEntrada, normalizarDocumentoEntrada, type NotaEntrada } from "./fiscal-entrada-xml";
import { movimentarEstoqueMultilocalNaTransacao, type ReciboMovimento } from "./estoque-multilocal";

type Tx = Prisma.TransactionClient;
export type ReciboEntradaFiscal = { tipo: "ENTRADA_NFE"; id: string; chave: string; numero: string; documentoId: string; confirmadoEm: string; ator: string; local: string; itens: Array<{ numero: number; varianteId: string; quantidade: number; descricaoFiscal: string; unidadeFiscal: string; quantidadeFiscal: string; movimento: ReciboMovimento }> };
export type ConferenciaEntradaFiscal = { documentoId: string; modo: "LOCAL" | "ERP"; erpUrl: string | null; nota: NotaEntrada | null; recibo: ReciboEntradaFiscal | null; impedimento: string | null };
const ORIGEM = "fiscal:entrada-nfe";
const comandoSchema = z.object({
  confirmacao: z.literal(true), local: z.string().trim().min(1).max(80).regex(/^[a-z0-9][a-z0-9_-]*$/),
  itens: z.array(z.object({ numero: z.number().int().min(1).max(990), varianteId: z.string().min(1).max(100), quantidade: z.number().int().min(1).max(10_000_000) }).strict()).min(1).max(990),
}).strict().refine(c => new Set(c.itens.map(i => i.numero)).size === c.itens.length, "Item fiscal repetido.");
const chaveDoComando = (chave: string) => `nfe-entrada:${chave}`;

async function documentoDaLoja(tx: Tx, tenantId: string, id: string) {
  const registro = await tx.documentoFiscalLoja.findFirst({ where: { id, tenantId } });
  if (!registro) throw new ErroApi("nao_encontrado", "Documento não encontrado nesta loja.");
  if (/^resNFe/.test(registro.schema) && registro.chave) {
    const completo = await tx.documentoFiscalLoja.findFirst({ where: { tenantId, chave: registro.chave, schema: { startsWith: "procNFe" } }, orderBy: { recebidoEm: "desc" } });
    if (completo) return completo;
  }
  return registro;
}

function reciboSalvo(comando: { origem: string; resultado: Prisma.JsonValue } | null): ReciboEntradaFiscal | null {
  if (!comando) return null;
  const resultado = comando.resultado as unknown as ReciboEntradaFiscal;
  if (comando.origem !== ORIGEM || resultado?.tipo !== "ENTRADA_NFE") throw new ErroApi("conflito", "A identificação desta NF-e está ocupada por outro comando de estoque.");
  return resultado;
}

async function contexto(tx: Tx, tenantId: string, id: string): Promise<ConferenciaEntradaFiscal> {
  const documento = await documentoDaLoja(tx, tenantId, id);
  const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { cnpj: true, status: true } });
  const cnpj = normalizarDocumentoEntrada(tenant.cnpj ?? "");
  const modo = fiscalErpConfigurado(cnpj) ? "ERP" as const : "LOCAL" as const;
  const painel = (process.env.ERP_APP_URL || process.env.ERP_API_URL || "").replace(/\/$/, "");
  const erpUrl = modo === "ERP" && /^https:\/\//.test(painel) ? `${painel}/fiscal?ver=recebidas` : null;
  const recibo = documento.chave ? reciboSalvo(await tx.comandoEstoque.findUnique({ where: { tenantId_chave: { tenantId, chave: chaveDoComando(documento.chave) } } })) : null;
  if (!/^procNFe/.test(documento.schema)) return { documentoId: documento.id, modo, erpUrl, nota: null, recibo, impedimento: "Esta nota contém apenas resumo. Aguarde o XML completo para conferir seus produtos." };
  const nota = interpretarNotaEntrada(documento.xml);
  if (documento.chave !== nota.chave) throw new ErroApi("conflito", "A chave do XML diverge da identificação armazenada.");
  const eventos = await tx.documentoFiscalLoja.findMany({ where: { tenantId, chave: nota.chave, OR: [{ cancelada: true }, { schema: { contains: "Evento", mode: "insensitive" } }] }, select: { xml: true, cancelada: true } });
  let impedimento: string | null = null;
  if (tenant.status !== "ATIVA") impedimento = "A loja precisa estar ativa para registrar entradas.";
  else if (modo === "ERP") impedimento = "Este CNPJ controla a entrada pelo ERP. Faça a conferência no ERP para evitar duplicidade.";
  else if (!cnpj || nota.destinatario.documento !== cnpj) impedimento = "O destinatário desta NF-e não corresponde ao CNPJ da loja.";
  else if (nota.ambiente !== "1") impedimento = "NF-e de homologação não pode movimentar o estoque real.";
  else if (documento.cancelada || eventos.some(e => e.cancelada || eventoCancelaNota(e.xml, nota.chave))) impedimento = "Esta NF-e foi cancelada. Revise o recebimento e o estoque antes de continuar.";
  return { documentoId: documento.id, modo, erpUrl, nota, recibo, impedimento };
}

/** Somente leitura: abrir documento nunca cria produto, reserva ou entrada. */
export async function prepararEntradaFiscal(tenantId: string, id: string) {
  return contexto(prisma, tenantId, id);
}

export async function confirmarEntradaFiscal(tenantId: string, id: string, entrada: unknown, ator: string): Promise<ReciboEntradaFiscal> {
  const lido = comandoSchema.safeParse(entrada);
  if (!lido.success) throw new ErroApi("parametro_invalido", "Confirme os produtos, unidades inteiras e local de estoque de todos os itens.");
  const comando = { local: lido.data.local, itens: [...lido.data.itens].sort((a, b) => a.numero - b.numero) };
  const resumoHash = createHash("sha256").update(JSON.stringify(comando)).digest("hex");
  return prisma.$transaction(async tx => {
    const documento = await documentoDaLoja(tx, tenantId, id);
    if (!documento.chave || !/^\d{44}$/.test(documento.chave)) throw new ErroApi("conflito", "A nota ainda não tem XML completo para entrada.");
    const chave = chaveDoComando(documento.chave);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify([tenantId, chave])}, 0))`;
    const anterior = await tx.comandoEstoque.findUnique({ where: { tenantId_chave: { tenantId, chave } } });
    if (anterior) {
      const recibo = reciboSalvo(anterior)!;
      if (anterior.resumoHash !== resumoHash) throw new ErroApi("conflito", "Esta NF-e já tem entrada registrada com produtos, quantidades ou local diferentes.");
      return recibo;
    }
    const estado = await contexto(tx, tenantId, documento.id);
    if (estado.impedimento || !estado.nota) throw new ErroApi("conflito", estado.impedimento ?? "XML completo necessário para entrada.");
    const nota = estado.nota;
    if (comando.itens.length !== nota.itens.length || comando.itens.some(i => !nota.itens.some(n => n.numero === i.numero))) throw new ErroApi("parametro_invalido", "Confira todos os itens da nota; não há recebimento parcial nesta confirmação.");
    const ids = [...new Set(comando.itens.map(i => i.varianteId))];
    const variantes = await tx.variante.findMany({ where: { tenantId, id: { in: ids }, ativo: true, produto: { ativo: true } }, select: { id: true, produtoId: true } });
    if (variantes.length !== ids.length) throw new ErroApi("nao_encontrado", "Produto ou variante não encontrado entre os cadastros ativos desta loja.");
    const produtos = new Map(variantes.map(v => [v.id, v.produtoId]));
    const ordenados = [...comando.itens].sort((a, b) => produtos.get(a.varianteId)!.localeCompare(produtos.get(b.varianteId)!) || a.varianteId.localeCompare(b.varianteId) || a.numero - b.numero);
    const itens: ReciboEntradaFiscal["itens"] = [];
    for (const item of ordenados) {
      const chaveItem = `nfe-item:${nota.chave}:${item.numero}`;
      const ocupado = await tx.comandoEstoque.findUnique({ where: { tenantId_chave: { tenantId, chave: chaveItem } } });
      if (ocupado) throw new ErroApi("conflito", "Um item desta NF-e já possui comando de estoque; confira o histórico antes de continuar.");
      const movimento = await movimentarEstoqueMultilocalNaTransacao(tx, tenantId, chaveItem, { tipo: "entrada", varianteId: item.varianteId, local: comando.local, quantidade: item.quantidade, motivo: `Entrada NF-e ${nota.numero} item${item.numero} · ${nota.chave}` }, ORIGEM);
      const fiscal = nota.itens.find(i => i.numero === item.numero)!;
      itens.push({ ...item, descricaoFiscal: fiscal.descricao, unidadeFiscal: fiscal.unidade, quantidadeFiscal: fiscal.quantidade, movimento });
    }
    itens.sort((a, b) => a.numero - b.numero);
    const recibo: ReciboEntradaFiscal = { tipo: "ENTRADA_NFE", id: randomUUID(), chave: nota.chave, numero: nota.numero, documentoId: documento.id, confirmadoEm: new Date().toISOString(), ator: ator.slice(0, 120), local: comando.local, itens };
    await tx.comandoEstoque.create({ data: { id: recibo.id, tenantId, chave, resumoHash, origem: ORIGEM, resultado: recibo as unknown as Prisma.InputJsonValue } });
    return recibo;
  }, { timeout: 30_000 });
}
