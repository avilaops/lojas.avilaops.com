import { sessaoDoPainel } from "@/lib/sessao";
import { CONVITE_DESLIGADO, configConvite, convidarParaAEquipe } from "@/lib/convite-equipe";
import { ErroOperador, buscarOperador, permite, registrarConvite } from "@/lib/operadores";

/**
 * Enviar o convite por e-mail (de novo) a quem já está na equipe.
 *
 * O login único escreve para a pessoa: endereço de criar a senha enquanto ela
 * não tiver criado uma, só o endereço do painel depois disso.
 */
export const dynamic = "force-dynamic";

const HOST_BASE = (process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com").toLowerCase();

/**
 * Freio por pessoa, em memória como o do cadastro: um toque repetido não vira
 * uma fila de e-mails na caixa de alguém. O login único tem o freio dele; este
 * poupa a ida até lá.
 */
const JANELA_MS = 10 * 60 * 1000;
const MAXIMO = 3;
const envios = new Map<string, { n: number; desde: number }>();

function podeEnviar(chave: string): boolean {
  const agora = Date.now();
  const atual = envios.get(chave);
  if (!atual || agora - atual.desde > JANELA_MS) {
    envios.set(chave, { n: 1, desde: agora });
    return true;
  }
  atual.n += 1;
  return atual.n <= MAXIMO;
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await sessaoDoPainel();
  if (!s) return Response.json({ erro: "Sessão expirada." }, { status: 401 });
  if (!permite(s.papel, "equipe")) return Response.json({ erro: "Só o dono da loja gerencia os acessos." }, { status: 403 });
  const { id } = await params;

  const cfg = configConvite();
  if (!cfg) return Response.json({ erro: CONVITE_DESLIGADO }, { status: 400 });

  // O `tenantId` da sessão entra na busca: id de outra loja não é encontrado.
  const operador = await buscarOperador(s.tenant.id, id);
  if (!operador) return Response.json({ erro: "Acesso não encontrado nesta loja." }, { status: 404 });
  if (!operador.ativo) return Response.json({ erro: "Reative o acesso antes de enviar o convite." }, { status: 400 });
  if (!podeEnviar(`${s.tenant.id}:${id}`)) {
    return Response.json({ erro: "Convite enviado há pouco. Aguarde alguns minutos para enviar de novo." }, { status: 429 });
  }

  try {
    const convite = await convidarParaAEquipe(cfg, { email: operador.email, nome: operador.nome, loja: s.tenant.nome, hostBase: HOST_BASE });
    return Response.json({ operador: await registrarConvite(s.tenant.id, id, convite), convite });
  } catch (e) {
    if (e instanceof ErroOperador) return Response.json({ erro: e.message }, { status: 400 });
    throw e;
  }
}
