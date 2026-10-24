type Ambiente = Record<string, string | undefined>;

export type CteTms = {
  id: string; coleta_id: string; rastreio: string | null; ambiente: "HOMOLOGACAO" | "PRODUCAO";
  serie: number; numero: number; chave: string; status: string; protocolo: string | null;
  codigo_status: number | null; motivo_status: string | null; emitido_em: string;
  autorizado_em: string | null; cancelado_em: string | null; protocolo_cancelamento: string | null;
  observado_em: string; arquivos: { xml: string | null; dacte: string | null };
  eventos: Array<{ id: string; tipo: string; sequencia: number; protocolo: string | null; codigo_status: number; motivo_status: string; registrado_em: string; cancelado_em: string | null }>;
};

export type FiscalTms = { documentos: CteTms[]; painelUrl: string; slug: string };

function configuracao(cnpj: string, env: Ambiente) {
  const api = env.TMS_API_URL?.replace(/\/$/, "") ?? "";
  const painel = env.TMS_APP_URL?.replace(/\/$/, "") || api;
  if (!/^https:\/\//.test(api) && env.NODE_ENV === "production") return null;
  let empresas: Record<string, unknown>;
  try { empresas = JSON.parse(env.TMS_FISCAL_BY_CNPJ ?? "{}") as Record<string, unknown>; } catch { return null; }
  const item = empresas[cnpj];
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const slug = (item as Record<string, unknown>).slug;
  const key = (item as Record<string, unknown>).key;
  return api && typeof slug === "string" && /^[a-z0-9][a-z0-9-]{1,62}$/.test(slug) && typeof key === "string" && key.trim()
    ? { api, painel, slug, key: key.trim() } : null;
}

function cteValido(valor: unknown): valor is CteTms {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return false;
  const cte = valor as Record<string, unknown>;
  const arquivos = cte.arquivos;
  return typeof cte.id === "string" && typeof cte.coleta_id === "string" && typeof cte.chave === "string" && /^\d{44}$/.test(cte.chave)
    && Number.isInteger(cte.serie) && Number.isInteger(cte.numero) && typeof cte.status === "string" && typeof cte.emitido_em === "string"
    && !!arquivos && typeof arquivos === "object" && !Array.isArray(arquivos) && Array.isArray(cte.eventos);
}

export async function buscarFiscalTms(cnpj: string, fetcher: typeof fetch = fetch, env: Ambiente = process.env): Promise<FiscalTms | null> {
  const config = configuracao(cnpj.replace(/\D/g, ""), env);
  if (!config) return null;
  const url = `${config.api}/api/integracoes/lojas/v1/empresas/${encodeURIComponent(config.slug)}/documentos-fiscais/cte`;
  const response = await fetcher(url, { headers: { Authorization: `Bearer ${config.key}` }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`TMS respondeu ${response.status} ao consultar CT-e.`);
  const body = await response.json() as { versao?: unknown; documentos?: unknown };
  if (body.versao !== "avila.fiscal.cte.v1" || !Array.isArray(body.documentos) || !body.documentos.every(cteValido)) throw new Error("TMS devolveu uma lista fiscal inválida.");
  return { documentos: body.documentos, painelUrl: `${config.painel}/dashboard/fiscal/cte`, slug: config.slug };
}

export async function baixarFiscalTms(cnpj: string, id: string, formato: "xml" | "dacte", fetcher: typeof fetch = fetch, env: Ambiente = process.env): Promise<Response | null> {
  const config = configuracao(cnpj.replace(/\D/g, ""), env);
  if (!config || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const url = `${config.api}/api/integracoes/lojas/v1/empresas/${encodeURIComponent(config.slug)}/documentos-fiscais/cte/${id}/${formato}`;
  return fetcher(url, { headers: { Authorization: `Bearer ${config.key}` }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
}
