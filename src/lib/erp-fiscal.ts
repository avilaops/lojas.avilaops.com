type Ambiente = Record<string, string | undefined>;

export type NotaRecebidaErp = {
  id: number; chave: string; numero: number; serie: number; emitida_em: string; valor: number;
  fornecedor: { documento: string; nome: string; vinculado: boolean; id: number | null };
  itens: number; compra_id: number | null;
};

export type PendenciaNfeErp = {
  nsu: string; chave: string; emitida_em: string; valor: number; situacao: string;
  fornecedor: { documento: string; nome: string };
};

export type FiscalErp = { notas: NotaRecebidaErp[]; pendencias: PendenciaNfeErp[]; painelUrl: string };

const CHAVE_NFE = /^[0-9A-Z]{44}$/;

function configuracao(cnpj: string, env: Ambiente): { api: string; painel: string; key: string } | null {
  const api = env.ERP_API_URL?.replace(/\/$/, "") ?? "";
  const painel = env.ERP_APP_URL?.replace(/\/$/, "") || api;
  if (!/^https:\/\//.test(api) && env.NODE_ENV === "production") return null;
  let keys: Record<string, unknown>;
  try { keys = JSON.parse(env.ERP_API_KEYS_BY_CNPJ ?? "{}") as Record<string, unknown>; } catch { return null; }
  const key = keys[cnpj];
  return api && typeof key === "string" && key.trim() ? { api, painel, key: key.trim() } : null;
}

export function fiscalErpConfigurado(cnpj: string, env: Ambiente = process.env): boolean {
  return configuracao(cnpj.replace(/\D/g, ""), env) !== null;
}

function notaValida(nota: unknown): nota is NotaRecebidaErp {
  if (!nota || typeof nota !== "object" || Array.isArray(nota)) return false;
  const n = nota as Record<string, unknown>;
  const fornecedor = n.fornecedor;
  return Number.isInteger(n.id) && typeof n.chave === "string" && CHAVE_NFE.test(n.chave)
    && Number.isInteger(n.numero) && Number.isInteger(n.serie) && typeof n.emitida_em === "string"
    && Number.isFinite(n.valor) && Number.isInteger(n.itens)
    && (n.compra_id === null || Number.isInteger(n.compra_id))
    && !!fornecedor && typeof fornecedor === "object" && !Array.isArray(fornecedor)
    && typeof (fornecedor as Record<string, unknown>).documento === "string"
    && typeof (fornecedor as Record<string, unknown>).nome === "string"
    && typeof (fornecedor as Record<string, unknown>).vinculado === "boolean"
    && ((fornecedor as Record<string, unknown>).id === null || Number.isInteger((fornecedor as Record<string, unknown>).id));
}

function pendenciaValida(pendencia: unknown): pendencia is PendenciaNfeErp {
  if (!pendencia || typeof pendencia !== "object" || Array.isArray(pendencia)) return false;
  const item = pendencia as Record<string, unknown>;
  const fornecedor = item.fornecedor;
  return typeof item.nsu === "string" && /^\d{15}$/.test(item.nsu)
    && typeof item.chave === "string" && CHAVE_NFE.test(item.chave)
    && typeof item.emitida_em === "string" && Number.isFinite(item.valor) && typeof item.situacao === "string"
    && !!fornecedor && typeof fornecedor === "object" && !Array.isArray(fornecedor)
    && typeof (fornecedor as Record<string, unknown>).documento === "string"
    && typeof (fornecedor as Record<string, unknown>).nome === "string";
}

export async function buscarFiscalErp(cnpj: string, fetcher: typeof fetch = fetch, env: Ambiente = process.env): Promise<FiscalErp | null> {
  const config = configuracao(cnpj, env);
  if (!config) return null;
  const response = await fetcher(`${config.api}/api/v1/notas-recebidas`, { headers: { Authorization: `Bearer ${config.key}` }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`ERP respondeu ${response.status} ao consultar NF-e recebidas.`);
  const body = await response.json() as { notas?: unknown; pendencias?: unknown };
  if (!Array.isArray(body.notas) || !body.notas.every(notaValida) || !Array.isArray(body.pendencias) || !body.pendencias.every(pendenciaValida)) throw new Error("ERP devolveu uma lista fiscal inválida.");
  return { notas: body.notas, pendencias: body.pendencias, painelUrl: `${config.painel}/fiscal?ver=recebidas` };
}

export async function baixarFiscalErp(cnpj: string, id: string, formato: "xml" | "danfe", fetcher: typeof fetch = fetch, env: Ambiente = process.env): Promise<Response | null> {
  const config = configuracao(cnpj, env);
  if (!config || !/^[1-9]\d{0,18}$/.test(id)) return null;
  return fetcher(`${config.api}/api/v1/notas-recebidas/${id}/${formato}`, { headers: { Authorization: `Bearer ${config.key}` }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
}
