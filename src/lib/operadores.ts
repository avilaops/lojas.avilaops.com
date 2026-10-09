import { randomBytes } from "node:crypto";
import type { OperadorLoja, Tenant } from "@prisma/client";
import type { ResultadoDoConvite } from "./convite-equipe";
import { prisma } from "./db";
import { conferirSenha, gerarHashSenha } from "./sessao";

/**
 * A equipe da loja, criada pelo próprio lojista.
 *
 * Antes o painel tinha uma senha por loja. Numa distribuidora com balcão isso
 * quer dizer que o dono, quem separa o pedido e quem cadastra produto usam a
 * mesma: ninguém sabe quem despachou o quê, e quando alguém sai da empresa a
 * senha muda para todo mundo ao mesmo tempo.
 *
 * **O dono não está nesta tabela.** Ele é o `Tenant.loginEmail`, não aparece na
 * lista e não pode ser removido pela tela. É de propósito: é o caminho de volta
 * se a equipe se trancar fora da própria loja, e é quem responde pela
 * assinatura.
 */

/** O que cada papel pode fazer. */
export type Papel = "DONO" | "GERENTE" | "OPERADOR";

/**
 * Permissões, por papel.
 *
 * A lista é curta de propósito: permissão que ninguém confere é enfeite, e
 * cada uma daqui é verificada numa rota de verdade.
 */
export const PODE = {
  /** Cadastrar e editar produto, preço, categoria, promoção. */
  catalogo: ["DONO", "GERENTE"],
  /** Ver pedido, mudar situação, despachar. É o balcão. */
  pedidos: ["DONO", "GERENTE", "OPERADOR"],
  /** Marca, domínio, entrega, recebimento, canais de venda. */
  configuracoes: ["DONO", "GERENTE"],
  /** Assinatura e cobrança da própria loja. Só quem paga. */
  cobranca: ["DONO"],
  /** Criar, editar e desligar quem entra no painel. */
  equipe: ["DONO"],
} as const satisfies Record<string, readonly Papel[]>;

export type Permissao = keyof typeof PODE;

/** O papel tem essa permissão? */
export function permite(papel: Papel, o_que: Permissao): boolean {
  return (PODE[o_que] as readonly Papel[]).includes(papel);
}

export const PAPEIS: Array<{ valor: Exclude<Papel, "DONO">; rotulo: string; explica: string }> = [
  {
    valor: "GERENTE",
    rotulo: "Gerente",
    explica: "Cuida da loja inteira: produtos, preços, pedidos e configurações. Não mexe na assinatura nem em quem tem acesso.",
  },
  {
    valor: "OPERADOR",
    rotulo: "Balcão",
    explica: "Vê e despacha pedidos. Não altera preço, produto nem configuração.",
  },
];

/** Normaliza o e-mail como identificador: espaço e caixa não distinguem pessoa. */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class ErroOperador extends Error {}

/**
 * Senha mínima.
 *
 * Oito caracteres, sem exigir símbolo nem número. Regra complicada demais leva
 * a pessoa a escrever a senha num papel colado no monitor do balcão, que é pior
 * que uma senha simples.
 */
export function conferirForcaDaSenha(senha: string): void {
  if (senha.length < 8) throw new ErroOperador("A senha precisa de pelo menos 8 caracteres.");
}

/** O que sai para a tela. Nunca `senhaHash`: o que não sai daqui não vaza. */
const NA_TELA = {
  id: true,
  nome: true,
  email: true,
  papel: true,
  ativo: true,
  criadoEm: true,
  conviteSituacao: true,
  conviteDetalhe: true,
  conviteEm: true,
} as const;

export async function listarOperadores(tenantId: string) {
  return prisma.operadorLoja.findMany({
    where: { tenantId },
    // Nunca devolve `senhaHash`: o que não sai daqui não vaza numa tela.
    select: { ...NA_TELA, ultimoAcessoEm: true },
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
  });
}

/**
 * Senha de quem entra por convite.
 *
 * A coluna é obrigatória, e a pessoa convidada cria a senha dela no login
 * único, não aqui. Fica um valor sorteado que ninguém conhece: a entrada por
 * senha da loja não abre, e a do login único, sim.
 */
