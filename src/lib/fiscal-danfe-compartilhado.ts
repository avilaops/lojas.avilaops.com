/** A geração de DANFE ocorre no serviço fiscal comum, nunca no navegador. */
export async function gerarDanfeCompartilhado(xml: string, fetcher: typeof fetch = fetch, env: NodeJS.ProcessEnv = process.env): Promise<Uint8Array | null> {
  const url = env.FISCAL_SHARED_API_URL?.replace(/\/$/, "");
  const chave = env.FISCAL_SHARED_SERVICE_KEY;
  if (!url || !chave) return null;
  if (!/^https:\/\//.test(url) && env.NODE_ENV === "production") return null;
  const resposta = await fetcher(`${url}/v1/documentos/nfe/danfe.pdf`, {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(25_000),
    headers: { "Content-Type": "application/json", "X-Fiscal-Service-Key": chave },
    body: JSON.stringify({ xml }),
  });
  if (!resposta.ok) throw new Error(`Serviço fiscal indisponível (${resposta.status}).`);
  const tamanho = Number(resposta.headers.get("content-length"));
  if (tamanho > 12 * 1024 * 1024) throw new Error("PDF excede o limite.");
  const bytes = new Uint8Array(await resposta.arrayBuffer());
  if (!bytes.length || bytes.length > 12 * 1024 * 1024 || new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new Error("PDF inválido.");
  return bytes;
}
