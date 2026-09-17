import type { Tenant } from "@prisma/client";
import { prisma } from "./db";
import { chamarMl } from "./mercadolivre";
import { emitir, lojista } from "./eventos";
import { urlDaLoja } from "./tenant";

/**
 * Perguntas de comprador no Mercado Livre.
 *
 * No ML, responder rápido é o que converte: a pergunta aparece na página do
 * anúncio e quem pergunta costuma estar decidindo naquele minuto. Até aqui a
 * notificação `questions` chegava na fila e era marcada como IGNORADO — o
 * lojista só via a pergunta se abrisse o app do Mercado Livre.
 *
 * Agora a pergunta entra no banco da loja, vira evento (o n8n avisa o lojista)
 * e pode ser respondida do painel. O texto da resposta é validado **aqui**,
 * antes de ir: o ML recusa resposta com telefone, e-mail ou link, e a recusa
 * chega como um erro genérico que não ensina nada a quem escreveu.
 */

/** Recorte de `GET /questions/{id}`. */
export interface PerguntaMl {
  id: number | string;
  text?: string;
  status?: string;
  item_id?: string;
  date_created?: string;
  from?: { id?: number | string; nickname?: string };
  answer?: { text?: string; status?: string; date_created?: string } | null;
}

export const LIMITE_RESPOSTA = 2000;

/**
 * O ML recusa resposta com contato — a regra existe para a conversa não sair
 * da plataforma. Barrar aqui é o que transforma um erro genérico do ML numa
 * frase que o lojista entende.
 */
const CONTATO = [
  { teste: /\b(?:\+?55\s*)?\(?\d{2}\)?\s*9?\d{4}[-\s]?\d{4}\b/, motivo: "um telefone" },
  { teste: /[\w.+-]+@[\w-]+\.[\w.]+/, motivo: "um e-mail" },
  { teste: /\b(?:https?:\/\/|www\.)\S+/i, motivo: "um link" },
  // O `@` não é caractere de palavra, então `\b@` nunca casa depois de um
  // espaço: "@minhaloja" passava batido. Aqui a âncora é o começo ou o espaço.
  { teste: /\b(?:whats\s?app|zap|telegram|instagram)\b|(?:^|\s)@[a-z0-9._]{3,}/i, motivo: "um convite para falar fora do Mercado Livre" },
];

export function validarResposta(texto: unknown): { ok: true; texto: string } | { ok: false; erro: string } {
  const limpo = String(texto ?? "").replace(/\s+/g, " ").trim();
  if (!limpo) return { ok: false, erro: "Escreva a resposta antes de enviar." };
  if (limpo.length > LIMITE_RESPOSTA) return { ok: false, erro: `O Mercado Livre aceita até ${LIMITE_RESPOSTA} caracteres; esta tem ${limpo.length}.` };
  const achado = CONTATO.find((c) => c.teste.test(limpo));
  if (achado) return { ok: false, erro: `O Mercado Livre recusa resposta com ${achado.motivo}. Responda por aqui e combine o resto depois da compra.` };
  return { ok: true, texto: limpo };
}

/** Os campos da pergunta, já no vocabulário da loja. Função pura. */
export function mapearPergunta(q: PerguntaMl) {
  return {
    mlId: String(q.id),
    mlbId: String(q.item_id ?? ""),
    texto: String(q.text ?? "").slice(0, 4000),
    autor: q.from?.nickname ?? (q.from?.id != null ? `Comprador ${q.from.id}` : null),
    statusMl: q.status ?? "UNANSWERED",
    resposta: q.answer?.text ?? null,
    respondidaEm: q.answer?.date_created ? new Date(q.answer.date_created) : null,
    perguntadaEm: q.date_created ? new Date(q.date_created) : new Date(),
  };
}

/**
 * Lê a pergunta no ML e grava. Idempotente pelo `mlId`: o mesmo aviso chega
 * mais de uma vez, e a segunda vez só atualiza o estado.
 */