function senhaQueNinguemSabe(): string {
  return gerarHashSenha(randomBytes(32).toString("base64url"));
}

/**
 * Cria o acesso. Sem `senha`, a pessoa entra só pelo login único (é o caso do
 * convite por e-mail); com ela, vale a senha combinada com o dono.
 */
export async function criarOperador(
  tenantId: string,
  dados: { nome: string; email: string; senha?: string; papel: string },
) {
  const nome = dados.nome.trim();
  const email = normalizarEmail(dados.email);
  if (nome.length < 2) throw new ErroOperador("Informe o nome de quem vai usar o acesso.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ErroOperador("E-mail inválido.");
  if (dados.senha) conferirForcaDaSenha(dados.senha);

  const papel = dados.papel === "GERENTE" ? "GERENTE" : "OPERADOR";

  // O dono é o `Tenant.loginEmail`. Deixar alguém criar um operador com o
  // mesmo e-mail criaria duas senhas para a mesma pessoa, e a entrada ficaria
  // decidida pela ordem em que o código procura.
  const loja = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { loginEmail: true } });
  if (loja?.loginEmail && normalizarEmail(loja.loginEmail) === email) {
    throw new ErroOperador("Esse e-mail já é o do dono da loja.");
  }

  const jaExiste = await prisma.operadorLoja.findUnique({
    where: { tenantId_email: { tenantId, email } },
    select: { id: true, ativo: true },
  });
  if (jaExiste) {
    throw new ErroOperador(
      jaExiste.ativo ? "Esse e-mail já tem acesso a esta loja." : "Esse e-mail já teve acesso: reative em vez de criar de novo.",
    );
  }

  return prisma.operadorLoja.create({
    data: { tenantId, nome, email, papel, senhaHash: dados.senha ? gerarHashSenha(dados.senha) : senhaQueNinguemSabe() },
    select: NA_TELA,
  });
}

/** Um acesso desta loja, para reenviar o convite. O `tenantId` entra no `where`. */
export async function buscarOperador(tenantId: string, id: string) {
  return prisma.operadorLoja.findFirst({ where: { id, tenantId }, select: NA_TELA });
}

/** Guarda o que aconteceu com o convite por e-mail. Nunca o endereço de criar a senha. */
export async function registrarConvite(tenantId: string, id: string, convite: ResultadoDoConvite) {
  const { count } = await prisma.operadorLoja.updateMany({
    where: { id, tenantId },
    data: { conviteSituacao: convite.situacao, conviteDetalhe: convite.detalhe.slice(0, 300), conviteEm: new Date() },
  });
  if (count === 0) throw new ErroOperador("Acesso não encontrado nesta loja.");
  return prisma.operadorLoja.findFirstOrThrow({ where: { id, tenantId }, select: NA_TELA });
}

/**
 * Muda papel, situação ou senha de quem já existe.
 *
 * O `tenantId` entra no `where` junto do id, e não só na leitura: sem isso um
 * lojista poderia editar o operador de outra loja mandando um id qualquer.
 */
export async function atualizarOperador(
  tenantId: string,
  id: string,
  dados: { nome?: string; papel?: string; ativo?: boolean; senha?: string },
) {
  const alvo = await prisma.operadorLoja.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!alvo) throw new ErroOperador("Acesso não encontrado nesta loja.");

  const mudanca: { nome?: string; papel?: string; ativo?: boolean; senhaHash?: string } = {};
  if (dados.nome != null) {
    const nome = dados.nome.trim();
    if (nome.length < 2) throw new ErroOperador("Informe o nome.");
    mudanca.nome = nome;
  }
  if (dados.papel != null) mudanca.papel = dados.papel === "GERENTE" ? "GERENTE" : "OPERADOR";
  if (dados.ativo != null) mudanca.ativo = dados.ativo;
  if (dados.senha) {
    conferirForcaDaSenha(dados.senha);
    mudanca.senhaHash = gerarHashSenha(dados.senha);
  }

  return prisma.operadorLoja.update({
    where: { id },
    data: mudanca,
    select: { id: true, nome: true, email: true, papel: true, ativo: true },
  });
}

/**
 * Remove de vez.
 *
 * Existe para o caso de erro de digitação no cadastro. Para quem saiu da
 * empresa o certo é desligar (`ativo: false`), que preserva o histórico.
 */
