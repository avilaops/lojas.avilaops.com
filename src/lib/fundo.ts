import type { Formato, Opcoes } from "../../packages/removedor-de-fundo/src/config.ts";
import { lerCor } from "../../packages/removedor-de-fundo/src/cor.ts";
import { aplicarAlfa, carregarBytes, codificar, montar } from "../../packages/removedor-de-fundo/src/imagem.ts";
import { modeloDisponivel } from "../../packages/removedor-de-fundo/src/modelo.ts";
import { calcularRecorte } from "../../packages/removedor-de-fundo/src/processar.ts";

/** O tratamento acompanha o App Lojas e processa as fotos dentro da aplicacao. */
export class FundoIndisponivel extends Error {}
const estado = globalThis as typeof globalThis & { filaRecorteLojas?: Promise<unknown> };

export function removedorConfigurado(): boolean { return true; }

export async function removerFundo(bytes: Buffer, ajustes: { tamanho?: number; margem?: number; fundo?: string; formato?: string } = {}): Promise<Buffer> {
  if (!bytes.length || bytes.length > 30 * 1024 * 1024) throw new FundoIndisponivel("Envie uma imagem de ate 30 MB.");
  const formato = ajustes.formato ?? "webp";
  if (!["png", "webp", "jpg"].includes(formato)) throw new FundoIndisponivel("Formato de imagem invalido.");
  const tamanho = ajustes.tamanho ?? 1200;
  const margem = (ajustes.margem ?? 6) / 100;
  if (!Number.isFinite(tamanho) || tamanho < 1 || tamanho > 4096 || !Number.isFinite(margem) || margem < 0 || margem >= 0.45) throw new FundoIndisponivel("Tamanho ou margem fora do limite.");
  const processar = async (): Promise<Buffer> => {
    const opcoes: Opcoes = {
      entrada: "", saida: "", motor: "auto", formatos: [formato as Formato],
      tamanho: Math.round(tamanho), margem, fundo: lerCor(ajustes.fundo ?? "branco"),
      tolerancia: 8, sombra: 0, borda: 0, furos: false, furoMin: 0.0005,
      furoMax: 0.08, limpar: true, qualidade: 90, concorrencia: 1,
      recursivo: false, sobrescrever: false, relatorio: false, modelo: process.env.FUNDO_MODELO === "u2net" ? "u2net" : "u2netp",
    };
    const imagem = await carregarBytes(bytes, 1600);
    const recorte = await calcularRecorte(imagem, opcoes, { iaPronta: await modeloDisponivel(opcoes.modelo) });
    if (!recorte.caixa) throw new Error("Nao foi possivel identificar o produto na imagem.");
    aplicarAlfa(imagem.rgba, recorte.alfa);
    const quadro = await montar(imagem.rgba, imagem.largura, imagem.altura, recorte.caixa, opcoes);
    return codificar(quadro, opcoes.formatos[0], opcoes);
  };
  // Uma inferencia por vez, mesmo quando diferentes rotas usam o modulo.
  const tarefa = (estado.filaRecorteLojas ?? Promise.resolve()).then(processar, processar);
  estado.filaRecorteLojas = tarefa.catch(() => {});
  try { return await tarefa; }
  catch (erro) { throw new FundoIndisponivel(`Nao foi possivel tratar a imagem: ${erro instanceof Error ? erro.message : String(erro)}`); }
}
