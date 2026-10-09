import { CAMINHO_RETORNO, configSSO } from "./sso";

/**
 * Convite de quem entra na equipe da loja, pedido ao login único (Auth).
 *
 * O dono digitava uma senha para o funcionário e combinava com ele por fora.
 * Com a credencial do Auth configurada, deixar a senha em branco vira convite:
 * o Auth cria a conta da pessoa, libera o Lojas para ela e escreve o e-mail
 * com o endereço de criar a senha. Ao salvar, ela volta pela rota de entrada
 * do login único e cai no painel da loja.
 *
 * O endereço de criar a senha é uma chave da conta. Com o e-mail enviado ele
 * nem chega aqui; quando chega (o envio não saiu), é descartado: não vai a
 * tela, banco nem log.
 */

export type SituacaoDoConvite = "ENVIADO" | "FALHOU" | "PENDENTE";

export type ResultadoDoConvite = { situacao: SituacaoDoConvite; detalhe: string };

export type ConfigConvite = { url: string; autorizacao: string };

export const CONVITE_DESLIGADO =
  "O convite por e-mail ainda não está ligado nesta plataforma. Defina uma senha para a pessoa e combine com ela.";

/** Tempo-limite da chamada ao Auth. Ver docs/ISOLAMENTO-OPERACIONAL.md. */
const TEMPO_LIMITE_MS = 8_000;

/**
 * Ligado só com o login único (`SSO_APP_ID`) e com a credencial de sistema
 * (`AUTH_CLIENT_ID` + `AUTH_CLIENT_SECRET`, de uma integração criada no painel
 * do Auth para o app do Lojas). Sem o login único o convite criaria uma senha
 * que não abre o painel.
 */
export function configConvite(env: Record<string, string | undefined> = process.env): ConfigConvite | null {
  const sso = configSSO(env);
  const id = (env.AUTH_CLIENT_ID ?? "").trim();
  const segredo = (env.AUTH_CLIENT_SECRET ?? "").trim();
  if (!sso || !id || !segredo) return null;
  return {
    url: `${sso.url}/api/provisionamento/acessos`,
    autorizacao: `Basic ${Buffer.from(`${encodeURIComponent(id)}:${encodeURIComponent(segredo)}`).toString("base64")}`,
  };
}

const MOTIVO_DO_AUTH: Record<string, string> = {
  sem_email: "O login único ainda não envia e-mail. A pessoa foi liberada; avise-a você mesmo.",
  limite: "Muitos convites para este e-mail na última hora. Tente de novo mais tarde.",
  falhou: "O login único não conseguiu entregar o e-mail. Confira o endereço e envie de novo.",
};

type Buscar = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Pede o convite. Nunca lança: o acesso já foi criado na loja, e o que
 * aconteceu com o convite é dado para a tela, não erro da requisição.
 */
export async function convidarParaAEquipe(
  cfg: ConfigConvite | null,
  pedido: { email: string; nome: string; loja: string; hostBase: string },
  buscar: Buscar = fetch,
): Promise<ResultadoDoConvite> {
  if (!cfg) return { situacao: "PENDENTE", detalhe: CONVITE_DESLIGADO };

  let resposta: Response;
  try {
    resposta = await buscar(cfg.url, {
      method: "POST",
      headers: { authorization: cfg.autorizacao, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        email: pedido.email.trim().toLowerCase(),
        nome: pedido.nome.trim().slice(0, 120),
        enviarConvite: true,
        empresa: pedido.loja,
        // Criada a senha, a pessoa volta pela entrada do login único, que abre o painel.
        destino: `https://${pedido.hostBase}${CAMINHO_RETORNO}`,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
  } catch {
    return { situacao: "FALHOU", detalhe: "Não foi possível falar com o login único agora. Envie o convite de novo em instantes." };
  }

  const dados = (await resposta.json().catch(() => null)) as { criada?: unknown; envio?: unknown; error?: unknown } | null;
  if (resposta.status === 401 || resposta.status === 403) {
    return { situacao: "FALHOU", detalhe: "O login único recusou a credencial do Lojas. Avise a Ávila Ops." };
  }
  if (!resposta.ok) {
    // 409 traz mensagem para quem convida (conta desligada no login único).
    const dito = resposta.status === 409 && typeof dados?.error === "string" ? dados.error.slice(0, 200) : null;
    return { situacao: "FALHOU", detalhe: dito ?? `O login único respondeu ${resposta.status}.` };
  }

  if (dados?.envio === "enviado") {
    return {
      situacao: "ENVIADO",
      detalhe: dados.criada === true ? "com o endereço para criar a senha" : "a pessoa já tinha conta Ávila Ops e entra com a senha que já usa",
    };
  }
  const motivo = typeof dados?.envio === "string" ? MOTIVO_DO_AUTH[dados.envio] : undefined;
  return { situacao: "FALHOU", detalhe: motivo ?? "A pessoa foi liberada, mas o e-mail do convite não saiu." };
}
