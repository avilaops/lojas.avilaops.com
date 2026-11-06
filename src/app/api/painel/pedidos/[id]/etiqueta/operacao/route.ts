import { z } from "zod";
import { prisma } from "@/lib/db";
import { lojistaAtual } from "@/lib/sessao";
import { tokenDaLoja } from "@/lib/melhor-envio-conta";
import {
  cancelarEnviosMelhorEnvio,
  comprarEnviosMelhorEnvio,
  gerarEtiquetasMelhorEnvio,
  imprimirEtiquetasMelhorEnvio,
  lerResultadoRastreioMelhorEnvio,
  rastrearEnviosMelhorEnvio,
} from "@/lib/melhor-envio";

const Corpo = z.object({ action: z.enum(["comprar", "gerar", "imprimir", "cancelar", "rastrear"]) }).strict();

/** Operações do ciclo de uma etiqueta do Melhor Envio. Compra é explícita. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const loja = await lojistaAtual();
  if (!loja) return Response.json({ erro: "Sessão expirada." }, { status: 401 });
  const { id } = await params;
  const entrada = Corpo.safeParse(await request.json().catch(() => null));
  if (!entrada.success) return Response.json({ erro: "Operação inválida." }, { status: 400 });

  const postagem = await prisma.postagem.findFirst({ where: { pedidoId: id, tenantId: loja.id, provedor: "melhorenvio" }, include: { pedido: true } });
  if (!postagem?.provedorId) return Response.json({ erro: "O pedido ainda não tem postagem no Melhor Envio." }, { status: 404 });
  if (entrada.data.action === "comprar" && ["comprada", "gerada", "emitida"].includes(postagem.status)) return Response.json({ ok: true, status: postagem.status });
  if (entrada.data.action === "gerar" && ["gerada", "emitida"].includes(postagem.status)) return Response.json({ ok: true, status: postagem.status });
  if (entrada.data.action === "imprimir" && postagem.status === "emitida" && postagem.pdfEtiqueta) return Response.json({ ok: true, status: postagem.status, pdfEtiqueta: postagem.pdfEtiqueta });
  if (entrada.data.action !== "rastrear" && postagem.status === "cancelada") return Response.json({ erro: "A postagem já foi cancelada." }, { status: 409 });
  const token = await tokenDaLoja(loja);
  if (!token) return Response.json({ erro: "A conexão do Melhor Envio expirou. Conecte a conta novamente." }, { status: 409 });

  try {
    const ids = [postagem.provedorId];
    if (entrada.data.action === "comprar") {
      await comprarEnviosMelhorEnvio(token, ids);
      await prisma.postagem.update({ where: { id: postagem.id }, data: { status: "comprada", provedorStatus: "released" } });
      return Response.json({ ok: true, status: "comprada" });
    }
    if (entrada.data.action === "gerar") {
      await gerarEtiquetasMelhorEnvio(token, ids);
      await prisma.postagem.update({ where: { id: postagem.id }, data: { status: "gerada", provedorStatus: "generated" } });
      return Response.json({ ok: true, status: "gerada" });
    }
    if (entrada.data.action === "imprimir") {
      const resultado = await imprimirEtiquetasMelhorEnvio(token, ids);
      const url = typeof resultado.url === "string" ? resultado.url : typeof resultado.pdf === "string" ? resultado.pdf : null;
      await prisma.postagem.update({ where: { id: postagem.id }, data: { status: "emitida", pdfEtiqueta: url, provedorStatus: "generated" } });
      return Response.json({ ok: true, status: "emitida", pdfEtiqueta: url });
    }
    if (entrada.data.action === "cancelar") {
      await cancelarEnviosMelhorEnvio(token, ids);
      await prisma.postagem.update({ where: { id: postagem.id }, data: { status: "cancelada", provedorStatus: "cancelled" } });
      return Response.json({ ok: true, status: "cancelada" });
    }

    const resultado = await rastrearEnviosMelhorEnvio(token, ids);
    const rastreios = lerResultadoRastreioMelhorEnvio(resultado);
    const atual = rastreios.find((r) => r.id === postagem.provedorId);
    if (atual) {
      await prisma.postagem.update({ where: { id: postagem.id }, data: { provedorStatus: atual.status, codigoObjeto: atual.tracking, rastreioUrl: atual.trackingUrl } });
    }
    return Response.json({ ok: true, postagem: atual ?? null });
  } catch (erro) {
    return Response.json({ erro: erro instanceof Error ? erro.message : "Falha na operação do Melhor Envio." }, { status: 502 });
  }
}
