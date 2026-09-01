import { CHECKSUM, MANIFESTO, SEM_CACHE, autorizado, naoEncontrado, noDominioDaPlataforma } from "@/lib/gapp";

/**
 * GET /v1/manifest — concilia o manifesto pelo checksum (CT-19).
 *
 * Devolve o arquivo do repositório e o sha256 dos mesmos bytes. Se o registro
 * guardar um checksum diferente, alguém publicou sem registrar (ou registrou
 * sem publicar), e é isso que a conciliação existe para pegar.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await noDominioDaPlataforma())) return naoEncontrado();
  const auth = autorizado(request);
  if (!auth.ok) return auth.resposta;

  return Response.json({ checksum: CHECKSUM, manifesto: MANIFESTO }, { headers: SEM_CACHE });
}
