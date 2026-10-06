import { amazon } from "./canal-amazon";
import { magalu } from "./canal-magalu";
import { shopee } from "./canal-shopee";
import type { CanalConectavel, ProvedorDeCanal } from "./canal-oauth";
import { cifrar, decifrar } from "./cofre";
import { prisma } from "./db";

/**
 * A conta do lojista na Amazon, na Shopee e no Magalu.
 *
 * O aplicativo é da plataforma, um por canal; a conta é do lojista. Ele
 * autoriza na tela do próprio canal e nós guardamos só os tokens, cifrados, em
 * `ContaCanal`. O dinheiro da venda nunca passa pela Avila Ops.
 *
 * Aqui mora o que é igual nos três: gravar, renovar e apagar a credencial. O
 * que difere — endereço de autorização, assinatura, nome dos campos — está no
 * provedor de cada canal (`canal-*.ts`), que não toca no banco e por isso se
 * testa sem rede nem Postgres.
 *
 * **Conectar não é publicar.** Esta camada entrega um token válido; anúncio,
 * estoque e pedido de cada canal são trabalho próprio, como `mercadolivre-*.ts`
 * é para o Mercado Livre.
 */

const PROVEDORES: Record<CanalConectavel, ProvedorDeCanal> = { amazon, shopee, magalu };

export const CANAIS_CONECTAVEIS = Object.keys(PROVEDORES) as CanalConectavel[];

export function provedorDo(canal: string): ProvedorDeCanal | null {
  return Object.hasOwn(PROVEDORES, canal) ? PROVEDORES[canal as CanalConectavel] : null;
}

/** O propósito do `state` assinado de cada canal: ver `oauth-state.ts`. */
export function propositoDoState(canal: CanalConectavel): string {
  return `canal:${canal}`;
}

/** A URL de retorno cadastrada no aplicativo de cada canal. */
export function urlDeRetorno(canal: CanalConectavel, base: string): string {
  return `${base}/canais/${canal}/callback`;
}

export class CanalNaoConectado extends Error {}

/** Troca o que voltou da autorização pelos tokens e grava na loja. */
export async function conectar(tenantId: string, canal: CanalConectavel, retorno: URLSearchParams, base: string) {
  const t = await PROVEDORES[canal].trocarCodigo(retorno, urlDeRetorno(canal, base));
  const dados = {
    contaId: t.contaId,
    contaNome: t.contaNome,
    accessTokenEnc: cifrar(t.accessToken),
    refreshTokenEnc: cifrar(t.refreshToken),
    expiraEm: new Date(Date.now() + t.expiraEmSegundos * 1000),
    refreshExpiraEm: t.refreshExpiraEmSegundos ? new Date(Date.now() + t.refreshExpiraEmSegundos * 1000) : null,
    conectadoEm: new Date(),
  };
  return prisma.contaCanal.upsert({
    where: { tenantId_canal: { tenantId, canal } },
    create: { tenantId, canal, ...dados },
    update: dados,
    select: { canal: true, contaNome: true },
  });
}

/**
 * Apaga a credencial, e só ela. O que o lojista já anunciou no canal continua
 * lá, porque é dele: derrubar anúncio de quem só quis desconectar seria tomar
 * decisão comercial no lugar dele.
 */
export async function desconectar(tenantId: string, canal: CanalConectavel) {
  await prisma.contaCanal.deleteMany({ where: { tenantId, canal } });
}

/** O que a tela mostra de cada conta. Nunca os tokens. */
export async function contasDaLoja(tenantId: string) {
  return prisma.contaCanal.findMany({
    where: { tenantId },
    select: { canal: true, contaId: true, contaNome: true, conectadoEm: true },
  });
}

/**
 * Token válido da loja no canal, renovando quando falta pouco.
 *
 * A margem de cinco minutos é a mesma do Mercado Livre e pelo mesmo motivo: um
 * lote de catálogo leva minutos, e um token que valia no começo dele venceria
 * no meio.
 */
export function tokenDoCanal(tenantId: string, canal: CanalConectavel): Promise<{ token: string; contaId: string | null }> {
  // Uma renovação por conta de cada vez. O refresh da Shopee é de uso único:
  // duas chamadas simultâneas gastariam o mesmo, a segunda seria recusada e a
  // loja apareceria como desconectada com a conta em ordem. Vale dentro deste
  // processo, que é o que existe: a plataforma roda em um container só.
  const chave = `${tenantId}:${canal}`;
  const emCurso = EM_CURSO.get(chave);
  if (emCurso) return emCurso;
  const pedido = lerOuRenovar(tenantId, canal).finally(() => EM_CURSO.delete(chave));
  EM_CURSO.set(chave, pedido);
  return pedido;
}

const EM_CURSO = new Map<string, Promise<{ token: string; contaId: string | null }>>();

async function lerOuRenovar(tenantId: string, canal: CanalConectavel): Promise<{ token: string; contaId: string | null }> {
  const conta = await prisma.contaCanal.findUnique({ where: { tenantId_canal: { tenantId, canal } } });
  if (!conta) throw new CanalNaoConectado(`A loja não conectou a conta deste canal (${canal}).`);

  const folga = 5 * 60 * 1000;
  if (conta.expiraEm.getTime() - folga > Date.now()) {
    return { token: decifrar(conta.accessTokenEnc), contaId: conta.contaId };
  }

  let novo;
  try {
    novo = await PROVEDORES[canal].renovar(decifrar(conta.refreshTokenEnc), conta.contaId);
  } catch (erro) {
    console.error(`[canais] ${canal} recusou renovar o acesso da loja ${tenantId}:`, erro instanceof Error ? erro.message : erro);
    throw new CanalNaoConectado("O canal recusou renovar o acesso. O lojista precisa conectar de novo.");
  }

  // Shopee e Magalu trocam o refresh a cada renovação: guardar o antigo derruba
  // a próxima, e a integração para sozinha sem ninguém ter mexido em nada.
  await prisma.contaCanal.update({
    where: { id: conta.id },
    data: {
      accessTokenEnc: cifrar(novo.accessToken),
      refreshTokenEnc: cifrar(novo.refreshToken),
      expiraEm: new Date(Date.now() + novo.expiraEmSegundos * 1000),
      ...(novo.refreshExpiraEmSegundos ? { refreshExpiraEm: new Date(Date.now() + novo.refreshExpiraEmSegundos * 1000) } : {}),
    },
  });
  return { token: novo.accessToken, contaId: conta.contaId };
}
