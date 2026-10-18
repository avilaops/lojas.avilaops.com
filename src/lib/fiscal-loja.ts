import { prisma } from "./db";
import { abrirCertificado, ErroFiscal, lerCertificado } from "./fiscal-certificado";
import { consultarSefaz } from "./fiscal-distribuicao";

export const RESUMO_FISCAL = {
  cnpj: true, uf: true, titular: true, validoAte: true,
  ultimoNsu: true, proximaConsultaEm: true, ultimaMensagem: true,
} as const;

export async function receberNotasPeriodicamente() {
  const lojas = await prisma.fiscalLoja.findMany({
    where: { proximaConsultaEm: { lte: new Date() }, validoAte: { gt: new Date() }, tenant: { status: "ATIVA" } },
    orderBy: { proximaConsultaEm: "asc" }, take: 5, select: { tenantId: true },
  });
  let recebidos = 0;
  let falhas = 0;
  for (const loja of lojas) {
    try { recebidos += (await sincronizarNotas(loja.tenantId)).recebidos; }
    catch { falhas++; }
  }
  if (falhas) throw new ErroFiscal(`${falhas} consulta(s) fiscal(is) falharam. Confira a mensagem na configuração fiscal de cada loja.`);
  return { lojas: lojas.length, recebidos };
}

export async function sincronizarNotas(tenantId: string, consultar: typeof consultarSefaz = consultarSefaz) {
  const fiscal = await prisma.fiscalLoja.findUnique({ where: { tenantId }, include: { tenant: { select: { cnpj: true, status: true } } } });
  if (!fiscal || fiscal.tenant.status !== "ATIVA") throw new ErroFiscal("Configure o certificado em uma loja ativa.");
  const agora = new Date();
  // Reserva persistente antes da rede: queda do processo também respeita o intervalo.
  const reserva = await prisma.fiscalLoja.updateMany({
    where: { tenantId, proximaConsultaEm: { lte: agora }, certificadoEnc: fiscal.certificadoEnc },
    data: { proximaConsultaEm: new Date(agora.getTime() + 3_600_000) },
  });
  if (!reserva.count) throw new ErroFiscal("A consulta já está em andamento ou no intervalo de espera. Confira o horário na tela.");
  let pfx: Buffer | undefined;
  try {
    if (fiscal.cnpj !== fiscal.tenant.cnpj?.replace(/[^0-9A-Z]/gi, "").toUpperCase()) {
      throw new ErroFiscal("O CNPJ da loja mudou. Confira a configuração fiscal antes de consultar.");
    }
    const certificado = abrirCertificado(fiscal.certificadoEnc);
    pfx = certificado.pfx;
    const senha = certificado.senha;
    lerCertificado(pfx, senha, fiscal.cnpj);
    const resposta = await consultar(pfx, senha, fiscal.cnpj, fiscal.uf, fiscal.ultimoNsu);
    if (resposta.status === "138" && resposta.ultimoNsu <= fiscal.ultimoNsu) throw new ErroFiscal("A SEFAZ não avançou o controle de consulta.");
    const proximaConsultaEm = new Date(Date.now() + (resposta.status === "138" && resposta.ultimoNsu < resposta.maxNsu ? 0 : 3_600_000));
    const cursorRecebido = /^\d{15}$/.test(resposta.ultimoNsu) ? resposta.ultimoNsu : null;
    const cursorAjustado = resposta.status === "656" && cursorRecebido !== null && cursorRecebido !== fiscal.ultimoNsu;
    const ultimaMensagem = cursorAjustado
      ? `SEFAZ 656: ${resposta.mensagem} O controle da próxima consulta foi ajustado para o NSU informado pela SEFAZ.`
      : `SEFAZ ${resposta.status}: ${resposta.mensagem}`;
    await prisma.$transaction(async (tx) => {
      if (resposta.documentos.length) await tx.documentoFiscalLoja.createMany({
        data: resposta.documentos.map((d) => ({ ...d, tenantId, cnpj: fiscal.cnpj })), skipDuplicates: true,
      });
      await tx.fiscalLoja.update({ where: { tenantId }, data: {
        ...(resposta.status !== "656" || cursorRecebido ? { ultimoNsu: cursorRecebido ?? resposta.ultimoNsu } : {}),
        proximaConsultaEm, ultimaMensagem,
      } });
    });
    return { recebidos: resposta.documentos.length, mensagem: resposta.mensagem, proximaConsultaEm, cursorAjustado };
  } catch (erro) {
    const mensagem = erro instanceof ErroFiscal ? erro.message : "Não foi possível salvar a consulta fiscal. Tente novamente após o intervalo.";
    await prisma.fiscalLoja.update({ where: { tenantId }, data: { ultimaMensagem: mensagem, proximaConsultaEm: new Date(Date.now() + 3_600_000) } });
    throw new ErroFiscal(mensagem);
  } finally { pfx?.fill(0); }
}
