import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PedidoStatus, Prisma, Tenant } from "@prisma/client";
import type { ResultadoPagamento, StatusPagamento } from "@avilaops/checkout";
import { definicaoPixManual, valorComCentavosUnicos, type ContextoProvedor, type EstadoPixManual, type PaymentProvider } from "@avilaops/checkout/server";
import QRCode from "qrcode";
import { UPLOADS_DIR } from "./uploads-arquivos";
import { prisma } from "./db";
import { GatewayNaoConfigurado } from "./gateway";
import { atualizarStatusPagamento } from "./pedidos";
import { recursoAtivo } from "./recursos";

/** O Pix na conta vale um dia. Quem não paga nesse prazo devolve o estoque. */
export const PIX_MANUAL_EXPIRA_HORAS = 24;

const TETO_COMPROVANTE = 5 * 1024 * 1024;

const FORA = "Este recurso não está ligado para esta loja.";

export function pixManualLigado(t: Pick<Tenant, "recursos">): boolean {
  return recursoAtivo(t, "pagamentos_pix_manual");
}

/** Cidade do BR Code: ASCII, até 15, a da loja quando existe. */
export function cidadeDoBrCode(endereco: unknown): string {
  const bruta = endereco && typeof endereco === "object" && "cidade" in endereco
    ? String((endereco as { cidade?: unknown }).cidade ?? "")
    : "";
  const limpa = bruta
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  return (limpa || "BRASILIA").slice(0, 15).trim() || "BRASILIA";
}

const MAGICOS: Record<string, { ext: string; confere: (b: Buffer) => boolean }> = {
  "image/jpeg": { ext: ".jpg", confere: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": { ext: ".png", confere: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/webp": { ext: ".webp", confere: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP" },
  "application/pdf": { ext: ".pdf", confere: (b) => b.subarray(0, 5).toString("ascii") === "%PDF-" },
};

/** Confere o arquivo pelo conteúdo, não pelo nome que o navegador mandou. */
export function lerComprovante(bytes: Buffer, tipo: string): { ext: string } | { erro: string } {
  if (bytes.length === 0) return { erro: "O comprovante veio vazio." };
  if (bytes.length > TETO_COMPROVANTE) return { erro: "O comprovante pode ter no máximo 5 MB." };
  const regra = MAGICOS[tipo];
  if (!regra || bytes.length < 12 || !regra.confere(bytes)) {
    return { erro: "Envie uma foto (JPG, PNG ou WebP) ou um PDF." };
  }
  return { ext: regra.ext };
}

export async function qrPngBase64(copiaECola: string): Promise<string | undefined> {
  try {
    const buf = await QRCode.toBuffer(copiaECola, { type: "png", errorCorrectionLevel: "M", margin: 2, width: 328 });
    return buf.toString("base64");
  } catch {
    return undefined;
  }
}

function statusDoPix(pedido: { status: PedidoStatus; pagamentoStatus: string | null } | null): StatusPagamento {
  if (!pedido) return "aguardando_confirmacao";
  if (pedido.status === "PAGO" || pedido.status === "EM_SEPARACAO" || pedido.status === "ENVIADO" || pedido.status === "ENTREGUE") {
    return "aprovado";
  }
  if (pedido.status === "ESTORNADO") return "estornado";
  if (pedido.pagamentoStatus === "recusado") return "recusado";
  if (pedido.status === "CANCELADO" || pedido.pagamentoStatus === "cancelado") return "cancelado";
  return "aguardando_confirmacao";
}

async function lerResultado(tenantId: string, onde: { id: string } | { referencia: string }): Promise<ResultadoPagamento | null> {
  const cobranca = await prisma.cobrancaPixManual.findFirst({
    where: { tenantId, ...onde },
    include: { pedido: { select: { status: true, pagamentoStatus: true } } },
  });
  if (!cobranca) return null;
  return {
    id: cobranca.id,
    status: statusDoPix(cobranca.pedido),
    meioPagamento: "pix",
    valor: cobranca.valorCentavos,
    pix: { copiaECola: cobranca.copiaECola, expiraEm: cobranca.expiraEm.toISOString() },
  };
}

function portaPixManual(tenantId: string): EstadoPixManual {
  return {
    async reservar(dados) {
      return prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pix_manual:${tenantId}`}))`;
        const ja = await tx.cobrancaPixManual.findUnique({ where: { referencia: dados.referencia } });
        if (ja) {
          if (ja.tenantId !== tenantId) {
            throw new Error("Não foi possível gerar o Pix. Tente de novo.");
          }
          return { id: ja.id, valorCentavos: ja.valorCentavos, copiaECola: ja.copiaECola };
        }
        const abertas = await tx.cobrancaPixManual.findMany({
          where: {
            tenantId,
            expiraEm: { gt: new Date() },
            OR: [{ pedidoId: null }, { pedido: { status: "AGUARDANDO_PAGAMENTO" } }],
          },
          select: { valorCentavos: true },
        });
        const valor = valorComCentavosUnicos(dados.totalCentavos, abertas.map((a) => a.valorCentavos));
        const criada = await tx.cobrancaPixManual.create({
          data: {
            tenantId,
            referencia: dados.referencia,
            txid: dados.txid,
            valorCentavos: valor,
            copiaECola: dados.montar(valor),
            expiraEm: dados.expiraEm,
          },
        });
        return { id: criada.id, valorCentavos: valor, copiaECola: criada.copiaECola };
      });
    },
    consultar: (id) => lerResultado(tenantId, { id }),
    buscarPorReferencia: (referencia) => lerResultado(tenantId, { referencia }),
    qr: qrPngBase64,
  };
}

