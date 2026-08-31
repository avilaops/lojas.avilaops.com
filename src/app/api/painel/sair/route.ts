import { fecharSessao } from "@/lib/sessao";

/**
 * Redireciona por caminho relativo, de propósito.
 *
 * `new URL("/", request.url)` monta a URL absoluta a partir do host que o
 * servidor enxerga, e no container isso é `0.0.0.0:3080`: quem clicava em
 * "Sair" era mandado para um endereço que não existe fora do servidor. O
 * cabeçalho `Location` aceita caminho relativo, e aí quem resolve o host é o
 * navegador, que já sabe em qual domínio está.
 */
export async function POST() {
  await fecharSessao();
  return new Response(null, { status: 303, headers: { location: "/" } });
}
