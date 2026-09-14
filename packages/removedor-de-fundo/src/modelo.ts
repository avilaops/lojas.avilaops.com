import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { pastaDosModelos } from './config.ts'
import type { NomeModelo } from './config.ts'

type Catalogo = {
  arquivo: string
  md5: string
  tamanhoAproximado: number
  fontes: string[]
}

/**
 * U-2-Net (Apache 2.0, github.com/xuebinqin/U-2-Net) exportado para ONNX e publicado
 * pelo projeto rembg (MIT). Licenca compativel com uso comercial.
 */
const CATALOGO: Record<NomeModelo, Catalogo> = {
  u2net: {
    arquivo: 'u2net.onnx',
    md5: '60024c5c889badc19c04ad937298a77b',
    tamanhoAproximado: 176_000_000,
    fontes: [
      'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx',
      'https://huggingface.co/tomjackson2023/rembg/resolve/main/u2net.onnx',
    ],
  },
  u2netp: {
    arquivo: 'u2netp.onnx',
    md5: '8e83ca70e441ab06c318d82300c84806',
    tamanhoAproximado: 4_700_000,
    fontes: [
      'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx',
      'https://huggingface.co/tomjackson2023/rembg/resolve/main/u2netp.onnx',
    ],
  },
}

export function caminhoDoModelo(nome: NomeModelo): string {
  return path.join(pastaDosModelos(), CATALOGO[nome].arquivo)
}

export async function modeloDisponivel(nome: NomeModelo): Promise<boolean> {
  try {
    const info = await fs.stat(caminhoDoModelo(nome))
    return info.isFile() && info.size > 1_000_000
  } catch {
    return false
  }
}

export function urlPersonalizada(): string | null {
  const bruto = process.env.FUNDO_MODELO_URL?.trim()
  return bruto ? bruto : null
}

export async function baixarModelo(
  nome: NomeModelo,
  aoProgredir?: (baixado: number, total: number) => void,
): Promise<string> {
  const catalogo = CATALOGO[nome]
  const destino = caminhoDoModelo(nome)
  await fs.mkdir(path.dirname(destino), { recursive: true })

  const personalizada = urlPersonalizada()
  const fontes = personalizada ? [personalizada, ...catalogo.fontes] : catalogo.fontes
  const falhas: string[] = []

  for (const fonte of fontes) {
    const temporario = `${destino}.parcial`
    try {
      const resposta = await fetch(fonte, { redirect: 'follow' })
      if (!resposta.ok || !resposta.body) {
        falhas.push(`${fonte} -> HTTP ${resposta.status}`)
        continue
      }

      const total = Number(resposta.headers.get('content-length') ?? catalogo.tamanhoAproximado)
      let baixado = 0
      const origem = Readable.fromWeb(resposta.body as Parameters<typeof Readable.fromWeb>[0])
      origem.on('data', (pedaco: Buffer) => {
        baixado += pedaco.length
        aoProgredir?.(baixado, total)
      })

      await pipeline(origem, createWriteStream(temporario))

      const info = await fs.stat(temporario)
      if (info.size < 1_000_000) {
        await fs.rm(temporario, { force: true })
        falhas.push(`${fonte} -> arquivo pequeno demais (${info.size} bytes)`)
        continue
      }

      await fs.rename(temporario, destino)
      return destino
    } catch (erro) {
      await fs.rm(temporario, { force: true })
      falhas.push(`${fonte} -> ${erro instanceof Error ? erro.message : String(erro)}`)
    }
  }

  throw new Error(
    `nao consegui baixar o modelo ${catalogo.arquivo}.\n  ${falhas.join('\n  ')}\n` +
      `Baixe manualmente e salve em ${destino}, ou aponte FUNDO_MODELO_URL para um espelho interno.`,
  )
}

/** Conferencia de integridade. Retorna null quando bate, ou o hash encontrado quando difere. */
export async function conferirModelo(nome: NomeModelo): Promise<string | null> {
  const conteudo = await fs.readFile(caminhoDoModelo(nome))
  const hash = crypto.createHash('md5').update(conteudo).digest('hex')
  return hash === CATALOGO[nome].md5 ? null : hash
}

export function tamanhoAproximado(nome: NomeModelo): number {
  return CATALOGO[nome].tamanhoAproximado
}
