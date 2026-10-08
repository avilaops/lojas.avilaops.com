import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Webhooks para o desenvolvedor: as regras, sem banco e sem rede.
 *
 * O ERP do lojista deixa de perguntar "tem pedido novo?" a cada minuto e passa
 * a ser avisado. A fila e o envio ficam em `webhooks-entrega.ts`; aqui está o
 * que decide **para onde** se pode mandar, **o que** se assina e **quando** se
 * tenta de novo. Ver docs/API.md.
 */

/**
 * Os eventos que saem. Lista fechada e só de pedido: são os fatos que um
 * sistema de fora precisa para faturar, separar e dar baixa. Evento interno
 * (mensalidade, SEO de categoria, alerta de operação) não é contrato com
 * ninguém e não entra aqui por tabela.
 */
export const EVENTOS_DE_WEBHOOK = {
  "pedido.criado": "Pedido registrado, ainda aguardando pagamento ou já aprovado no cartão",
  "pedido.pago": "Pagamento confirmado e estoque baixado",
  "pedido.recusado": "Pagamento recusado; a reserva de estoque foi liberada",
  "pedido.em-separacao": "A loja começou a separar",
  "pedido.enviado": "Pedido despachado, com transportadora e rastreio quando houver",
  "pedido.entregue": "Pedido marcado como entregue",
  "pedido.cancelado": "Pedido cancelado pela loja",
} as const;

export type EventoDeWebhook = keyof typeof EVENTOS_DE_WEBHOOK;

export function ehEventoDeWebhook(tipo: string): tipo is EventoDeWebhook {
  return Object.prototype.hasOwnProperty.call(EVENTOS_DE_WEBHOOK, tipo);
}

/** Os eventos pedidos, sem repetição e só os que existem. Vazio não é assinatura. */
export function eventosValidos(pedidos: readonly unknown[]): EventoDeWebhook[] {
  const validos = new Set(pedidos.filter((e): e is EventoDeWebhook => typeof e === "string" && ehEventoDeWebhook(e)));
  return (Object.keys(EVENTOS_DE_WEBHOOK) as EventoDeWebhook[]).filter((e) => validos.has(e));
}

// ── Para onde se pode mandar ───────────────────────────────────────────

/**
 * O endereço é do lojista, e é a plataforma que faz a requisição: sem estas
 * recusas, cadastrar `https://10.0.0.5/` faria o nosso servidor bater num
 * serviço interno em nome de quem preencheu o campo.
 */
export function enderecoPrivado(ip: string): boolean {
  const v4 = ip.match(/^(?:::ffff:)?(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/i);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (!v6.includes(":")) return true; // não é IP que a gente reconheça: recusa
  return v6 === "::" || v6 === "::1" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || v6.startsWith("ff");
}

const SUFIXOS_INTERNOS = [".local", ".localhost", ".internal", ".lan", ".home", ".intranet", ".corp"];

/**
 * `null` quando o endereço serve; senão, o motivo em uma frase.
 *
 * Só `https`: o corpo leva dados de pedido e de cliente. Sem usuário e senha na
 * URL (iriam parar em log). Sem IP escrito à mão e sem nome interno. O nome que
 * resolve para endereço privado é pego na hora do envio (`webhooks-entrega.ts`),
 * porque DNS muda depois do cadastro.
 */
export function motivoDaRecusa(endereco: string): string | null {
  if (typeof endereco !== "string" || endereco.length > 500) return "Endereço longo demais.";
  let u: URL;
  try {
    u = new URL(endereco);
  } catch {
    return "Endereço inválido.";
  }
  if (u.protocol !== "https:") return "O endereço precisa começar com https://.";
  if (u.username || u.password) return "Não ponha usuário e senha no endereço; a requisição já vai assinada.";
  if (u.hash) return "Endereço com # não é aceito.";
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host.includes(".") && !host.includes(":")) return "O endereço precisa ser um domínio público.";
  if (host === "localhost" || SUFIXOS_INTERNOS.some((s) => host.endsWith(s))) return "O endereço precisa ser um domínio público.";
  if (/^[\d.]+$/.test(host) || host.includes(":")) return "Use um domínio, não um número de IP.";
  return null;
}

// ── O que se assina ────────────────────────────────────────────────────

export function gerarSegredoDeWebhook(): string {
  return `whsec_${randomBytes(24).toString("hex")}`;
}

/**
 * `t=<segundos>,v1=<hmac>`. O HMAC cobre o instante e o corpo exato: quem
 * recebe confere que veio de nós e recusa o que for velho, e assim uma
 * requisição capturada não pode ser reapresentada daqui a um mês.
 */
export function assinar(segredo: string, corpo: string, agoraMs = Date.now()): string {
  const t = Math.floor(agoraMs / 1000);
  return `t=${t},v1=${createHmac("sha256", segredo).update(`${t}.${corpo}`).digest("hex")}`;
}

/** A conferência que o receptor faz; fica aqui para o teste e para a documentação citarem a mesma conta. */
export function conferirAssinatura(segredo: string, corpo: string, cabecalho: string, agoraMs = Date.now(), toleranciaS = 300): boolean {
  const partes = Object.fromEntries(cabecalho.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(partes.t);
  if (!Number.isFinite(t) || !partes.v1 || Math.abs(agoraMs / 1000 - t) > toleranciaS) return false;
  const esperado = createHmac("sha256", segredo).update(`${t}.${corpo}`).digest("hex");
  return esperado.length === partes.v1.length && timingSafeEqual(Buffer.from(esperado), Buffer.from(partes.v1));
}

// ── Quando se tenta de novo ────────────────────────────────────────────

/** Minutos de espera depois da 1ª, 2ª… falha. Somam pouco mais de um dia. */
export const ESPERAS_MIN = [1, 5, 30, 120, 480, 960] as const;
/** A primeira e mais uma por espera. Depois disso a entrega fica FALHOU. */
export const TENTATIVAS_MAXIMAS = ESPERAS_MIN.length + 1;
/** Entregas esgotadas seguidas até o webhook ser desligado, para não martelar endereço morto. */
export const FALHAS_ATE_DESLIGAR = 20;

/** Quando tentar de novo depois da `tentativas`-ésima falha, ou `null` se acabou. */
export function proximaTentativa(tentativas: number, agora: Date): Date | null {
  const espera = ESPERAS_MIN[tentativas - 1];
  return espera === undefined ? null : new Date(agora.getTime() + espera * 60_000);
}

/** 2xx é entregue. Todo o resto, inclusive redirecionamento (que não seguimos), é falha. */
export function entregou(status: number): boolean {
  return status >= 200 && status < 300;
}
