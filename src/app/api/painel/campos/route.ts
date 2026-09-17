import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { exigir } from "@/lib/operadores";
import { invalidarCatalogo } from "@/lib/catalogo-cache";
import {
  TIPOS_CAMPO,
  chaveDoRotulo,
  lerDefinicoes,
  type CampoPersonalizado,
  type TipoCampo,
} from "@/lib/campos-personalizados";

/**
 * PUT /api/painel/campos — as definições de campo personalizado da loja.
 *
 * A lista inteira de uma vez, e não um campo por chamada, porque a ordem faz
 * parte da definição: é ela que decide como a ficha do produto é lida. Salvar
 * item a item obrigaria a inventar uma operação "reordenar" para dizer a mesma
 * coisa.
 *
 * A chave de um campo que já existe nunca muda aqui, mesmo que o rótulo mude:
 * é ela que liga a definição ao valor gravado em cada produto.
 */
export async function PUT(request: Request) {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;
  const loja = s.tenant;

  const corpo = (await request.json().catch(() => null)) as { campos?: unknown } | null;
  if (!Array.isArray(corpo?.campos)) return Response.json({ erro: "Lista de campos ausente." }, { status: 422 });

  const jaExistem = new Map(lerDefinicoes(loja.camposPersonalizados).map((c) => [c.chave, c]));
  const chavesUsadas = new Set<string>();
  const entrada: CampoPersonalizado[] = [];

  for (const bruto of corpo.campos as Array<Record<string, unknown>>) {
    const rotulo = typeof bruto?.rotulo === "string" ? bruto.rotulo.trim() : "";
    if (!rotulo) return Response.json({ erro: "Todo campo precisa de um rótulo." }, { status: 422 });

    const tipo = bruto?.tipo as TipoCampo;
    if (!TIPOS_CAMPO.includes(tipo)) return Response.json({ erro: `Tipo de campo desconhecido em "${rotulo}".` }, { status: 422 });

    // Chave existente manda; campo novo deriva do rótulo.
    const chaveEnviada = typeof bruto?.chave === "string" ? bruto.chave : "";
    let chave = jaExistem.has(chaveEnviada) ? chaveEnviada : chaveDoRotulo(rotulo);
    if (!chave) return Response.json({ erro: `"${rotulo}" não gera um identificador válido. Use letras ou números.` }, { status: 422 });

    // Dois rótulos que geram a mesma chave: sufixo numérico, para não fazer um
    // campo novo sobrescrever silenciosamente o valor gravado no outro.
    if (chavesUsadas.has(chave)) {
      let n = 2;
      while (chavesUsadas.has(`${chave}-${n}`)) n++;
      chave = `${chave}-${n}`;
    }
    chavesUsadas.add(chave);

    entrada.push({
      chave,
      rotulo,
      tipo,
      ...(typeof bruto?.ajuda === "string" && bruto.ajuda.trim() ? { ajuda: bruto.ajuda.trim() } : {}),
      ...(typeof bruto?.unidade === "string" && bruto.unidade.trim() ? { unidade: bruto.unidade.trim() } : {}),
      ...(Array.isArray(bruto?.opcoes) ? { opcoes: bruto.opcoes as string[] } : {}),
      estado: bruto?.estado === "ativo" ? "ativo" : "rascunho",
    });
  }

  // Passa pelo leitor antes de gravar: ele é quem corta tamanho, descarta
  // "escolha" sem opção e aplica o teto de campos. Gravar a entrada crua
  // deixaria no banco o que a leitura depois descartaria — e o lojista veria
  // um campo sumir sem ninguém ter avisado nada.
  const campos = lerDefinicoes(entrada);
  if (campos.length < entrada.length) {
    return Response.json({ erro: "Algum campo ficou incompleto. Lista de opções precisa de ao menos uma opção." }, { status: 422 });
  }

  await prisma.tenant.update({
    where: { id: loja.id },
    data: { camposPersonalizados: campos as unknown as Prisma.InputJsonValue },
  });
  // A ficha do produto sai do catálogo em cache: sem isto, ativar um campo só
  // apareceria na loja quando o cache vencesse sozinho.
  invalidarCatalogo(loja.id);
  return Response.json({ campos });
}
