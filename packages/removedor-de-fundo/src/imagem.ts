import sharp from 'sharp'
import type { Sharp } from 'sharp'
import type { Formato, Opcoes } from './config.ts'
import type { Caixa } from './mascara.ts'

sharp.cache({ files: 0 })

export type Carregada = {
  rgba: Uint8Array
  largura: number
  altura: number
  /** Fracao de pixels que ja vinham transparentes na origem. */
  transparenciaOriginal: number
}

export type Quadro = {
  dados: Buffer
  largura: number
  altura: number
}

async function deSharp(instancia: Sharp): Promise<Carregada> {
  const { data, info } = await instancia.rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const rgba = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)

  let transparentes = 0
  for (let p = 3; p < rgba.length; p += 4) if (rgba[p] < 250) transparentes++

  return {
    rgba,
    largura: info.width,
    altura: info.height,
    transparenciaOriginal: transparentes / (info.width * info.height),
  }
}

export function carregar(caminho: string): Promise<Carregada> {
  return deSharp(sharp(caminho, { animated: false }))
}

/** Mesma leitura, mas a partir de bytes - usado pelo painel web. `limite` reduz a foto antes de processar. */
export function carregarBytes(bytes: Uint8Array, limite = 0): Promise<Carregada> {
  const instancia = sharp(Buffer.from(bytes), { animated: false })
  if (limite > 0) {
    return deSharp(instancia.resize(limite, limite, { fit: 'inside', withoutEnlargement: true }))
  }
  return deSharp(instancia)
}

export function aplicarAlfa(rgba: Uint8Array, alfa: Float32Array): void {
  for (let indice = 0; indice < alfa.length; indice++) {
    const valor = alfa[indice] * 255
    rgba[indice * 4 + 3] = valor < 0 ? 0 : valor > 255 ? 255 : Math.round(valor)
  }
}

function fundoDoSharp(opcoes: Opcoes, opaco: boolean) {
  if (opcoes.fundo === 'transparente') {
    return opaco ? { r: 255, g: 255, b: 255, alpha: 1 } : { r: 255, g: 255, b: 255, alpha: 0 }
  }
  return { ...opcoes.fundo, alpha: 1 }
}

/**
 * Recorta no produto e centraliza em um quadro com respiro. E aqui que a imagem vira
 * "pronta para marketplace": o catalogo inteiro sai com o mesmo enquadramento.
 */
export async function montar(
  rgba: Uint8Array,
  largura: number,
  altura: number,
  caixa: Caixa,
  opcoes: Opcoes,
): Promise<Quadro> {
  const original = sharp(Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength), {
    raw: { width: largura, height: altura, channels: 4 },
  }).extract({
    left: caixa.esquerda,
    top: caixa.topo,
    width: caixa.largura,
    height: caixa.altura,
  })

  if (opcoes.tamanho > 0) {
    const interno = Math.max(1, Math.round(opcoes.tamanho * (1 - 2 * opcoes.margem)))
    const ajustado = await original
      .resize(interno, interno, { fit: 'inside', kernel: 'lanczos3', withoutEnlargement: false })
      .raw()
      .toBuffer({ resolveWithObject: true })

    const sobraEsquerda = Math.floor((opcoes.tamanho - ajustado.info.width) / 2)
    const sobraTopo = Math.floor((opcoes.tamanho - ajustado.info.height) / 2)

    const dados = await sharp(ajustado.data, {
      raw: { width: ajustado.info.width, height: ajustado.info.height, channels: 4 },
    })
      .extend({
        left: sobraEsquerda,
        right: opcoes.tamanho - ajustado.info.width - sobraEsquerda,
        top: sobraTopo,
        bottom: opcoes.tamanho - ajustado.info.height - sobraTopo,
        background: fundoDoSharp(opcoes, false),
      })
      .raw()
      .toBuffer()

    return { dados, largura: opcoes.tamanho, altura: opcoes.tamanho }
  }

  const respiro = Math.round(Math.max(caixa.largura, caixa.altura) * opcoes.margem)
  const dados = await original
    .extend({
      left: respiro,
      right: respiro,
      top: respiro,
      bottom: respiro,
      background: fundoDoSharp(opcoes, false),
    })
    .raw()
    .toBuffer()

  return {
    dados,
    largura: caixa.largura + respiro * 2,
    altura: caixa.altura + respiro * 2,
  }
}

function comFormato(quadro: Quadro, formato: Formato, opcoes: Opcoes): Sharp {
  let base = sharp(quadro.dados, {
    raw: { width: quadro.largura, height: quadro.altura, channels: 4 },
  })

  // jpg nao tem transparencia; e quem pediu fundo de cor quer a cor atras do produto tambem,
  // nao so na sobra do enquadramento.
  if (formato === 'jpg' || opcoes.fundo !== 'transparente') {
    base = base.flatten({ background: fundoDoSharp(opcoes, true) })
  }

  if (formato === 'jpg') {
    return base.jpeg({ quality: opcoes.qualidade, mozjpeg: true, chromaSubsampling: '4:4:4' })
  }
  if (formato === 'webp') {
    return base.webp({ quality: opcoes.qualidade, alphaQuality: 100, effort: 5 })
  }
  return base.png({ compressionLevel: 9, adaptiveFiltering: true })
}

export function codificar(quadro: Quadro, formato: Formato, opcoes: Opcoes): Promise<Buffer> {
  return comFormato(quadro, formato, opcoes).toBuffer()
}

export async function gravar(
  quadro: Quadro,
  destinos: Map<Formato, string>,
  opcoes: Opcoes,
): Promise<void> {
  for (const [formato, destino] of destinos) {
    await comFormato(quadro, formato, opcoes).toFile(destino)
  }
}