/**
 * Monta o Pix a partir da credencial da loja.
 *
 * A tela Recebimento gravou a chave e o nome em `publicos` (nenhum dos dois é
 * segredo). A cidade não é campo: sai do endereço da loja.
 */
export function providerDoPixManual(t: Tenant, ctx: ContextoProvedor): PaymentProvider {
  if (!pixManualLigado(t)) throw new GatewayNaoConfigurado(FORA);
  return definicaoPixManual.criar({
    ...ctx,
    publicos: { ...ctx.publicos, cidade: cidadeDoBrCode(t.endereco) },
    pixManual: portaPixManual(t.id),
  });
}

export async function vincularCobrancaPix(tenantId: string, referencia: string): Promise<void> {
  const pedido = await prisma.pedido.findFirst({ where: { tenantId, referencia }, select: { id: true } });
  if (!pedido) return;
  await prisma.cobrancaPixManual.updateMany({
    where: { tenantId, referencia, pedidoId: null },
    data: { pedidoId: pedido.id },
  });
}

export async function consultarPixPorId(tenantId: string, pagamentoId: string): Promise<ResultadoPagamento | null> {
  const resultado = await lerResultado(tenantId, { id: pagamentoId });
  if (!resultado?.pix || resultado.pix.qrCodeBase64) return resultado;
  const qr = await qrPngBase64(resultado.pix.copiaECola);
  return qr ? { ...resultado, pix: { ...resultado.pix, qrCodeBase64: qr } } : resultado;
}

export type RespostaPix =
  | { ok: true; mensagem: string }
  | { ok: false; status: number; mensagem: string };

type CobrancaComPedido = Prisma.CobrancaPixManualGetPayload<{ include: { pedido: true } }> & {
  pedido: NonNullable<Prisma.CobrancaPixManualGetPayload<{ include: { pedido: true } }>["pedido"]>;
};

type BuscaCobranca = { erro: { status: number; mensagem: string } } | { cobranca: CobrancaComPedido };

function recusa(erro: { status: number; mensagem: string }): RespostaPix {
  return { ok: false, status: erro.status, mensagem: erro.mensagem };
}

