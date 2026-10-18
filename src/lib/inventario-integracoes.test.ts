import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

type Gap = { description?: string; decision?: string; dependency?: string }
type Integration = Record<string, unknown> & { id: string; gaps: Gap[] }

const inventoryPath = join(process.cwd(), "docs/integracoes/lojas-360.v1.json")
const requiredIds = [
  "mercado-livre",
  "amazon",
  "shopee",
  "magalu",
  "mercado-pago",
  "melhor-envio",
  "cepcerto-viacep",
  "erp-nfe-recebida",
  "sefaz-dfe",
  "google",
  "cloudflare",
  "mail-avilaops",
  "auth-avilaops",
  "n8n-lojas-operacao",
  "n8n-mcp-avilaops",
]

test("inventário omnicanal mantém contrato, cobertura e lacunas rastreáveis", () => {
  const raw = readFileSync(inventoryPath, "utf8")
  const inventory = JSON.parse(raw) as Record<string, unknown> & {
    integrations: Integration[]
  }

  assert.equal(inventory.schemaVersion, 1)
  assert.match(String(inventory.version), /^1\.\d+\.\d+$/)
  assert.match(String(inventory.observedAt), /^\d{4}-\d{2}-\d{2}$/)
  assert.ok(Array.isArray(inventory.integrations))

  const ids = inventory.integrations.map(({ id }) => id)
  assert.equal(new Set(ids).size, ids.length, "IDs de integração devem ser únicos")
  for (const id of requiredIds) assert.ok(ids.includes(id), `integração ausente: ${id}`)

  const requiredFields = [
    "name",
    "channel",
    "status",
    "environment",
    "evidence",
    "authentication",
    "scopes",
    "capabilities",
    "webhooks",
    "pagination",
    "rateLimit",
    "retention",
    "homologation",
    "dependencies",
    "gaps",
  ]
  const statuses = new Set(["operational", "partial", "connection-only", "inactive", "blocked"])

  for (const integration of inventory.integrations) {
    for (const field of requiredFields) {
      assert.ok(field in integration, `${integration.id}: campo obrigatório ausente: ${field}`)
    }
    assert.ok(statuses.has(String(integration.status)), `${integration.id}: status inválido`)
    const capabilities = integration.capabilities as Record<string, unknown>
    const evidence = integration.evidence as string[]
    assert.ok(Array.isArray(evidence) && evidence.length > 0, `${integration.id}: evidência ausente`)
    for (const source of evidence.filter((item) => /^(src|docs|packages|\.agents)/.test(item))) {
      assert.ok(existsSync(join(process.cwd(), source)), `${integration.id}: evidência inexistente: ${source}`)
    }
    assert.ok(Array.isArray(capabilities.queries), `${integration.id}: consultas ausentes`)
    assert.ok(Array.isArray(capabilities.actions), `${integration.id}: ações ausentes`)
    assert.ok(Array.isArray(integration.gaps), `${integration.id}: lacunas inválidas`)
    for (const gap of integration.gaps) {
      assert.ok(gap.description, `${integration.id}: lacuna sem descrição`)
      assert.ok(gap.decision || gap.dependency, `${integration.id}: lacuna sem decisão ou dependência`)
    }
  }

  const forbiddenKeys = /(^|_)(secret|token|password|privateKey|clientSecret|apiKey)$/i
  const visit = (value: unknown, path = "root") => {
    if (Array.isArray(value)) return value.forEach((item, index) => visit(item, `${path}[${index}]`))
    if (!value || typeof value !== "object") return
    for (const [key, child] of Object.entries(value)) {
      assert.doesNotMatch(key, forbiddenKeys, `campo sensível proibido em ${path}.${key}`)
      visit(child, `${path}.${key}`)
    }
  }
  visit(inventory)

  const lojas = inventory.integrations.find(({ id }) => id === "n8n-lojas-operacao")
  const mcp = inventory.integrations.find(({ id }) => id === "n8n-mcp-avilaops")
  assert.equal(lojas?.workflowId, "p063yYJXt0dT6lK6")
  assert.equal(lojas?.workflowActive, true)
  assert.equal(mcp?.workflowId, "IwWSp6RA3SJ5eyhZ")
  assert.equal(mcp?.workflowActive, true)
})
