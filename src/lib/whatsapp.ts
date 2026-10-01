/**
 * WhatsApp pela API oficial da Meta (Cloud API).
 *
 * Toda mensagem que a loja inicia, fora da janela de 24 h, exige um **template
 * aprovado** — não dá para mandar texto livre. Os sete templates e o texto de
 * cada um estão em `docs/WHATSAPP-TEMPLATES.md`; aqui só entram o nome, o
 * idioma e os parâmetros na ordem.
 *
 * Como o SMTP, isto nasce desligado: sem `WHATSAPP_TOKEN` e `WHATSAPP_PHONE_ID`
 * o canal não existe, e os eventos que dependem dele continuam indo para o n8n
 * inteiros.
 */

export interface ConfiguracaoWhatsapp {
  token: string;
  /** O Phone Number ID da conta, não o número. */
  telefoneId: string;
  versao: string;
}

export function lerConfiguracaoWhatsapp(): ConfiguracaoWhatsapp | null {
  const token = (process.env.WHATSAPP_TOKEN ?? "").trim();
  const telefoneId = (process.env.WHATSAPP_PHONE_ID ?? "").trim();
  if (!token || !telefoneId) return null;
  return { token, telefoneId, versao: (process.env.WHATSAPP_API_VERSAO ?? "v21.0").trim() || "v21.0" };
}

export function whatsappConfigurado(): boolean {
  return lerConfiguracaoWhatsapp() !== null;
}

export class FalhaDoWhatsapp extends Error {}

/**
 * O número como a Meta quer: só dígitos, com código do país.
 *
 * O que está no banco veio de formulário: `(16) 99999-0000`, `+55 16 99999
 * 0000`, `16999990000`. Sem código do país a Meta aceita e entrega para o
 * lugar errado, então o 55 é acrescentado quando o número tem cara de
 * brasileiro (10 ou 11 dígitos) e recusado quando não dá para saber.
 */
export function numeroParaMeta(bruto: string | null | undefined): string | null {
  if (typeof bruto !== "string") return null;
  const digitos = bruto.replace(/\D+/g, "");
  if (!digitos) return null;
  // 10 = fixo com DDD, 11 = celular com DDD (o 9 na frente).
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  // Já veio com o país: 12 ou 13 dígitos começando em 55.
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) return digitos;
  // Número de fora do Brasil, em E.164 sem o "+".
  if (digitos.length >= 11 && digitos.length <= 15 && !digitos.startsWith("0")) return digitos;
  return null;
}

export interface MensagemWhatsapp {
  /** Número de destino, como está no banco — a normalização é aqui dentro. */
  para: string;
  /** Nome do template aprovado no WhatsApp Manager. */
  template: string;
  /** Na ordem de `{{1}}`, `{{2}}`… O texto de cada um está no doc. */
  parametros: string[];
  idioma?: string;
}

/**
 * Parâmetro de template não aceita quebra de linha nem espaço duplo — a Meta
 * recusa a mensagem inteira com `(#132000)`. Cortar aqui é melhor do que a
 * mensagem não sair por causa de um nome de produto com `\n` no meio.
 */
export function limparParametro(valor: string): string {
  const limpo = valor.replace(/\s+/g, " ").trim();
  return limpo.length > 900 ? `${limpo.slice(0, 897)}...` : limpo;
}

const TEMPO_LIMITE_MS = 15_000;

/** Manda o template. Devolve o id da mensagem; lança `FalhaDoWhatsapp` se não foi. */
export async function enviarWhatsapp(mensagem: MensagemWhatsapp): Promise<{ messageId: string }> {
  const config = lerConfiguracaoWhatsapp();
  if (!config) throw new FalhaDoWhatsapp("WhatsApp não configurado neste ambiente");
  const numero = numeroParaMeta(mensagem.para);
  if (!numero) throw new FalhaDoWhatsapp(`número de destino inválido: ${String(mensagem.para).slice(0, 40)}`);

  const base = (process.env.WHATSAPP_API_URL ?? "https://graph.facebook.com").replace(/\/+$/, "");
  const corpo = {
    messaging_product: "whatsapp",
    to: numero,
    type: "template",
    template: {
      name: mensagem.template,
      language: { code: mensagem.idioma ?? "pt_BR" },
      components: mensagem.parametros.length
        ? [{ type: "body", parameters: mensagem.parametros.map((p) => ({ type: "text", text: limparParametro(p) })) }]
        : [],
    },
  };

  let resposta: Response;
  try {
    resposta = await fetch(`${base}/${config.versao}/${encodeURIComponent(config.telefoneId)}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${config.token}`, "content-type": "application/json" },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
  } catch (erro) {
    throw new FalhaDoWhatsapp(`não alcancei a Meta: ${erro instanceof Error ? erro.message : "falha de rede"}`);
  }

  const texto = await resposta.text();
  if (!resposta.ok) {
    // A Meta devolve o motivo em `error.message`, e é ele que diz "template
    // não existe" ou "contagem de parâmetros". O token nunca está na resposta.
    let motivo = `${resposta.status}`;
    try {
      const json = JSON.parse(texto) as { error?: { message?: string; code?: number } };
      if (json.error?.message) motivo = `${json.error.message}${json.error.code ? ` (#${json.error.code})` : ""}`;
    } catch {
      motivo = `${resposta.status}: ${texto.slice(0, 200)}`;
    }
    throw new FalhaDoWhatsapp(`Meta recusou: ${motivo}`);
  }

  try {
    const json = JSON.parse(texto) as { messages?: Array<{ id?: string }> };
    return { messageId: json.messages?.[0]?.id ?? "" };
  } catch {
    return { messageId: "" };
  }
}
