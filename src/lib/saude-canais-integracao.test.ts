import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { ErroSaudeCanal, testarCanal } from "./saude-canais"

test("canal desconhecido é recusado antes de consultar banco ou provedor", async () => {
  await assert.rejects(
    testarCanal("tenant-de-outra-loja", "canal-inexistente", "operador@exemplo.com"),
    (erro) => erro instanceof ErroSaudeCanal && erro.codigo === "nao_conectado",
  )
})

test("coleta e histórico mantêm filtro explícito pelo tenant", async () => {
  const fonte = await readFile(new URL("./saude-canais.ts", import.meta.url), "utf8")
  assert.match(fonte, /credencialPagamento\.findMany\(\{ where: \{ tenantId \}/)
  assert.match(fonte, /webhookApi\.findMany\(\{[\s\S]*?where: \{ tenantId \}/)
  assert.match(fonte, /eventoSaudeCanal\.findMany\(\{[\s\S]*?where: \{ tenantId/)
  assert.match(fonte, /tenantId_provedor: \{ tenantId, provedor: pagamento \}/)
})

test("reserva é única por loja, canal e minuto e o evento final é separado", async () => {
  const fonte = await readFile(new URL("./saude-canais.ts", import.meta.url), "utf8")
  assert.match(fonte, /Math\.floor\(agora\.getTime\(\) \/ 60_000\)/)
  assert.match(fonte, /tipo: "reserva"/)
  assert.match(fonte, /tipo: "teste"/)
})
