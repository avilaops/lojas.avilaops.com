import { exigir } from "@/lib/operadores";
import { recursoAtivo } from "@/lib/recursos";

/** Painel com permissão de configurações e a flag `recebimento_v2` ligada. */
export async function acessoV2() {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return { s: null, erro };
  if (!recursoAtivo(s.tenant, "recebimento_v2")) return { s: null, erro: Response.json({ erro: "Não encontrado." }, { status: 404 }) };
  return { s, erro: null };
}
