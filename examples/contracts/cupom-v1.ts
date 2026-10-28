/** Consumidor fixado da API v1, independente dos schemas do produtor. */
import { z } from "zod";

export interface ConsultaCupomV1 {
  codigo: string;
  itens: Array<{ id: string; quantidade: number }>;
  cep?: string;
}

const SucessoV1 = z.object({ dados: z.object({
  codigo: z.string(), tipo: z.string(), descontoCentavos: z.number().int().min(0),
  fretes: z.array(z.object({ id: z.string(), nome: z.string(), precoCentavos: z.number().int().min(0), prazoDiasUteis: z.number().int().min(0) })).optional(),
}) });
const ErroV1 = z.object({ erro: z.object({ codigo: z.string(), mensagem: z.string(), detalhe: z.string().optional() }), requisicao: z.string().min(1) });
export type RespostaCupomV1 = z.infer<typeof SucessoV1>["dados"];

export class ErroConsultaCupom extends Error {
  constructor(public status: number, public codigo: string, mensagem: string, public requisicao: string, public detalhe?: string) {
    super(mensagem);
    this.name = "ErroConsultaCupom";
  }
}

/** Também usado para conferir a resposta real do handler na CI com Postgres. */
export function lerRespostaCupomV1(status: number, body: unknown): z.infer<typeof SucessoV1>["dados"] {
  if (status === 200) {
    const parsed = SucessoV1.safeParse(body);
    if (!parsed.success) throw new Error("INVALID_COUPON_RESPONSE");
    return parsed.data.dados;
  }
  if (status < 400 || status > 599) throw new Error("INVALID_COUPON_RESPONSE");
  const parsed = ErroV1.safeParse(body);
  if (!parsed.success) throw new Error("INVALID_COUPON_RESPONSE");
  const { erro, requisicao } = parsed.data;
  throw new ErroConsultaCupom(status, erro.codigo, erro.mensagem, requisicao, erro.detalhe);
}

export async function consultarCupom(baseUrl: string, chave: string, consulta: ConsultaCupomV1, signal?: AbortSignal) {
  const url = new URL("/api/v1/vitrine/cupom", baseUrl);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))) throw new Error("HTTPS_REQUIRED");
  if (url.username || url.password) throw new Error("URL_CREDENTIALS_FORBIDDEN");
  const response = await fetch(url, {
    method: "POST", redirect: "error", signal: signal ?? AbortSignal.timeout(10_000),
    headers: { authorization: `Bearer ${chave}`, "content-type": "application/json" }, body: JSON.stringify(consulta),
  });
  let body: unknown;
  try { body = await response.json(); } catch { throw new Error("INVALID_COUPON_RESPONSE"); }
  return lerRespostaCupomV1(response.status, body);
}