async function cobrancaDaLoja(t: Tenant, referencia: string): Promise<BuscaCobranca> {
  if (!pixManualLigado(t)) return { erro: { status: 404, mensagem: FORA } };
  const cobranca = await prisma.cobrancaPixManual.findFirst({
    where: { tenantId: t.id, referencia },
    include: { pedido: true },
  });
  if (!cobranca?.pedido || cobranca.pedido.gateway !== "pix_manual") {
    return { erro: { status: 404, mensagem: "Não encontrei esse Pix." } };
  }
  return { cobranca: { ...cobranca, pedido: cobranca.pedido } };
}

export async function informarPixPago(
  t: Tenant,
  referencia: string,
  arquivo?: { bytes: Buffer; tipo: string },
): Promise<RespostaPix> {
  const achado = await cobrancaDaLoja(t, referencia);
  if ("erro" in achado) return recusa(achado.erro);
  const { cobranca } = achado;
  if (cobranca.pedido.status !== "AGUARDANDO_PAGAMENTO") {
    return { ok: false, status: 409, mensagem: "Este pedido não está mais esperando pagamento." };
  }
  if (cobranca.expiraEm.getTime() <= Date.now()) {
    return { ok: false, status: 409, mensagem: "Este Pix venceu. Faça o pedido de novo." };
  }

  let comprovante = cobranca.comprovante;
  if (arquivo) {
    const lido = lerComprovante(arquivo.bytes, arquivo.tipo);
    if ("erro" in lido) return { ok: false, status: 422, mensagem: lido.erro };
    if (!/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(t.slug)) {
      return { ok: false, status: 422, mensagem: "Não consegui guardar o comprovante." };
    }
    const relativo = `${t.slug}/pix/${cobranca.id}${lido.ext}`;
    const destino = path.join(UPLOADS_DIR, t.slug, "pix", `${cobranca.id}${lido.ext}`);
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, arquivo.bytes);
    comprovante = relativo;
  }

  if (cobranca.informadoEm && !arquivo) {
    return { ok: true, mensagem: "A loja já foi avisada. Ela confere o Pix e libera o pedido." };
  }
  await prisma.cobrancaPixManual.update({
    where: { id: cobranca.id },
    data: { informadoEm: cobranca.informadoEm ?? new Date(), ...(comprovante ? { comprovante } : {}) },
  });
  return {
    ok: true,
    mensagem: arquivo
      ? "Aviso recebido, com o comprovante. A loja confere o Pix e libera o pedido."
      : "Aviso recebido. A loja confere o Pix e libera o pedido.",
  };
}

async function cobrancaAConferir(t: Tenant, referencia: string): Promise<BuscaCobranca> {
  const achado = await cobrancaDaLoja(t, referencia);
  if ("erro" in achado) return achado;
  if (!achado.cobranca.informadoEm) {
    return { erro: { status: 409, mensagem: "O cliente ainda não avisou que pagou." } };
  }
  if (achado.cobranca.pedido.status !== "AGUARDANDO_PAGAMENTO") {
    return { erro: { status: 409, mensagem: "Este pedido não está mais esperando conferência." } };
  }
  return achado;
}

/** Confirmar libera o pedido como um pagamento aprovado: estoque e aviso de pago. */
export async function confirmarPixManual(t: Tenant, referencia: string): Promise<RespostaPix> {
  const achado = await cobrancaAConferir(t, referencia);
  if ("erro" in achado) return recusa(achado.erro);
  const pedido = achado.cobranca.pedido;
  if (!pedido.pagamentoId) return { ok: false, status: 409, mensagem: "Este Pix não está ligado a um pagamento." };
  // O valor conferido é o total do pedido. Os centavos a mais só identificam o
  // Pix no extrato; não são divergência de cobrança.
  await atualizarStatusPagamento(t, pedido.pagamentoId, "aprovado", pedido.totalCentavos);
  const depois = await prisma.pedido.findUnique({ where: { id: pedido.id }, select: { status: true } });
  if (depois?.status !== "PAGO") {
    return { ok: false, status: 409, mensagem: "Não consegui liberar o pedido. Tente de novo." };
  }
  return { ok: true, mensagem: "Pix confirmado. O pedido foi liberado." };
}

