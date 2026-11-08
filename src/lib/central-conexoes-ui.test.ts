import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { secoesDoPainel } from "./navegacao-painel"

test("navegação expõe a Central de Conexões", async () => {
  const secoes = secoesDoPainel({ pixManual: false, configuradorSobMedida: false })
  assert.ok(secoes.some(secao => secao.rotulo === "Conexões" && secao.href === "/painel/conexoes"))
})

test("central apresenta todos os estados e destinos operacionais", async () => {
  const fonte = await readFile(new URL("../components/painel/CentralConexoes.tsx", import.meta.url), "utf8")
  for (const rotulo of ["Saudável", "Atenção", "Erro", "Desconectado", "Indisponível"]) assert.match(fonte, new RegExp(rotulo))
  for (const destino of ["/painel/configuracoes/canais", "/painel/configuracoes/entrega", "/painel/configuracoes/recebimento", "/painel/ia"]) assert.match(fonte, new RegExp(destino))
  assert.match(fonte, /role="status"/)
})

test("ação de teste não é exibida sem permissão", async () => {
  const fonte = await readFile(new URL("../components/painel/CentralConexoes.tsx", import.meta.url), "utf8")
  assert.match(fonte, /testavel && podeTestar/)
})