export async function removerOperador(tenantId: string, id: string) {
  const { count } = await prisma.operadorLoja.deleteMany({ where: { id, tenantId } });
  if (count === 0) throw new ErroOperador("Acesso não encontrado nesta loja.");
}

export interface QuemEntrou {
  tenant: Tenant;
  papel: Papel;
  /** Nulo quando quem entrou é o dono: ele não está na tabela de operadores. */
  operador: Pick<OperadorLoja, "id" | "nome" | "email"> | null;
}

/**
 * Confere e-mail e senha contra o dono e contra a equipe.
 *
 * O dono é conferido primeiro porque é quem não pode ser bloqueado por
 * engano. Operador desligado não entra, e a mensagem é a mesma de senha errada:
 * dizer "esse acesso foi desligado" conta a quem tentou que o e-mail existe.
 */
export async function autenticar(loja: Tenant, email: string, senha: string): Promise<QuemEntrou | null> {
  const alvo = normalizarEmail(email);

  if (loja.loginEmail && normalizarEmail(loja.loginEmail) === alvo && conferirSenha(senha, loja.senhaHash)) {
    return { tenant: loja, papel: "DONO", operador: null };
  }

  const op = await prisma.operadorLoja.findUnique({
    where: { tenantId_email: { tenantId: loja.id, email: alvo } },
  });
  if (!op || !op.ativo || !conferirSenha(senha, op.senhaHash)) return null;

  await prisma.operadorLoja.update({ where: { id: op.id }, data: { ultimoAcessoEm: new Date() } });
  return {
    tenant: loja,
    papel: op.papel === "GERENTE" ? "GERENTE" : "OPERADOR",
    operador: { id: op.id, nome: op.nome, email: op.email },
  };
}

/**
 * Quem é este e-mail no painel, sem conferir senha.
 *
 * Só para a entrada pelo login único (`/api/painel/entrar/sso`), depois de o
 * Auth ter confirmado quem é a pessoa e que ela pode entrar no Lojas. A ordem
 * é a mesma do login por senha: o dono primeiro, depois a equipe. Loja
 * cancelada e operador desligado não entram por nenhuma das duas portas.
 */
export async function identificarPorEmail(email: string): Promise<QuemEntrou | null> {
  const alvo = normalizarEmail(email);

  const propria = await prisma.tenant.findUnique({ where: { loginEmail: alvo } });
  if (propria && propria.status !== "CANCELADA") return { tenant: propria, papel: "DONO", operador: null };

  const op = await prisma.operadorLoja.findFirst({
    where: { email: alvo, ativo: true, tenant: { status: { not: "CANCELADA" } } },
    include: { tenant: true },
    orderBy: { criadoEm: "asc" },
  });
  if (!op) return null;

  await prisma.operadorLoja.update({ where: { id: op.id }, data: { ultimoAcessoEm: new Date() } });
  return {
    tenant: op.tenant,
    papel: op.papel === "GERENTE" ? "GERENTE" : "OPERADOR",
    operador: { id: op.id, nome: op.nome, email: op.email },
  };
}

/**
 * Porteiro das rotas do painel.
 *
 * Devolve a sessão quando a pessoa pode, e a resposta pronta de recusa quando
 * não pode. Existe para a conferência ser uma linha em cada rota: permissão que
 * depende de cada autor lembrar de escrever vira permissão que falta em alguma
 * rota, e é justamente a que alguém encontra.
 *
 *   const { s, erro } = await exigir("catalogo");
 *   if (erro) return erro;
 */
export async function exigir(o_que: Permissao) {
  // Import local: `sessao.ts` já importa deste arquivo, e no topo isso fecharia
  // um ciclo entre os dois módulos.
  const { sessaoDoPainel } = await import("./sessao");
  const s = await sessaoDoPainel();
  if (!s) return { s: null, erro: Response.json({ erro: "Sessão expirada." }, { status: 401 }) };
  if (!permite(s.papel, o_que)) {
    return {
      s: null,
      erro: Response.json({ erro: "Seu acesso não permite esta ação. Fale com o dono da loja." }, { status: 403 }),
    };
  }
  return { s, erro: null };
}
