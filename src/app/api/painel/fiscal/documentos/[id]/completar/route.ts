import { prisma } from "@/lib/db";
import { exigir } from "@/lib/operadores";
import { origemFiscalPermitida } from "@/lib/fiscal-origem";
import { validarXmlCompleto } from "@/lib/fiscal-xml-completo";
import { ErroFiscal } from "@/lib/fiscal-certificado";

export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { s, erro } = await exigir("fiscal");
  if (erro) return erro;
  if (!origemFiscalPermitida(request)) return Response.json({ erro: "Origem não autorizada." }, { status: 403 });
  const { id } = await params;
  const nota = await prisma.documentoFiscalLoja.findFirst({ where: { id, tenantId: s.tenant.id }, select: { chave: true, schema: true, tenantId: true } });
  if (!nota?.chave) return Response.json({ erro: "Documento fiscal não encontrado." }, { status: 404 });
  if (/^procNFe/.test(nota.schema)) return Response.json({ sucesso: true, disponivel: true });
  const limite = 3 * 1024 * 1024;
  const header = Number(request.headers.get("content-length"));
  if (header > limite) return Response.json({ erro: "XML excede 3 MB." }, { status: 413 });
  try {
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ erro: "Arquivo XML ausente." }, { status: 400 });
    const partes: Uint8Array[] = [];
    let tamanho = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      tamanho += value.byteLength;
      if (tamanho > limite) { await reader.cancel(); return Response.json({ erro: "Envie um XML de até 3 MB." }, { status: 413 }); }
      partes.push(value);
    }
    const bytes = Buffer.concat(partes);
    if (!bytes.byteLength) return Response.json({ erro: "Arquivo XML vazio." }, { status: 400 });
    const cnpj = s.tenant.cnpj?.replace(/\D/g, "") ?? "";
    const validado = validarXmlCompleto(new TextDecoder("utf-8", { fatal: true }).decode(bytes), nota.chave, cnpj);
    const resultado = await prisma.documentoFiscalLoja.updateMany({ where: { id, tenantId: s.tenant.id, schema: { startsWith: "resNFe" }, chave: nota.chave }, data: { xml: validado.xml, schema: validado.schema } });
    if (!resultado.count) return Response.json({ erro: "Documento alterado durante a operação." }, { status: 409 });
    return Response.json({ sucesso: true, disponivel: true });
  } catch (e) {
    return Response.json({ erro: e instanceof ErroFiscal ? e.message : "Não foi possível validar o XML." }, { status: 422 });
  }
}