export async function recusarPixManual(t: Tenant, referencia: string): Promise<RespostaPix> {
  const achado = await cobrancaAConferir(t, referencia);
  if ("erro" in achado) return recusa(achado.erro);
  const pedido = achado.cobranca.pedido;
  if (!pedido.pagamentoId) return { ok: false, status: 409, mensagem: "Este Pix não está ligado a um pagamento." };
  await atualizarStatusPagamento(t, pedido.pagamentoId, "recusado");
  return { ok: true, mensagem: "Registramos que o Pix não chegou. O pedido foi cancelado e o estoque voltou." };
}

/** A fila não leva nome, e-mail nem documento: o número e o valor bastam para achar o Pix. */
export async function listarPixAConferir(tenantId: string) {
  const linhas = await prisma.cobrancaPixManual.findMany({
    where: {
      tenantId,
      informadoEm: { not: null },
      expiraEm: { gt: new Date() },
      pedido: { status: "AGUARDANDO_PAGAMENTO", gateway: "pix_manual" },
    },
    orderBy: { informadoEm: "asc" },
    select: {
      referencia: true,
      valorCentavos: true,
      informadoEm: true,
      expiraEm: true,
      comprovante: true,
      pedido: { select: { numero: true } },
    },
  });
  return linhas.map((l) => ({
    referencia: l.referencia,
    numero: l.pedido?.numero ?? null,
    valorCentavos: l.valorCentavos,
    informadoEm: l.informadoEm!.toISOString(),
    expiraEm: l.expiraEm.toISOString(),
    temComprovante: Boolean(l.comprovante),
  }));
}

export async function lerComprovanteDoPix(t: Tenant, referencia: string): Promise<{ bytes: Buffer; tipo: string } | { erro: string; status: number }> {
  if (!pixManualLigado(t)) return { erro: FORA, status: 404 };
  const cobranca = await prisma.cobrancaPixManual.findFirst({
    where: { tenantId: t.id, referencia },
    select: { comprovante: true },
  });
  const relativo = cobranca?.comprovante;
  if (!relativo || !relativo.startsWith(`${t.slug}/pix/`) || relativo.includes("..")) {
    return { erro: "Este Pix não tem comprovante.", status: 404 };
  }
  const ext = relativo.split(".").pop()?.toLowerCase() ?? "";
  const tipo = ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  try {
    const bytes = await readFile(path.join(UPLOADS_DIR, ...relativo.split("/")));
    return { bytes, tipo };
  } catch {
    return { erro: "Não encontrei o comprovante.", status: 404 };
  }
}

/**
 * Cancela o Pix na conta que passou do prazo e ainda não foi pago.
 *
 * Quem já está pago não entra. Cobrança sem pedido (a gravação do pedido
 * falhou) é apagada depois de vencer, para o centavo identificador voltar.
 */
export async function expirarPixManual(agora = new Date()): Promise<{ expirados: number }> {
  await prisma.$executeRaw`
    UPDATE "CobrancaPixManual" c
    SET "pedidoId" = p.id
    FROM "Pedido" p
    WHERE c."pedidoId" IS NULL
      AND c.referencia = p.referencia
      AND c."tenantId" = p."tenantId"
  `;
  await prisma.cobrancaPixManual.deleteMany({ where: { pedidoId: null, expiraEm: { lt: agora } } });

  const vencidas = await prisma.cobrancaPixManual.findMany({
    where: { expiraEm: { lt: agora }, pedido: { status: "AGUARDANDO_PAGAMENTO", gateway: "pix_manual" } },
    include: { pedido: { include: { tenant: true } } },
    take: 200,
  });
  let expirados = 0;
  for (const c of vencidas) {
    if (!c.pedido?.pagamentoId) continue;
    await atualizarStatusPagamento(c.pedido.tenant, c.pedido.pagamentoId, "cancelado");
    expirados++;
  }
  return { expirados };
}
