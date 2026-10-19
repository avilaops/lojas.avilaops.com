export type EstadoSaudeCanal = "saudavel" | "atencao" | "erro" | "desconectado" | "indisponivel"
export type CapacidadeCanal = "operacional" | "parcial" | "somente_conexao"

export type AlertaSaudeCanal = {
  codigo: string
  mensagem: string
}

export type SaudeWebhookEntrada = {
  ativo: boolean
  falhasSeguidas: number
  pendentes: number
  falhasEsgotadas: number
  pendenteMaisAntigoEm: Date | null
  ultimaEntregaEm: Date | null
}

export type EntradaSaudeCanal = {
  id: string
  nome: string
  disponivel: boolean
  conectado: boolean
  capacidade: CapacidadeCanal
  conta: string | null
  autenticacao: string
  escopos: string[]
  conectadoEm: Date | null
  expiraEm: Date | null
  refreshExpiraEm: Date | null
  ultimaAtividadeEm: Date | null
  cadenciaEsperadaMs: number | null
  possuiCargaOperacional: boolean
  rotina?: { ultimaEm: Date | null; falhasSeguidas: number; ultimoErro: string | null } | null
  erro?: AlertaSaudeCanal | null
  webhooks: SaudeWebhookEntrada[]
}

export type RetratoSaudeCanal = Omit<EntradaSaudeCanal, "rotina" | "erro" | "webhooks"> & {
  estado: EstadoSaudeCanal
  atrasoMs: number | null
  limitacao: string | null
  alertas: AlertaSaudeCanal[]
  webhooks: {
    total: number
    ativos: number
    desligados: number
    pendentes: number
    falhasEsgotadas: number
    ultimaEntregaEm: Date | null
  }
}

const MARGEM_RENOVACAO_MS = 5 * 60 * 1000
const ATRASO_WEBHOOK_MS = 5 * 60 * 1000

function maisRecente(datas: Array<Date | null>): Date | null {
  return datas.reduce<Date | null>((maior, data) => (!data || (maior && maior >= data) ? maior : data), null)
}

