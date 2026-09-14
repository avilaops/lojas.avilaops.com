import os from 'node:os'
import path from 'node:path'

export type Motor = 'auto' | 'estudio' | 'ia'
export type Formato = 'png' | 'webp' | 'jpg'
export type NomeModelo = 'u2net' | 'u2netp'

export type Opcoes = {
  entrada: string
  saida: string
  motor: Motor
  formatos: Formato[]
  tamanho: number
  margem: number
  fundo: 'transparente' | { r: number; g: number; b: number }
  tolerancia: number
  sombra: number
  borda: number
  furos: boolean
  furoMin: number
  furoMax: number
  limpar: boolean
  qualidade: number
  concorrencia: number
  recursivo: boolean
  sobrescrever: boolean
  relatorio: boolean
  modelo: NomeModelo
}

export const EXTENSOES = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tif', '.tiff'])

/** Le o .env da pasta atual, se existir. Node 21+ ja faz isso nativamente. */
export function carregarEnv(diretorio: string): void {
  for (const arquivo of [path.join(diretorio, '.env'), path.join(process.cwd(), '.env')]) {
    try {
      process.loadEnvFile(arquivo)
      return
    } catch {
      // sem .env aqui, seguimos com o ambiente do sistema
    }
  }
}

export function pastaDosModelos(): string {
  const configurada = process.env.FUNDO_MODELOS_DIR?.trim()
  if (configurada) return path.resolve(configurada)
  const base = process.env.LOCALAPPDATA ?? path.join(os.homedir(), '.cache')
  return path.join(base, 'avilaops', 'removedor-de-fundo', 'modelos')
}

export function numeroDoAmbiente(chave: string, padrao: number): number {
  const bruto = process.env[chave]?.trim()
  if (!bruto) return padrao
  const valor = Number(bruto.replace(',', '.'))
  return Number.isFinite(valor) ? valor : padrao
}

export function textoDoAmbiente(chave: string, padrao: string): string {
  const bruto = process.env[chave]?.trim()
  return bruto ? bruto : padrao
}

export function concorrenciaPadrao(): number {
  const configurada = numeroDoAmbiente('FUNDO_CONCORRENCIA', 0)
  if (configurada >= 1) return Math.floor(configurada)
  return Math.max(1, Math.min(4, os.cpus().length - 1))
}