export async function registrarPerguntaMl(loja: Tenant, perguntaId: string) {
  const q = await chamarMl<PerguntaMl>(loja, `/questions/${encodeURIComponent(perguntaId)}`);
  const dados = mapearPergunta(q);
  if (!dados.mlbId) throw new Error("A pergunta não diz de qual anúncio é.");

  const anuncio = await prisma.anuncioMercadoLivre.findFirst({
    where: { tenantId: loja.id, mlbId: dados.mlbId },
    select: { id: true, produtoId: true, produto: { select: { nome: true, slug: true } } },
  });

  const existente = await prisma.perguntaMercadoLivre.findUnique({ where: { mlId: dados.mlId }, select: { id: true } });
  const pergunta = await prisma.perguntaMercadoLivre.upsert({
    where: { mlId: dados.mlId },
    create: { ...dados, tenantId: loja.id, anuncioId: anuncio?.id ?? null, produtoId: anuncio?.produtoId ?? null },
    update: { statusMl: dados.statusMl, resposta: dados.resposta, respondidaEm: dados.respondidaEm },
  });

  // Avisa só quando é pergunta nova e ainda sem resposta: quem responde pelo
  // app do ML não pode receber um "responda isso" logo depois.
  if (!existente && dados.statusMl === "UNANSWERED") {
    await emitir({
      // O prefixo `mercadolivre.` é da fila de entrada (`AutomacaoEvento` que o
      // webhook grava). Um evento de saída com esse prefixo seria reprocessado
      // como se fosse aviso do ML — daí `canal.`.
      tipo: "canal.pergunta-recebida",
      slug: loja.slug,
      canal: "mercadolivre",
      perguntaId: pergunta.id,
      produtoNome: anuncio?.produto.nome ?? dados.mlbId,
      texto: dados.texto,
      linkPainel: `${urlDaLoja(loja)}/painel/configuracoes/canais`,
      ...lojista(loja),
    });
  }

  return { perguntaId: pergunta.id, nova: !existente, statusMl: dados.statusMl };
}

/** Responde no ML e guarda o que foi respondido, com quem respondeu. */
export async function responderPerguntaMl(loja: Tenant, perguntaId: string, texto: string, operador?: string | null) {
  const pergunta = await prisma.perguntaMercadoLivre.findFirst({ where: { id: perguntaId, tenantId: loja.id } });
  if (!pergunta) throw new Error("Pergunta não encontrada nesta loja.");
  if (pergunta.statusMl === "ANSWERED") throw new Error("Esta pergunta já foi respondida.");

  const validada = validarResposta(texto);
  if (!validada.ok) throw new Error(validada.erro);

  try {
    await chamarMl(loja, "/answers", { method: "POST", body: JSON.stringify({ question_id: Number(pergunta.mlId), text: validada.texto }) });
  } catch (erro) {
    const mensagem = (erro instanceof Error ? erro.message : "Falha desconhecida.").slice(0, 500);
    await prisma.perguntaMercadoLivre.update({ where: { id: pergunta.id }, data: { motivoErro: mensagem } });
    throw new Error(mensagem);
  }

  return prisma.perguntaMercadoLivre.update({
    where: { id: pergunta.id },
    data: { statusMl: "ANSWERED", resposta: validada.texto, respondidaPor: operador ?? null, respondidaEm: new Date(), motivoErro: null },
    select: { id: true, resposta: true, respondidaEm: true },
  });
}

/** O que está esperando resposta, mais antiga primeiro: é a fila do lojista. */
export async function perguntasPendentes(tenantId: string, limite = 50) {
  return prisma.perguntaMercadoLivre.findMany({
    where: { tenantId, statusMl: "UNANSWERED" },
    orderBy: { perguntadaEm: "asc" },
    take: Math.min(Math.max(limite, 1), 200),
    select: { id: true, texto: true, autor: true, mlbId: true, perguntadaEm: true, motivoErro: true, produto: { select: { nome: true, slug: true } } },
  });
}