export function avaliarSaudeCanal(entrada: EntradaSaudeCanal, agora = new Date()): RetratoSaudeCanal {
  const webhooks = {
    total: entrada.webhooks.length,
    ativos: entrada.webhooks.filter((webhook) => webhook.ativo).length,
    desligados: entrada.webhooks.filter((webhook) => !webhook.ativo).length,
    pendentes: entrada.webhooks.reduce((total, webhook) => total + webhook.pendentes, 0),
    falhasEsgotadas: entrada.webhooks.reduce((total, webhook) => total + webhook.falhasEsgotadas, 0),
    ultimaEntregaEm: maisRecente(entrada.webhooks.map((webhook) => webhook.ultimaEntregaEm)),
  }
  const base = {
    id: entrada.id,
    nome: entrada.nome,
    disponivel: entrada.disponivel,
    conectado: entrada.conectado,
    capacidade: entrada.capacidade,
    conta: entrada.conta,
    autenticacao: entrada.autenticacao,
    escopos: entrada.escopos,
    conectadoEm: entrada.conectadoEm,
    expiraEm: entrada.expiraEm,
    refreshExpiraEm: entrada.refreshExpiraEm,
    ultimaAtividadeEm: entrada.ultimaAtividadeEm,
    cadenciaEsperadaMs: entrada.cadenciaEsperadaMs,
    possuiCargaOperacional: entrada.possuiCargaOperacional,
    webhooks,
  }

  if (!entrada.conectado) {
    return {
      ...base,
      estado: entrada.disponivel ? "desconectado" : "indisponivel",
      atrasoMs: null,
      limitacao: entrada.capacidade === "somente_conexao" ? "Somente conexão; catálogo e pedidos ainda não operam por aqui." : null,
      alertas: [],
    }
  }

  const erros: AlertaSaudeCanal[] = []
  const atencoes: AlertaSaudeCanal[] = []
  if (!entrada.disponivel) {
    erros.push({ codigo: "aplicativo_indisponivel", mensagem: "O aplicativo deste canal não está configurado na plataforma." })
  }
  if (entrada.erro) erros.push(entrada.erro)
  if (entrada.refreshExpiraEm && entrada.refreshExpiraEm <= agora) {
    erros.push({ codigo: "reconexao_necessaria", mensagem: "A autorização venceu. Reconecte a conta para continuar." })
  }
  if (webhooks.desligados > 0 || webhooks.falhasEsgotadas > 0) {
    erros.push({ codigo: "webhook_desligado", mensagem: "Há webhook desligado ou entrega esgotada. Abra Webhooks para corrigir." })
  }

  if (entrada.expiraEm && entrada.expiraEm.getTime() - agora.getTime() <= MARGEM_RENOVACAO_MS) {
    atencoes.push({ codigo: "acesso_expirando", mensagem: "O acesso precisa ser renovado em breve." })
  }
  const atrasoMs = entrada.capacidade !== "somente_conexao" && entrada.possuiCargaOperacional && entrada.ultimaAtividadeEm
    ? Math.max(0, agora.getTime() - entrada.ultimaAtividadeEm.getTime())
    : null
  if (atrasoMs !== null && entrada.cadenciaEsperadaMs !== null && atrasoMs > entrada.cadenciaEsperadaMs * 2) {
    atencoes.push({ codigo: "sincronizacao_atrasada", mensagem: "A última atividade passou de duas janelas esperadas." })
  }
  if (entrada.capacidade !== "somente_conexao" && entrada.possuiCargaOperacional && !entrada.ultimaAtividadeEm) {
    atencoes.push({ codigo: "sincronizacao_ausente", mensagem: "Ainda não há sincronização confirmada para a carga existente." })
  }
  if (entrada.rotina && (entrada.rotina.falhasSeguidas > 0 || entrada.rotina.ultimoErro)) {
    atencoes.push({ codigo: "rotina_falhando", mensagem: "A rotina relacionada falhou e será tentada novamente." })
  }
  const webhookAtrasado = entrada.webhooks.some((webhook) =>
    webhook.ativo && webhook.pendenteMaisAntigoEm && agora.getTime() - webhook.pendenteMaisAntigoEm.getTime() > ATRASO_WEBHOOK_MS,
  )
  if (webhookAtrasado) atencoes.push({ codigo: "webhook_atrasado", mensagem: "Há entrega de webhook esperando há mais de cinco minutos." })

  const alertas = [...erros, ...atencoes]
  return {
    ...base,
    estado: erros.length ? "erro" : atencoes.length ? "atencao" : "saudavel",
    atrasoMs,
    limitacao: entrada.capacidade === "somente_conexao" ? "Somente conexão; catálogo e pedidos ainda não operam por aqui." : null,
    alertas,
  }
}

const MENSAGENS_SEGURAS = {
  tempo_esgotado: "O provedor não respondeu a tempo. Tente novamente.",
  credencial_incompleta: "A conexão está incompleta. Reconecte a conta.",
  reconexao_necessaria: "A autorização venceu. Reconecte a conta para continuar.",
  nao_conectado: "A conta não está conectada.",
  limite_temporario: "A conexão já foi testada no último minuto. Aguarde para testar novamente.",
  falha_externa: "O provedor recusou ou não concluiu o teste. Tente novamente.",
  conexao_confirmada: "Conexão confirmada.",
} as const

export type CodigoSeguroSaude = keyof typeof MENSAGENS_SEGURAS

export class ErroSaudeCanal extends Error {
  constructor(readonly codigo: CodigoSeguroSaude) {
    super(MENSAGENS_SEGURAS[codigo])
    this.name = "ErroSaudeCanal"
  }
}

export function mensagemSegura(erro: unknown): { codigo: CodigoSeguroSaude; mensagem: string } {
  const codigo: CodigoSeguroSaude = erro instanceof ErroSaudeCanal && erro.codigo in MENSAGENS_SEGURAS
    ? erro.codigo
    : erro instanceof DOMException && erro.name === "TimeoutError"
      ? "tempo_esgotado"
      : "falha_externa"
  return { codigo, mensagem: MENSAGENS_SEGURAS[codigo] }
}

export type EventoSaudeParaTela = {
  id: string
  canal: string
  tipo: string
  resultado: string
  codigo: string
  mensagem: string
  ator: string
  ocorridoEm: Date
}

type ResultadoTesteAnterior = Pick<EventoSaudeParaTela, "canal" | "resultado" | "codigo" | "mensagem" | "ocorridoEm"> | undefined

