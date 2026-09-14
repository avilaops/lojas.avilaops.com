import type { Cor } from './cor.ts'

export type FundoEstimado = {
  cor: Cor
  /** 0 a 1: quanto da moldura da foto combina com a cor estimada. */
  uniformidade: number
}

/**
 * Estima a cor do fundo olhando a moldura da foto (3 px em cada lado) e mede o
 * quanto essa moldura e homogenea. Uniformidade baixa = foto de ambiente, nao de estudio.
 */
export function estimarFundo(rgba: Uint8Array, largura: number, altura: number): FundoEstimado {
  const espessura = Math.max(1, Math.min(3, Math.floor(Math.min(largura, altura) / 50)))
  const vermelhos: number[] = []
  const verdes: number[] = []
  const azuis: number[] = []

  const coletar = (x: number, y: number) => {
    const p = (y * largura + x) * 4
    vermelhos.push(rgba[p])
    verdes.push(rgba[p + 1])
    azuis.push(rgba[p + 2])
  }

  for (let y = 0; y < espessura; y++) {
    for (let x = 0; x < largura; x++) {
      coletar(x, y)
      coletar(x, altura - 1 - y)
    }
  }
  for (let x = 0; x < espessura; x++) {
    for (let y = espessura; y < altura - espessura; y++) {
      coletar(x, y)
      coletar(largura - 1 - x, y)
    }
  }

  const mediana = (valores: number[]) => {
    const ordenados = valores.slice().sort((a, b) => a - b)
    return ordenados[Math.floor(ordenados.length / 2)]
  }
  const cor: Cor = { r: mediana(vermelhos), g: mediana(verdes), b: mediana(azuis) }

  let combinam = 0
  for (let i = 0; i < vermelhos.length; i++) {
    const d = Math.max(
      Math.abs(vermelhos[i] - cor.r),
      Math.abs(verdes[i] - cor.g),
      Math.abs(azuis[i] - cor.b),
    )
    if (d <= 12) combinam++
  }

  return { cor, uniformidade: vermelhos.length ? combinam / vermelhos.length : 0 }
}

export type OpcoesMascaraPorCor = {
  cor: Cor
  /** Distancia (0-255) em que o pixel ainda e fundo puro. */
  interna: number
  /** Distancia (0-255) em que o pixel ja e produto. Entre as duas ha a rampa da borda. */
  externa: number
  /** Distancia extra aceita para sombras neutras mais escuras que o fundo. 0 desliga. */
  sombra: number
  /** Tambem limpar bolsoes de fundo cercados pelo produto (vao da alca, furos). */
  furos: boolean
  furoMin: number
  furoMax: number
}

/**
 * Preenchimento por similaridade a partir das bordas. Devolve alfa 0-1 por pixel:
 * 0 = fundo, 1 = produto, valores intermediarios formam a borda suavizada (antialias).
 */
export function mascaraPorCor(
  rgba: Uint8Array,
  largura: number,
  altura: number,
  opcoes: OpcoesMascaraPorCor,
): Float32Array {
  const total = largura * altura
  const alfa = new Float32Array(total).fill(1)
  const visto = new Uint8Array(total)
  const fila = new Int32Array(total)
  const { cor, interna, externa, sombra } = opcoes
  const limiteSombra = sombra > externa ? sombra : 0

  const distancia = (indice: number): number => {
    const p = indice * 4
    return Math.max(
      Math.abs(rgba[p] - cor.r),
      Math.abs(rgba[p + 1] - cor.g),
      Math.abs(rgba[p + 2] - cor.b),
    )
  }

  // Sombra: pixel neutro (sem cor dominante) e mais escuro que o fundo.
  const ehSombra = (indice: number): boolean => {
    if (!limiteSombra) return false
    const p = indice * 4
    const r = rgba[p]
    const g = rgba[p + 1]
    const b = rgba[p + 2]
    const maior = Math.max(r, g, b)
    const menor = Math.min(r, g, b)
    if (maior - menor > 16) return false
    return maior <= Math.max(cor.r, cor.g, cor.b)
  }

  const limiteDe = (indice: number) => (ehSombra(indice) ? limiteSombra : externa)

  const alfaDe = (indice: number, distanciaDoPixel: number): number => {
    const limite = limiteDe(indice)
    if (distanciaDoPixel <= interna) return 0
    if (limite <= interna) return 1
    return Math.min(1, Math.max(0, (distanciaDoPixel - interna) / (limite - interna)))
  }

  let inicio = 0
  let fim = 0
  const semear = (indice: number) => {
    if (visto[indice]) return
    if (distancia(indice) > limiteDe(indice)) return
    visto[indice] = 1
    fila[fim++] = indice
  }

  for (let x = 0; x < largura; x++) {
    semear(x)
    semear((altura - 1) * largura + x)
  }
  for (let y = 0; y < altura; y++) {
    semear(y * largura)
    semear(y * largura + largura - 1)
  }

  while (inicio < fim) {
    const indice = fila[inicio++]
    alfa[indice] = alfaDe(indice, distancia(indice))
    const x = indice % largura
    if (x > 0) semear(indice - 1)
    if (x < largura - 1) semear(indice + 1)
    if (indice >= largura) semear(indice - largura)
    if (indice < total - largura) semear(indice + largura)
  }

  if (opcoes.furos) limparBolsoes(rgba, largura, altura, alfa, visto, opcoes, distancia, alfaDe)

  return alfa
}

