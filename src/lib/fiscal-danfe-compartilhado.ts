import { lerRespostaArquivoFiscal } from "./fiscal-conteudo";

/** A geração de DANFE ocorre no serviço fiscal comum, nunca no navegador. */
export async function gerarDanfeCompartilhado(xml: string, fetcher: typeof fetch = fetch, env: NodeJS.ProcessEnv = process.env): Promise<Uint8Array | null> {
  const url = env.FISCAL_SHARED_API_URL?.replace(/\/$/, "");
  const chave = env.FISCAL_SHARED_SERVICE_KEY;
  if (!url || !chave) return null;
  if (!/^https:\/\//.test(url) && env.NODE_ENV === "production" && url !== "http://fiscal-avilaops-com-web:8000") return null;
  const resposta = await fetcher(`${url}/v1/documentos/nfe/danfe.pdf`, {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(25_000),
    headers: { "Content-Type": "application/json", "X-Fiscal-Service-Key": chave },
    body: JSON.stringify({ xml }),
  });
  if (!resposta.ok) throw new Error(`Serviço fiscal indisponível (${resposta.status}).`);
  return lerRespostaArquivoFiscal(resposta, "pdf");
}
