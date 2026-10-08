import { z } from "zod";
import { planoPermite } from "@/lib/api-chaves";
import { cifrar } from "@/lib/cofre";
import { prisma } from "@/lib/db";
import { exigir } from "@/lib/operadores";
import { EVENTOS_DE_WEBHOOK, eventosValidos, gerarSegredoDeWebhook, motivoDaRecusa } from "@/lib/webhooks-api";

/**
 * Webhooks da API, no painel da loja.
 *
 * O segredo só existe por inteiro na resposta do POST. Fica cifrado no banco
 * (e não em hash, como as chaves) porque cada entrega é assinada com ele;
 * perdeu, apaga o webhook e cria outro. Ver docs/API.md.
 */
export const dynamic = "force-dynamic";

/** Um por sistema é o uso esperado; dezenas é endereço esquecido recebendo dado de cliente. */
const MAXIMO_POR_LOJA = 5;

export async function GET() {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;

  const webhooks = await prisma.webhookApi.findMany({
    where: { tenantId: s.tenant.id },
    orderBy: { criadoEm: "desc" },
    include: {
      entregas: { orderBy: { criadaEm: "desc" }, take: 5, select: { id: true, tipo: true, status: true, tentativas: true, ultimoStatus: true, ultimoErro: true, criadaEm: true, entregueEm: true } },
    },
  });

  return Response.json({
    // Mesma regra da chave secreta: é integração de servidor, recurso do Loja Pro.
    podeUsar: planoPermite("SECRETA", s.tenant.plano),
    eventos: Object.entries(EVENTOS_DE_WEBHOOK).map(([tipo, descricao]) => ({ tipo, descricao })),
    webhooks: webhooks.map((w) => ({
      id: w.id,
      nome: w.nome,
      url: w.url,
      eventos: w.eventos,
      ativo: w.ativo,
      desligadoEm: w.desligadoEm,
      desligadoMotivo: w.desligadoMotivo,
      ultimaEntregaEm: w.ultimaEntregaEm,
      criadoEm: w.criadoEm,
      entregas: w.entregas,
    })),
  });
}

const Novo = z.object({
  nome: z.string().trim().min(2, "Dê um nome para reconhecer o webhook (ex.: ERP).").max(60),
  url: z.string().trim().min(1, "Informe o endereço."),
  eventos: z.array(z.string()).default([]),
});

export async function POST(request: Request) {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;
  const loja = s.tenant;

  if (!planoPermite("SECRETA", loja.plano)) {
    return Response.json({ erro: "Webhooks da API são recurso do plano Loja Pro.", upgradeNecessario: true }, { status: 403 });
  }
  const lido = Novo.safeParse(await request.json().catch(() => null));
  if (!lido.success) return Response.json({ erro: lido.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });

  const recusa = motivoDaRecusa(lido.data.url);
  if (recusa) return Response.json({ erro: recusa }, { status: 400 });
  const eventos = eventosValidos(lido.data.eventos);
  if (eventos.length === 0) return Response.json({ erro: "Marque ao menos um evento." }, { status: 400 });

  if ((await prisma.webhookApi.count({ where: { tenantId: loja.id } })) >= MAXIMO_POR_LOJA) {
    return Response.json({ erro: `A loja já tem ${MAXIMO_POR_LOJA} webhooks. Apague os que não usa antes de criar outro.` }, { status: 409 });
  }

  const segredo = gerarSegredoDeWebhook();
  const w = await prisma.webhookApi.create({
    data: { tenantId: loja.id, nome: lido.data.nome, url: lido.data.url, eventos, segredoEnc: cifrar(segredo) },
  });
  return Response.json({ id: w.id, nome: w.nome, url: w.url, eventos: w.eventos, segredo, mensagem: "Copie o segredo agora: ele não será exibido de novo." });
}

/** PATCH { id } — religa um webhook que foi desligado por falhar demais. */
export async function PATCH(request: Request) {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;
  const corpo = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof corpo?.id === "string" ? corpo.id : "";
  const r = await prisma.webhookApi.updateMany({
    where: { id, tenantId: s.tenant.id },
    data: { ativo: true, falhasSeguidas: 0, desligadoEm: null, desligadoMotivo: null },
  });
  if (r.count !== 1) return Response.json({ erro: "Webhook não encontrado." }, { status: 404 });
  return Response.json({ sucesso: true });
}

/** DELETE ?id= — apaga o webhook e a fila dele. */
export async function DELETE(request: Request) {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const r = await prisma.webhookApi.deleteMany({ where: { id, tenantId: s.tenant.id } });
  if (r.count !== 1) return Response.json({ erro: "Webhook não encontrado." }, { status: 404 });
  return Response.json({ sucesso: true });
}