/**
 * Segunda passada: regioes com a cor do fundo cercadas pelo produto (o vao entre o gatilho
 * e o frasco, por exemplo). Sao limpas apenas dentro da faixa de area configurada, para nao
 * furar rotulos brancos, que tem exatamente a mesma cor.
 */
function limparBolsoes(
  rgba: Uint8Array,
  largura: number,
  altura: number,
  alfa: Float32Array,
  visto: Uint8Array,
  opcoes: OpcoesMascaraPorCor,
  distancia: (indice: number) => number,
  alfaDe: (indice: number, distanciaDoPixel: number) => number,
): void {
  const total = largura * altura
  const areaMinima = opcoes.furoMin * total
  const areaMaxima = opcoes.furoMax * total
  const fila = new Int32Array(total)
  const componente: number[] = []

  for (let semente = 0; semente < total; semente++) {
    if (visto[semente]) continue
    if (distancia(semente) > opcoes.externa) continue

    let inicio = 0
    let fim = 0
    visto[semente] = 1
    fila[fim++] = semente
    componente.length = 0

    while (inicio < fim) {
      const indice = fila[inicio++]
      componente.push(indice)
      const x = indice % largura
      const vizinhos = [
        x > 0 ? indice - 1 : -1,
        x < largura - 1 ? indice + 1 : -1,
        indice >= largura ? indice - largura : -1,
        indice < total - largura ? indice + largura : -1,
      ]
      for (const vizinho of vizinhos) {
        if (vizinho < 0 || visto[vizinho]) continue
        if (distancia(vizinho) > opcoes.externa) continue
        visto[vizinho] = 1
        fila[fim++] = vizinho
      }
    }

    if (componente.length < areaMinima || componente.length > areaMaxima) continue
    for (const indice of componente) alfa[indice] = alfaDe(indice, distancia(indice))
  }
}

/**
 * Remove ilhas soltas de produto (poeira, respingo de compressao, marca d'agua no canto).
 * Mantem tudo que estiver ligado a maior peca e as pecas acima do tamanho minimo.
 */
export function removerIlhas(
  alfa: Float32Array,
  largura: number,
  altura: number,
  fracaoMinima: number,
): number {
  const total = largura * altura
  const rotulo = new Int32Array(total).fill(-1)
  const fila = new Int32Array(total)
  const tamanhos: number[] = []

  for (let semente = 0; semente < total; semente++) {
    if (alfa[semente] <= 0.5 || rotulo[semente] >= 0) continue
    const atual = tamanhos.length
    let inicio = 0
    let fim = 0
    rotulo[semente] = atual
    fila[fim++] = semente
    let tamanho = 0

    while (inicio < fim) {
      const indice = fila[inicio++]
      tamanho++
      const x = indice % largura
      const vizinhos = [
        x > 0 ? indice - 1 : -1,
        x < largura - 1 ? indice + 1 : -1,
        indice >= largura ? indice - largura : -1,
        indice < total - largura ? indice + largura : -1,
      ]
      for (const vizinho of vizinhos) {
        if (vizinho < 0 || rotulo[vizinho] >= 0 || alfa[vizinho] <= 0.5) continue
        rotulo[vizinho] = atual
        fila[fim++] = vizinho
      }
    }
    tamanhos.push(tamanho)
  }

  if (tamanhos.length <= 1) return 0

  const maior = tamanhos.reduce((a, b) => Math.max(a, b), 0)
  const minimo = Math.max(fracaoMinima * total, 24)
  let removidas = 0
  for (let indice = 0; indice < total; indice++) {
    const atual = rotulo[indice]
    if (atual < 0) continue
    const tamanho = tamanhos[atual]
    if (tamanho === maior || tamanho >= minimo) continue
    alfa[indice] = 0
    removidas++
  }
  return removidas
}

/**
 * Tira a cor do fundo que "vazou" para os pixels semitransparentes da borda.
 * Sem isso todo recorte sobre fundo branco fica com auréola clara ao ir para o site escuro.
 */
export function descontaminar(rgba: Uint8Array, alfa: Float32Array, cor: Cor): void {
  const canais = [cor.r, cor.g, cor.b]
  for (let indice = 0; indice < alfa.length; indice++) {
    const a = alfa[indice]
    if (a <= 0.02 || a >= 0.98) continue
    const p = indice * 4
    for (let canal = 0; canal < 3; canal++) {
      const valor = (rgba[p + canal] - (1 - a) * canais[canal]) / a
      rgba[p + canal] = valor < 0 ? 0 : valor > 255 ? 255 : Math.round(valor)
    }
  }
}

export type Caixa = { esquerda: number; topo: number; largura: number; altura: number }

/** Menor retangulo que contem o produto. */
export function caixaDoProduto(
  alfa: Float32Array,
  largura: number,
  altura: number,
  limiar = 0.04,
): Caixa | null {
  let minimoX = largura
  let minimoY = altura
  let maximoX = -1
  let maximoY = -1

  for (let y = 0; y < altura; y++) {
    const linha = y * largura
    for (let x = 0; x < largura; x++) {
      if (alfa[linha + x] <= limiar) continue
      if (x < minimoX) minimoX = x
      if (x > maximoX) maximoX = x
      if (y < minimoY) minimoY = y
      if (y > maximoY) maximoY = y
    }
  }

  if (maximoX < 0) return null
  return {
    esquerda: minimoX,
    topo: minimoY,
    largura: maximoX - minimoX + 1,
    altura: maximoY - minimoY + 1,
  }
}

export function cobertura(alfa: Float32Array): number {
  let soma = 0
  for (let indice = 0; indice < alfa.length; indice++) soma += alfa[indice]
  return soma / alfa.length
}
