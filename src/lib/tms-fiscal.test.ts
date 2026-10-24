import assert from "node:assert/strict";
import test from "node:test";
import { baixarFiscalTms, buscarFiscalTms } from "./tms-fiscal";

const cnpj = "60067738000106";
const env = { TMS_API_URL: "https://tms.example", TMS_APP_URL: "https://painel.example", TMS_FISCAL_BY_CNPJ: JSON.stringify({ [cnpj]: { slug: "transportadora", key: "segredo" } }) };
const documento = { id: "11111111-1111-4111-8111-111111111111", coleta_id: "carga", rastreio: null, ambiente: "PRODUCAO", serie: 1, numero: 2, chave: "3".repeat(44), status: "AUTHORIZED", protocolo: "1", codigo_status: 100, motivo_status: "Autorizado", emitido_em: new Date().toISOString(), autorizado_em: new Date().toISOString(), cancelado_em: null, protocolo_cancelamento: null, observado_em: new Date().toISOString(), arquivos: { xml: "/xml", dacte: "/dacte" }, eventos: [] };

test("consulta CT-e no TMS com contrato versionado e chave fora da URL", async () => {
  let chamada: { url: string; auth: string | null } | null = null;
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    chamada = { url: String(input), auth: new Headers(init?.headers).get("authorization") };
    return Response.json({ versao: "avila.fiscal.cte.v1", documentos: [documento] });
  };
  const resultado = await buscarFiscalTms(cnpj, fetcher as typeof fetch, env);
  assert.equal(resultado?.documentos[0].status, "AUTHORIZED");
  assert.deepEqual(chamada, { url: "https://tms.example/api/integracoes/lojas/v1/empresas/transportadora/documentos-fiscais/cte", auth: "Bearer segredo" });
});

test("download aceita só UUID e não existe sem configuração", async () => {
  assert.equal(await baixarFiscalTms(cnpj, "invalido", "xml", fetch, env), null);
  assert.equal(await buscarFiscalTms(cnpj, fetch, {}), null);
});
