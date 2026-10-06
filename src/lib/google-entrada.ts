import { randomBytes, timingSafeEqual } from "node:crypto";

/**
 * "Entrar com Google" no cadastro e no login do painel.
 *
 * Nasce desligado: sem `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` o botão não
 * aparece e as rotas respondem 404. Para ligar, crie um cliente OAuth "Web" no
 * Google Cloud com o retorno `https://<LOJAS_BASE_DOMAIN>/api/painel/google/retorno`.
 *
 * Só se pede `openid email`: o Google aqui confirma o e-mail, que é tudo o que
 * o cadastro precisa. Sem biblioteca — são duas chamadas HTTP.
 */
const BASE = process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com";
export const COOKIE_ESTADO = "lojas_google_estado";
const EMISSORES = new Set(["accounts.google.com", "https://accounts.google.com"]);

export function googleConfigurado(): boolean {
  return Boolean((process.env.GOOGLE_CLIENT_ID ?? "").trim() && (process.env.GOOGLE_CLIENT_SECRET ?? "").trim());
}

function enderecoDeRetorno(): string {
  return `https://${BASE}/api/painel/google/retorno`;
}

export function novoEstado(): string {
  return randomBytes(24).toString("base64url");
}

export function urlDeAutorizacao(estado: string): string {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
    redirect_uri: enderecoDeRetorno(),
    response_type: "code",
    scope: "openid email",
    state: estado,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export function estadoConfere(recebido: string | null, guardado: string | undefined): boolean {
  if (!recebido || !guardado || recebido.length !== guardado.length) return false;
  return timingSafeEqual(Buffer.from(recebido), Buffer.from(guardado));
}

/**
 * O e-mail confirmado pelo Google, ou `null`.
 *
 * O `id_token` vem direto do endpoint de token do Google, numa conexão TLS
 * autenticada com o segredo do cliente — nesse caminho a documentação do
 * Google dispensa conferir a assinatura. O que se confere é para quem ele foi
 * emitido, por quem, a validade e se o e-mail está verificado.
 */
export function emailDoIdToken(idToken: string, agora = Date.now()): string | null {
  const partes = idToken.split(".");
  if (partes.length !== 3) return null;
  try {
    const dados = JSON.parse(Buffer.from(partes[1], "base64url").toString("utf8")) as {
      aud?: unknown; iss?: unknown; exp?: unknown; email?: unknown; email_verified?: unknown;
    };
    if (dados.aud !== (process.env.GOOGLE_CLIENT_ID ?? "").trim()) return null;
    if (typeof dados.iss !== "string" || !EMISSORES.has(dados.iss)) return null;
    if (typeof dados.exp !== "number" || dados.exp * 1000 < agora) return null;
    if (dados.email_verified !== true && dados.email_verified !== "true") return null;
    return typeof dados.email === "string" ? dados.email.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

export async function trocarCodigoPorEmail(codigo: string): Promise<string | null> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: codigo,
      client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
      redirect_uri: enderecoDeRetorno(),
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) {
    // Só o status: a resposta de erro não tem segredo, mas o corpo da de
    // sucesso tem, e o hábito de não logar corpo de token vale para os dois.
    console.error("[google] troca do código falhou:", r.status);
    return null;
  }
  const dados = (await r.json().catch(() => null)) as { id_token?: string } | null;
  return dados?.id_token ? emailDoIdToken(dados.id_token) : null;
}
