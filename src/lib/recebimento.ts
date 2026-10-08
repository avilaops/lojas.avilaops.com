import type { Tenant } from "@prisma/client";
import { decifrar } from "./cofre";
import { conectadoPorOAuth } from "./mercado-pago-conta";

/**
 * Confere se a credencial do Mercado Pago realmente cobra.
 *
 * Existe porque credencial errada não dá erro no dia em que é salva: dá erro na
 * primeira venda, quando o comprador já está com o cartão na mão. O lojista
 * cola, aperta "Testar" e sabe na hora.
 *
 * O que dá para afirmar sem cobrar ninguém:
 *
 * 1. O token vale (`GET /users/me` responde 200 e diz de quem é a conta).
 * 2. É de produção ou de teste. Token `TEST-` cobra em dinheiro de brinquedo e
 *    é o engano mais comum de quem segue tutorial.
 * 3. A conta é brasileira (`site_id = MLB`).
 *
 * O que **não** dá: saber se a public key é da mesma conta do token. Não há
 * endpoint que responda isso sem criar uma cobrança, e avisar por chute seria
 * pior do que não avisar.
 */
const API = "https://api.mercadopago.com";

export type Diagnostico = {
  ok: boolean;
  /** Frase pronta para a tela, na língua do lojista. */
  mensagem: string;
  conta?: { apelido: string | null; email: string | null };
  avisos: string[];
};

type UsuarioMp = { id?: number; nickname?: string; email?: string; site_id?: string };

export async function testarRecebimento(
  t: Tenant,
  digitado?: { accessToken?: string; publicKey?: string },
): Promise<Diagnostico> {
  const accessToken = digitado?.accessToken?.trim() || (t.mpAccessTokenEnc ? decifrar(t.mpAccessTokenEnc) : "");
  const publicKey = digitado?.publicKey?.trim() || t.mpPublicKey || "";

  if (!accessToken) {
    return { ok: false, mensagem: "Nenhuma conta conectada ainda. Conecte o Mercado Pago e teste.", avisos: [] };
  }

  const avisos: string[] = [];
  if (accessToken.startsWith("TEST-")) {
    avisos.push("Este é um token de TESTE: as vendas não entram de verdade. Use as credenciais de produção.");
  }
  if (publicKey.startsWith("TEST-")) {
    avisos.push("A public key também é de teste.");
  }
  if (!publicKey) {
    avisos.push("Falta a public key: sem ela a loja não consegue aceitar cartão.");
  }
  // Só vale para chave colada: na conexão por OAuth o segredo é o do aplicativo
  // da plataforma, e avisar o lojista de algo que ele não resolve só assusta.
  const porOAuth = conectadoPorOAuth(t) && !digitado?.accessToken?.trim();
  if (!porOAuth && !t.mpWebhookSecretEnc) {
    avisos.push("Sem o segredo do webhook, o pedido só é confirmado na verificação periódica, não na hora do pagamento.");
  }

  let resposta: Response;
  try {
    resposta = await fetch(`${API}/users/me`, {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, mensagem: "Não consegui falar com o Mercado Pago agora. Tente de novo em alguns minutos.", avisos };
  }

  if (resposta.status === 401 || resposta.status === 403) {
    return {
      ok: false,
      mensagem: porOAuth
        ? "O Mercado Pago recusou o acesso desta conexão. Desconecte e conecte a conta de novo."
        : "O Mercado Pago recusou este access token. Confira se copiou a credencial de produção inteira, sem espaços.",
      avisos,
    };
  }
  if (!resposta.ok) {
    return { ok: false, mensagem: `O Mercado Pago respondeu ${resposta.status}. Tente de novo; se insistir, refaça a credencial.`, avisos };
  }

  const usuario = (await resposta.json().catch(() => ({}))) as UsuarioMp;
  if (usuario.site_id && usuario.site_id !== "MLB") {
    avisos.push(`Esta conta é do Mercado Pago de outro país (${usuario.site_id}). No Brasil o esperado é MLB.`);
  }

  return {
    ok: true,
    mensagem: avisos.length
      ? "A credencial funciona, mas veja os avisos antes de vender."
      : "Tudo certo: a loja está pronta para receber.",
    conta: { apelido: usuario.nickname ?? null, email: usuario.email ?? null },
    avisos,
  };
}