export function erroDoTesteMaisRecente(evento: ResultadoTesteAnterior, fallback: AlertaSaudeCanal | null = null): AlertaSaudeCanal | null {
  if (!evento) return fallback
  return evento.resultado === "erro" ? { codigo: evento.codigo, mensagem: evento.mensagem } : null
}

export function ehConflitoDeReserva(erro: unknown): boolean {
  if (!erro || typeof erro !== "object" || !("code" in erro) || (erro as { code?: unknown }).code !== "P2002") return false
  const target = (erro as { meta?: { target?: unknown } }).meta?.target
  return target === "EventoSaudeCanal_dedupeKey_key"
    || target === "dedupeKey"
    || (Array.isArray(target) && target.length === 1 && target[0] === "dedupeKey")
}

export type CentralSaudeCanais = {
  canais: RetratoSaudeCanal[]
  historico: EventoSaudeParaTela[]
  atualizadoEm: Date
}

const DUAS_HORAS = 2 * 60 * 60 * 1000
const UM_DIA = 24 * 60 * 60 * 1000

/** Leitura operacional: agrega somente o banco local e nunca chama provedores. */
export async function saudeDosCanais(tenantId: string, agora = new Date()): Promise<CentralSaudeCanais> {
  const { prisma } = await import("./db")
  const { provedorDo } = await import("./contas-canal")
  const { aplicativoConfigurado: melhorEnvioConfigurado } = await import("./melhor-envio-conta")
  const { provedoresDePagamento } = await import("./provedores-pagamento")
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) return { canais: [], historico: [], atualizadoEm: agora }

  const [contas, credenciais, anuncios, webhooks, entregasAgregadas, rotinas, historico, ultimosTestes] = await Promise.all([
    prisma.contaCanal.findMany({ where: { tenantId } }),
    prisma.credencialPagamento.findMany({ where: { tenantId }, orderBy: { provedor: "asc" } }),
    prisma.anuncioMercadoLivre.findMany({
      where: { tenantId, estado: { in: ["publicado", "pausado"] } },
      select: { sincronizadoEm: true },
    }),
    prisma.webhookApi.findMany({ where: { tenantId } }),
    prisma.entregaWebhook.groupBy({
      where: { tenantId }, by: ["webhookId", "status"],
      _count: { _all: true }, _min: { criadaEm: true },
    }),
    prisma.rotina.findMany({ where: { nome: { in: ["mercadolivre.rodar", "mercadopago.renovar", "webhooks.entregar"] } } }),
    prisma.eventoSaudeCanal.findMany({
      where: { tenantId, tipo: { not: "reserva" } },
      orderBy: { ocorridoEm: "desc" },
      take: 50,
      select: { id: true, canal: true, tipo: true, resultado: true, codigo: true, mensagem: true, ator: true, ocorridoEm: true },
    }),
    prisma.eventoSaudeCanal.findMany({
      where: { tenantId, tipo: "teste" },
      orderBy: { ocorridoEm: "desc" },
      distinct: ["canal"],
      select: { canal: true, resultado: true, codigo: true, mensagem: true, ocorridoEm: true },
    }),
  ])
  const erroTestado = (canal: string, conectadoEm: Date | null, fallback: AlertaSaudeCanal | null = null) => {
    const evento = ultimosTestes.find((item) => item.canal === canal && (!conectadoEm || item.ocorridoEm >= conectadoEm));
    return erroDoTesteMaisRecente(evento, fallback);
  }
  const rotina = (nome: string) => {
    const item = rotinas.find((r) => r.nome === nome)
    return item ? { ultimaEm: item.ultimaEm, falhasSeguidas: item.falhasSeguidas, ultimoErro: item.ultimoErro } : null
  }
  const ultimaMl = anuncios.reduce<Date | null>((d, a) => (!a.sincronizadoEm || (d && d >= a.sincronizadoEm) ? d : a.sincronizadoEm), null)
  const porCanal = new Map(contas.map((conta) => [conta.canal, conta]))
  const entradas: EntradaSaudeCanal[] = [
    {
      id: "mercadolivre", nome: "Mercado Livre", disponivel: Boolean(process.env.ML_APP_ID && process.env.ML_APP_SECRET),
      conectado: Boolean(tenant.mlAccessTokenEnc && tenant.mlRefreshTokenEnc), capacidade: "operacional",
      conta: tenant.mlNickname ?? tenant.mlUserId, autenticacao: "OAuth 2.0", escopos: ["vendas", "anúncios", "perguntas"],
      conectadoEm: tenant.mlConectadoEm, expiraEm: tenant.mlExpiraEm, refreshExpiraEm: null,
      ultimaAtividadeEm: ultimaMl, cadenciaEsperadaMs: DUAS_HORAS, possuiCargaOperacional: anuncios.length > 0,
      rotina: rotina("mercadolivre.rodar"), erro: erroTestado("mercadolivre", tenant.mlConectadoEm), webhooks: [],
    },
    ...(["amazon", "shopee", "magalu"] as const).map((id): EntradaSaudeCanal => {
      const conta = porCanal.get(id)
      const nomes = { amazon: "Amazon", shopee: "Shopee", magalu: "Magalu" }
      return {
        id, nome: nomes[id], disponivel: provedorDo(id)?.configurado() ?? false, conectado: Boolean(conta), capacidade: "somente_conexao",
        conta: conta?.contaNome ?? conta?.contaId ?? null, autenticacao: "OAuth", escopos: ["conexão da conta"],
        conectadoEm: conta?.conectadoEm ?? null, expiraEm: conta?.expiraEm ?? null,
        refreshExpiraEm: conta?.refreshExpiraEm ?? null, ultimaAtividadeEm: null, cadenciaEsperadaMs: null,
        possuiCargaOperacional: false, erro: erroTestado(id, conta?.conectadoEm ?? null), webhooks: [],
      }
    }),
    {
      id: "melhor-envio", nome: "Melhor Envio", disponivel: melhorEnvioConfigurado(),
      conectado: Boolean(tenant.melhorEnvioAccessTokenEnc && tenant.melhorEnvioRefreshTokenEnc), capacidade: "operacional",
      conta: tenant.melhorEnvioConta, autenticacao: "OAuth 2.0", escopos: ["cálculo de frete", "leitura da conta"],
      conectadoEm: tenant.melhorEnvioConectadoEm, expiraEm: tenant.melhorEnvioExpiraEm, refreshExpiraEm: null,
      ultimaAtividadeEm: null, cadenciaEsperadaMs: UM_DIA, possuiCargaOperacional: false,
      erro: erroTestado("melhor-envio", tenant.melhorEnvioConectadoEm), webhooks: [],
    },
    ...credenciais.map((c): EntradaSaudeCanal => ({
      id: `pagamento:${c.provedor}`, nome: `Pagamento · ${c.provedor}`, disponivel: provedoresDePagamento.tem(c.provedor),
      conectado: c.status !== "pendente", capacidade: "operacional", conta: c.conta,
      autenticacao: c.tipoConexao, escopos: ["recebimentos"], conectadoEm: c.criadoEm,
      expiraEm: c.provedor === "mercadopago" ? tenant.mpExpiraEm : null, refreshExpiraEm: null,
      ultimaAtividadeEm: c.testadoEm, cadenciaEsperadaMs: null, possuiCargaOperacional: false,
      rotina: c.provedor === "mercadopago" ? rotina("mercadopago.renovar") : null,
      erro: erroTestado(`pagamento:${c.provedor}`, c.criadoEm, c.status === "erro" ? { codigo: "falha_externa", mensagem: "A credencial precisa ser testada novamente." } : null),
      webhooks: [],
    })),
    {
      id: "webhooks-api", nome: "Webhooks da API", disponivel: true, conectado: webhooks.length > 0,
      capacidade: "operacional", conta: webhooks.length ? `${webhooks.length} destino(s)` : null,
      autenticacao: "HMAC SHA-256", escopos: ["eventos selecionados"], conectadoEm: webhooks[0]?.criadoEm ?? null,
      expiraEm: null, refreshExpiraEm: null,
      ultimaAtividadeEm: webhooks.reduce<Date | null>((d, w) => (!w.ultimaEntregaEm || (d && d >= w.ultimaEntregaEm) ? d : w.ultimaEntregaEm), null),
      cadenciaEsperadaMs: null, possuiCargaOperacional: false, rotina: rotina("webhooks.entregar"),
      webhooks: webhooks.map((w) => {
        const destaFila = entregasAgregadas.filter((e) => e.webhookId === w.id)
        const pendentes = destaFila.filter((e) => e.status === "PENDENTE" || e.status === "ENVIANDO")
        return {
          ativo: w.ativo, falhasSeguidas: w.falhasSeguidas, pendentes: pendentes.reduce((n, e) => n + e._count._all, 0),
          falhasEsgotadas: destaFila.filter((e) => e.status === "FALHOU").reduce((n, e) => n + e._count._all, 0),
          pendenteMaisAntigoEm: pendentes.reduce<Date | null>((d, e) => !e._min.criadaEm || (d && d <= e._min.criadaEm) ? d : e._min.criadaEm, null),
          ultimaEntregaEm: w.ultimaEntregaEm,
        }
      }),
    },
  ]
  return { canais: entradas.map((entrada) => avaliarSaudeCanal(entrada, agora)), historico, atualizadoEm: agora }
}

