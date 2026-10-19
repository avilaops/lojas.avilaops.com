/** Entrada local desativada: somente o Auth pode autenticar usuários do Lojas. */
export async function POST() {
  return Response.json({ erro: "Entre pela conta Ávila Ops.", caminho: "/entrar" }, { status: 410 });
}
