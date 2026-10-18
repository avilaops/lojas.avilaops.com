import assert from "node:assert/strict"
import test from "node:test"
import {
  ErroSaudeCanal,
  avaliarSaudeCanal,
  mensagemSegura,
  type EntradaSaudeCanal,
} from "./saude-canais"

const AGORA = new Date("2026-10-18T18:00:00.000Z")

function entrada(patch: Partial<EntradaSaudeCanal> = {}): EntradaSaudeCanal {
  return {
    id: "mercadolivre",
    nome: "Mercado Livre",
    disponivel: true,
    conectado: true,
    capacidade: "operacional",
    conta: "Loja teste",
    autenticacao: "OAuth",
    escopos: ["Anúncios", "Pedidos"],
    conectadoEm: new Date("2026-10-17T12:00:00.000Z"),
    expiraEm: new Date("2026-10-19T12:00:00.000Z"),
    refreshExpiraEm: null,
    ultimaAtividadeEm: new Date("2026-10-18T17:20:00.000Z"),
    cadenciaEsperadaMs: 60 * 60 * 1000,
    possuiCargaOperacional: true,
    rotina: { ultimaEm: new Date("2026-10-18T17:20:00.000Z"), falhasSeguidas: 0, ultimoErro: null },
    webhooks: [],
    ...patch,
  }
}

test("erro prevalece sobre atraso, token próximo do vencimento e atividade saudável", () => {
  const retrato = avaliarSaudeCanal(entrada({
    expiraEm: new Date("2026-10-18T18:03:00.000Z"),
    ultimaAtividadeEm: new Date("2026-10-18T14:00:00.000Z"),
    erro: { codigo: "credencial_incompleta", mensagem: "A conexão está incompleta." },
  }), AGORA)

  assert.equal(retrato.estado, "erro")
  assert.equal(retrato.alertas[0]?.codigo, "credencial_incompleta")
})

test("token perto de vencer e atividade além de duas cadências pedem atenção", () => {
  const retrato = avaliarSaudeCanal(entrada({
    expiraEm: new Date("2026-10-18T18:04:00.000Z"),
    ultimaAtividadeEm: new Date("2026-10-18T15:59:59.000Z"),
  }), AGORA)

  assert.equal(retrato.estado, "atencao")
  assert.deepEqual(retrato.alertas.map((alerta) => alerta.codigo), ["acesso_expirando", "sincronizacao_atrasada"])
  assert.equal(retrato.atrasoMs, 7_201_000)
})

test("canal somente conexão não inventa atraso nem operação completa", () => {
  const retrato = avaliarSaudeCanal(entrada({
    id: "amazon",
    nome: "Amazon",
    capacidade: "somente_conexao",
    ultimaAtividadeEm: null,
    cadenciaEsperadaMs: null,
    possuiCargaOperacional: false,
  }), AGORA)

  assert.equal(retrato.estado, "saudavel")
  assert.equal(retrato.atrasoMs, null)
  assert.equal(retrato.limitacao, "Somente conexão; catálogo e pedidos ainda não operam por aqui.")
})

test("loja sem carga operacional não fica atrasada por nunca ter sincronizado", () => {
  const retrato = avaliarSaudeCanal(entrada({ ultimaAtividadeEm: null, possuiCargaOperacional: false }), AGORA)
  assert.equal(retrato.estado, "saudavel")
  assert.equal(retrato.atrasoMs, null)
})

test("refresh vencido é erro mesmo que o access token ainda tenha data futura", () => {
  const retrato = avaliarSaudeCanal(entrada({
    expiraEm: new Date("2026-10-20T00:00:00.000Z"),
    refreshExpiraEm: new Date("2026-10-18T17:59:59.000Z"),
  }), AGORA)
  assert.equal(retrato.estado, "erro")
  assert.equal(retrato.alertas[0]?.codigo, "reconexao_necessaria")
})

test("múltiplos webhooks agregam o pior estado e contam fila e falhas", () => {
  const retrato = avaliarSaudeCanal(entrada({
    id: "webhooks-api",
    nome: "Webhooks da API",
    webhooks: [
      { ativo: true, falhasSeguidas: 0, pendentes: 2, falhasEsgotadas: 0, pendenteMaisAntigoEm: new Date("2026-10-18T17:50:00.000Z"), ultimaEntregaEm: null },
      { ativo: false, falhasSeguidas: 5, pendentes: 0, falhasEsgotadas: 1, pendenteMaisAntigoEm: null, ultimaEntregaEm: new Date("2026-10-18T17:00:00.000Z") },
    ],
  }), AGORA)

  assert.equal(retrato.estado, "erro")
  assert.equal(retrato.webhooks.total, 2)
  assert.equal(retrato.webhooks.desligados, 1)
  assert.equal(retrato.webhooks.pendentes, 2)
  assert.equal(retrato.webhooks.falhasEsgotadas, 1)
  assert.ok(retrato.alertas.some((alerta) => alerta.codigo === "webhook_desligado"))
})

test("desconectado e indisponível dependem da configuração do aplicativo", () => {
  assert.equal(avaliarSaudeCanal(entrada({ conectado: false, disponivel: true }), AGORA).estado, "desconectado")
  assert.equal(avaliarSaudeCanal(entrada({ conectado: false, disponivel: false }), AGORA).estado, "indisponivel")
})

test("conta conectada com aplicativo removido vira erro operacional", () => {
  const retrato = avaliarSaudeCanal(entrada({ conectado: true, disponivel: false }), AGORA)
  assert.equal(retrato.estado, "erro")
  assert.equal(retrato.alertas[0]?.codigo, "aplicativo_indisponivel")
})

test("sanitização só devolve códigos conhecidos e ignora segredo em erro, cause, URL e JSON", () => {
  assert.deepEqual(
    mensagemSegura(new ErroSaudeCanal("tempo_esgotado")),
    { codigo: "tempo_esgotado", mensagem: "O provedor não respondeu a tempo. Tente novamente." },
  )

  const bruto = new Error("token sk_live_segredo em https://x.test/?access_token=segredo")
  bruto.cause = { password: "senha", body: JSON.stringify({ client_secret: "segredo" }) }
  const seguro = mensagemSegura(bruto)
  assert.deepEqual(seguro, { codigo: "falha_externa", mensagem: "O provedor recusou ou não concluiu o teste. Tente novamente." })
  assert.doesNotMatch(JSON.stringify(seguro), /segredo|senha|access_token|client_secret/)
})