const CANAIS_TESTAVEIS = new Set(["mercadolivre", "amazon", "shopee", "magalu", "melhor-envio"])

/** Reserva imutável por minuto impede duplo clique e concorrência entre processos. */
export async function testarCanal(tenantId: string, canal: string, ator: string, agora = new Date()) {
  const pagamento = canal.startsWith("pagamento:") ? canal.slice("pagamento:".length) : null
  if (!CANAIS_TESTAVEIS.has(canal) && !pagamento) throw new ErroSaudeCanal("nao_conectado")
  const { prisma } = await import("./db")
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) throw new ErroSaudeCanal("nao_conectado")
  const credencial = pagamento
    ? await prisma.credencialPagamento.findUnique({ where: { tenantId_provedor: { tenantId, provedor: pagamento } } })
    : null
  if (pagamento && !credencial) throw new ErroSaudeCanal("nao_conectado")
  const dedupeKey = `${tenantId}:${canal}:${Math.floor(agora.getTime() / 60_000)}`
  try {
    await prisma.eventoSaudeCanal.create({ data: { tenantId, canal, tipo: "reserva", resultado: "iniciado", codigo: "teste_iniciado", mensagem: "Teste iniciado.", ator: ator.slice(0, 160), dedupeKey } })
  } catch (erro) {
    if (ehConflitoDeReserva(erro)) throw new ErroSaudeCanal("limite_temporario")
    throw erro
  }

  let resultado: { codigo: CodigoSeguroSaude; mensagem: string } = { codigo: "falha_externa", mensagem: MENSAGENS_SEGURAS.falha_externa }
  try {
    const teste = async () => {
      if (canal === "mercadolivre") {
        const { chamarMl } = await import("./mercadolivre")
        await chamarMl(tenant, "/users/me")
      } else if (canal === "melhor-envio") {
        const { testarConexaoMelhorEnvio } = await import("./melhor-envio-conta")
        await testarConexaoMelhorEnvio(tenant)
      } else if (CANAIS_TESTAVEIS.has(canal)) {
        const { tokenDoCanal } = await import("./contas-canal")
        await tokenDoCanal(tenantId, canal as "amazon" | "shopee" | "magalu")
      } else if (credencial) {
        const { contextoDaCredencial } = await import("./credenciais")
        const { provedoresDePagamento } = await import("./provedores-pagamento")
        if (!provedoresDePagamento.tem(credencial.provedor)) throw new ErroSaudeCanal("credencial_incompleta")
        const resposta = await provedoresDePagamento.obter(credencial.provedor).testarConexao(contextoDaCredencial(tenant, credencial))
        if (!resposta.ok) throw new ErroSaudeCanal("falha_externa")
      }
    }
    // Cada cliente aplica AbortSignal.timeout na própria chamada. Assim não
    // respondemos timeout enquanto uma renovação de token continua ao fundo.
    await teste()
    resultado = { codigo: "conexao_confirmada", mensagem: MENSAGENS_SEGURAS.conexao_confirmada }
  } catch (erro) { resultado = mensagemSegura(erro) }
  await prisma.eventoSaudeCanal.create({ data: { tenantId, canal, tipo: "teste", resultado: resultado.codigo === "conexao_confirmada" ? "sucesso" : "erro", codigo: resultado.codigo, mensagem: resultado.mensagem, ator: ator.slice(0, 160) } })
  return { ok: resultado.codigo === "conexao_confirmada", ...resultado }
}
