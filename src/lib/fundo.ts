/**
 * Removedor de fundo da casa (`removedor-de-fundo`, o mesmo que o Odoo usa no
 * botão "Remover fundo"). Roda em container próprio no Hetzner, sem API paga
 * por imagem e sem a foto sair da nossa infra.
 *
 * Contrato: POST /recortar com a imagem crua no corpo e Bearer token; a
 * resposta traz `{ imagem: "<base64>" }` já recortada, quadrada e com respiro
 * igual — que é o padrão de foto de catálogo da plataforma.
 */
export class FundoIndisponivel extends Error {}

export function removedorConfigurado(): boolean {
  return Boolean(process.env.FUNDO_URL && process.env.FUNDO_TOKEN);
}

export async function removerFundo(bytes: Buffer, opcoes: { tamanho?: number; margem?: number; fundo?: string; formato?: string } = {}): Promise<Buffer> {
  const base = process.env.FUNDO_URL;
  const token = process.env.FUNDO_TOKEN;
  if (!base || !token) throw new FundoIndisponivel("Tratamento de imagem não está configurado nesta instalação.");

  const q = new URLSearchParams({
    motor: "hibrido",
    tamanho: String(opcoes.tamanho ?? 1200),
    margem: String(opcoes.margem ?? 6),
    fundo: opcoes.fundo ?? "branco",
    formato: opcoes.formato ?? "webp",
  });

  let r: Response;
  try {
    r = await fetch(`${base}/recortar?${q}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/octet-stream" },
      body: new Uint8Array(bytes),
      // A inferência roda em fila, uma imagem por vez: pode passar de 10 s.
      signal: AbortSignal.timeout(90_000),
    });
  } catch (erro) {
    throw new FundoIndisponivel(`Serviço de tratamento fora do ar: ${erro instanceof Error ? erro.message : erro}`);
  }
  if (!r.ok) throw new FundoIndisponivel(`Serviço de tratamento respondeu ${r.status}.`);

  const dados = (await r.json()) as { imagem?: string };
  if (!dados.imagem) throw new FundoIndisponivel("Serviço de tratamento não devolveu imagem.");
  return Buffer.from(dados.imagem, "base64");
}
