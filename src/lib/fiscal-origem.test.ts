import assert from "node:assert/strict";
import { test } from "node:test";
import { origemFiscalPermitida } from "./fiscal-origem";

const dominio = "lojas.avilaops.com";
function requisicao(origem?: string, headers: Record<string, string> = {}) {
  return new Request("http://0.0.0.0:3080/api/painel/fiscal", {
    method: "POST",
    headers: { ...headers, ...(origem === undefined ? {} : { origin: origem }) },
  });
}

test("aceita o painel HTTPS mesmo com URL interna do container diferente", () => {
  const request = requisicao("https://lojas.avilaops.com");
  assert.notEqual(request.headers.get("origin"), new URL(request.url).origin);
  assert.equal(origemFiscalPermitida(request, dominio, true), true);
  assert.equal(origemFiscalPermitida(request, dominio.toUpperCase(), true), true);
});

test("recusa origem ausente, opaca, HTTP, porta diferente e domínios parecidos", () => {
  for (const origem of [
    undefined, "null", "http://lojas.avilaops.com",
    "https://lojas.avilaops.com:444", "https://lojas.avilaops.com.evil.example",
    "https://evil.example", "https://cliente.lojas.avilaops.com",
    "https://lojas.avilaops.com/", "https://lojas.avilaops.com@evil.example",
  ]) {
    assert.equal(origemFiscalPermitida(requisicao(origem), dominio, true), false, origem);
  }
});

test("Host e forwarded forjados não autorizam um site externo", () => {
  assert.equal(origemFiscalPermitida(requisicao("https://evil.example", {
    host: "evil.example",
    "x-forwarded-host": "evil.example",
    "x-forwarded-proto": "https",
  }), dominio, true), false);
  assert.equal(origemFiscalPermitida(requisicao("http://0.0.0.0:3080"), dominio, true), false);
});

test("HTTP local exige desenvolvimento, domínio de loopback e porta exata", () => {
  const request = new Request("http://localhost:3088/api/painel/fiscal", {
    headers: { origin: "http://localhost:3088" },
  });
  assert.equal(origemFiscalPermitida(request, "localhost", false), true);
  assert.equal(origemFiscalPermitida(request, "localhost", true), false);
  assert.equal(origemFiscalPermitida(request, dominio, false), false);
  const outraPorta = new Request(request.url, { headers: { origin: "http://localhost:3089" } });
  assert.equal(origemFiscalPermitida(outraPorta, "localhost", false), false);
});
