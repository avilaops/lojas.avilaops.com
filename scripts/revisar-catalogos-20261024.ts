import fs from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { prisma } from "../src/lib/db";
import { salvarProdutoNoCatalogo } from "../src/lib/catalogo-escrita";

const aplicar = process.argv.includes("--apply");
const origem = "revisao-documentada-2026-10-24";
const ilumi = "https://www.ilumi.com.br/produto/extensao-compacta-2p-bipolar-com-cordao-paralelo-10a-250v-3m-colorido/";
const fita3m = "https://www.3m.com.br/3M/pt_BR/p/d/v000452837/";
const vonder = "https://www.vonder.com.br/produto/macaco_hidrulico_tipo_garrafa_12_toneladas_12_tf_vonder/9027";
const skf = "https://www.skf.com/binaries/pub12/Images/0901d196803969af-13186_1-EN-SKF-bearing-housings-and-roller-bearing-units_tcm_12-315185.pdf";
const correntes = "https://www.engredan.com.br/catalogos";
// O ERP pode reutilizar SKUs. A identidade revisada também deve coincidir.
const nomesOriginais: Record<string, string> = {
  "1733": "115/100", "1726": "Mangueira IBIRA EIRA Trançada 2 POL",
  "2551": "O LA Compel 09CM", "2984": "Pilha Rayovac Alcalina. MD C/02",
  "4853": "Escova Tubular (M) 3\"", "2380": "Fita Guia LISA Teflon com Bronze 10x2.5",
  "5575": "Fita Isolante 3M Imperial 18MMX10M", "3001": "Toalha Umed.prem B.club PACK 240F",
  "1632": "VONDER Macaco Garrafa 12TON", "2547": "Carga GAS P/MACAR/FOG Original 227G",
  "2555": "CREO Linhal 900 ml", "5341": "Emenda para Mangueira",
  "2538": "Ext.ilumi PL 03 MTS branca 17911", "2381": "KIT da Propulsora",
  "3742": "Tampa NBR 47x7", "2265": "Tesoura P/CHAPA Aviac.mtx RETA",
  "3582": "ORION Reparo Motor Danfoss OMS 160",
};

const editoriais: Record<string, { nome: string; descricao: string; marca?: string; fonte?: string; atributos?: Record<string, unknown> }> = {
  "1733": { nome: "Anel de bloqueio FRB 11,5/100", fonte: skf, descricao: "Anel de bloqueio para posicionamento axial de rolamentos em caixas de mancal. Designação FRB 11,5/100: largura de 11,5 mm e diâmetro externo de 100 mm. Confira a designação exigida pela caixa de mancal e a marca do item antes da compra.", atributos: { tipo: "Anel de bloqueio para caixa de mancal", larguraMm: 11.5, diametroExternoMm: 100 } },
  "1726": { nome: "Mangueira trançada Ibirá 2 polegadas", marca: "Ibirá", descricao: "Mangueira trançada de 2 polegadas, marca Ibirá, comercializada por metro conforme o cadastro. Antes de selecionar para uma instalação, confira na gravação da mangueira a pressão de trabalho, a temperatura e o fluido permitido. A medida nominal não substitui a conferência da conexão." },
  "2551": { nome: "Rolo de lã Compel 9 cm", marca: "Compel", descricao: "Rolo de lã para pintura com largura de 9 cm, marca Compel. Confira a compatibilidade da tinta e o acabamento indicado para o revestimento do rolo. O cadastro não identifica o código do fabricante nem confirma se o suporte acompanha o produto.", atributos: { larguraMm: 90, tipo: "Rolo de lã para pintura" } },
  "2984": { nome: "Pilha alcalina Rayovac média — cartela com 2 unidades", marca: "Rayovac", descricao: "Cartela com duas pilhas alcalinas Rayovac de tamanho médio. Confira no aparelho a designação e a polaridade antes de instalar. Não misture pilhas novas e usadas, nem tipos diferentes no mesmo aparelho. Não recarregue pilhas alcalinas descartáveis." },
  "4853": { nome: "Escova tubular 3 polegadas", descricao: "Escova de formato tubular identificada no cadastro pela medida nominal de 3 polegadas. Confira o material das cerdas, a fixação e o diâmetro efetivo antes de escolher para limpeza ou acabamento. O cadastro não informa rotação máxima: não presuma compatibilidade com ferramenta motorizada." },
  "2380": { nome: "Fita guia lisa de PTFE com bronze 10 × 2,5 mm", descricao: "Fita guia lisa de PTFE com bronze, largura de 10 mm e espessura de 2,5 mm. Elemento de guiamento para montagem em alojamento compatível. Comercializada por metro conforme o cadastro. Confira o alojamento, a folga e a especificação de material exigidos pelo equipamento antes de comprar.", atributos: { larguraMm: 10, espessuraMm: 2.5, material: "PTFE com bronze", tipo: "Fita guia lisa" } },
  "5575": { nome: "Fita isolante 3M Imperial 18 mm × 10 m", marca: "3M", fonte: fita3m, descricao: "Fita isolante de PVC da linha 3M Imperial, com 18 mm de largura e 10 m de comprimento. Indicada para isolamento, identificação e amarração de cabos, conforme a aplicação e as orientações do fabricante. Confira a cor da unidade disponível antes da compra.", atributos: { larguraMm: 18, comprimentoTotalM: 10, material: "PVC", linha: "Imperial" } },
  "3001": { nome: "Toalhas umedecidas Premium B.Club — pacote com 240 folhas", descricao: "Pacote de toalhas umedecidas identificado no cadastro como Premium B.Club, com 240 folhas. Confira a finalidade, a composição e as restrições descritas na embalagem. Não presuma indicação para pele, superfícies específicas ou ação desinfetante sem confirmação no rótulo.", atributos: { quantidadeFolhas: 240 } },
  "1632": { nome: "Macaco hidráulico tipo garrafa Vonder 12 toneladas", marca: "Vonder", fonte: vonder, descricao: "Macaco hidráulico tipo garrafa Vonder com capacidade nominal de 12 toneladas. Para elevação de veículos e cargas dentro da capacidade indicada pelo fabricante. Use sobre base firme e nivelada. Nunca permaneça sob uma carga sustentada apenas pelo macaco: utilize cavaletes adequados. Confira o modelo e o manual antes de operar.", atributos: { capacidadeCargaToneladas: 12, tipo: "Macaco hidráulico tipo garrafa" } },
  "2547": { nome: "Cartucho de gás para maçarico ou fogareiro 227 g", descricao: "Cartucho de gás de 227 g identificado no cadastro para maçarico ou fogareiro. Confira o tipo de válvula e a compatibilidade declarada no equipamento e no cartucho antes de conectar. Mantenha afastado de calor e chamas durante a troca. Não perfure nem exponha o recipiente ao aquecimento.", atributos: { conteudoLiquidoG: 227 } },
  "2555": { nome: "Creo Linhal 900 mL", descricao: "Produto identificado no cadastro como Creo Linhal, em apresentação de 900 mL. Confira a formulação e a finalidade no rótulo do frasco. Sem ficha técnica do item exato, não se declara ação desinfetante, diluição ou indicação para uso em animais.", atributos: { apresentacaoComercial: "900 mL" } },
  "5341": { nome: "Emenda para mangueira", descricao: "Conexão para unir mangueiras compatíveis. Antes de comprar, confirme o diâmetro, o tipo de encaixe e a adequação do material ao fluido e à pressão da instalação. A medida e o material desta unidade precisam ser conferidos com a loja." },
  "2538": { nome: "Extensão compacta Ilumi 17911 branca 3 m — 2P 10 A 250 V", marca: "Ilumi", fonte: ilumi, descricao: "Extensão compacta Ilumi modelo 17911, branca, com cordão paralelo de 3 metros e conexão bipolar 2P. Corrente máxima do conjunto de 10 A e tensão nominal de 250 V. Verifique a potência total dos aparelhos e respeite o limite do conjunto. A conexão 2P não oferece condutor de aterramento.", atributos: { modelo: "17911", cor: "Branco", comprimentoTotalM: 3, correnteMaxima: "10 A", tensaoNominal: "250 V", polos: "2P" } },
  "2381": { nome: "Kit de reparo para propulsora", descricao: "Kit identificado no cadastro para reparo de propulsora. Referência interna 25202. Confira com a loja o fabricante, o modelo e a relação de componentes da propulsora antes da compra; o nome do kit sozinho não confirma compatibilidade." },
  "3742": { nome: "Tampa de vedação NBR 47 × 7 mm", descricao: "Tampa de vedação em NBR identificada pela medida nominal de 47 × 7 mm. Confira o diâmetro do alojamento, a profundidade e o perfil da tampa existente antes de comprar. A designação não deve ser interpretada como diâmetro interno de um anel.", atributos: { diametroExternoMm: 47, alturaMm: 7, tipo: "Tampa de vedação" } },
  "2265": { nome: "Tesoura para chapa tipo aviação MTX — corte reto", marca: "MTX", descricao: "Tesoura para corte de chapa, tipo aviação, com corte reto, marca MTX. Confira o modelo, o material e a espessura máxima de corte indicados na embalagem antes de usar. Utilize proteção para as mãos e para os olhos durante o manuseio de chapas." },
  "3582": { nome: "Kit de reparo Orion para motor Danfoss OMS 160", marca: "Orion", descricao: "Kit de reparo Orion identificado no cadastro para motor hidráulico Danfoss OMS 160, referência DAN.1902233.1. Compare a identificação completa do motor e o conjunto de componentes antes de comprar. A identificação OMS 160 não confirma, sozinha, todas as variantes e revisões do motor." },
};

async function main() {
  const planos: Array<{ tenantId: string; loja: string; id: string; sku: string | null; versao: number; antes: unknown; campos: Parameters<typeof salvarProdutoNoCatalogo>[2] }> = [];
  for (const slug of ["domi-rio", "vedashow"]) {
    const t = await prisma.tenant.findUniqueOrThrow({ where: { slug } });
    const produtos = await prisma.produto.findMany({ where: { tenantId: t.id }, include: { categoria: true } });
    const categoriaCorrente = await prisma.categoria.findFirst({ where: { tenantId: t.id, slug: "corrente" } });
    for (const p of produtos) {
      const a = { ...(p.atributos as Record<string, unknown>) };
      const campos: Parameters<typeof salvarProdutoNoCatalogo>[2] = {};
      if (slug === "domi-rio") {
        if (a.fonte_tecnica) { a._fonteTecnicaVerificada = a.fonte_tecnica; delete a.fonte_tecnica; }
        delete a.apresentacoes_fabricante;
        const apresentacao = /(?:^|[- ])(\d+(?:[.,]\d+)?)\s*(m[lL]|[lL]|[kK][gG]|[gG][rR]?)(?:\b|$)/.exec(p.nome);
        const multipla = /(\d+)\s*(?:un\s*)?x\s*(\d+(?:[.,]\d+)?)\s*(ml|g|gr)\b/i.exec(p.nome);
        if (!a.apresentacaoComercial && multipla) a.apresentacaoComercial = `${multipla[1]} unidades de ${multipla[2]} ${multipla[3].toLowerCase() === "ml" ? "mL" : "g"}`;
        else if (!a.apresentacaoComercial && apresentacao && !/\b(?:cx|kits?|display)\b/i.test(p.nome)) a.apresentacaoComercial = `${apresentacao[1]} ${apresentacao[2].toLowerCase() === "ml" ? "mL" : apresentacao[2].toLowerCase() === "l" ? "L" : apresentacao[2].toLowerCase().replace("gr", "g")}`;
        // Peso bruto abaixo do conteúdo líquido é impossível; 1050 kg em um
        // frasco de 1 L é erro, mas não autoriza inventar o peso correto.
        if ((p.sku === "ISO095" && /termitox.*1\s*l\b/i.test(p.nome) && (p.pesoKg ?? 0) > 100) || (["ISO334", "ISO335"].includes(p.sku ?? "") && /1\s*kg\b/i.test(p.nome) && p.pesoKg != null && p.pesoKg < 1)) {
          campos.pesoKg = null;
          a._pendenciaPeso = "Peso anterior incompatível com a apresentação; pesar a embalagem de envio.";
        }
        if (!p.imagens.length && typeof a.familia === "string") {
          const modelo = produtos.find(x => x.imagens.length && (x.atributos as Record<string, unknown>).familia === a.familia && x.imagemOrigem === "representativa");
          if (modelo) { campos.imagens = modelo.imagens.slice(0, 1); campos.imagemOrigem = "representativa"; campos.imagemFamilia = a.familia; }
        }
      } else {
        const editorial = p.sku ? editoriais[p.sku] : undefined;
        if (editorial && !p.descricao && p.nome === nomesOriginais[p.sku!]) {
          campos.nome = editorial.nome;
          campos.descricao = editorial.descricao;
          campos.descricaoCurta = editorial.descricao.split(". ")[0].slice(0, 280);
          if (editorial.marca) campos.marca = editorial.marca;
          Object.assign(a, editorial.atributos);
          if (p.sku === "2380" || p.sku === "3742") delete a.diametroInternoMm;
          a._revisaoFonte = editorial.fonte ?? "Nome e dados explícitos do cadastro original; identidade completa não confirmada externamente.";
        }
        if (/^REDUÇÃO (?:PASSO LONGO )?ANSI .*COMBAT$/i.test(p.nome) && /alicate/i.test(`${p.descricao} ${p.descricaoCurta}`)) {
          const codigo = p.nome.match(/ANSI\s+(\S+)/i)![1];
          campos.nome = `Emenda de redução para corrente ANSI ${codigo} Combat`;
          campos.marca = "Combat";
          campos.descricaoCurta = `Emenda de redução Combat para corrente identificada como ANSI ${codigo}.`;
          campos.descricao = `Emenda de redução para corrente de transmissão, marca Combat, designação ANSI ${codigo}. Confira a designação completa, o passo e a quantidade de fileiras da corrente antes da montagem.`;
          if (categoriaCorrente) campos.categoriaId = categoriaCorrente.id;
          for (const k of Object.keys(a)) if (!k.startsWith("_") && !["unidade", "grupoLegado"].includes(k)) delete a[k];
          a.tipo = "Emenda de redução para corrente"; a.designacao = `ANSI ${codigo}`; a._revisaoFonte = correntes;
          a._pendenciaNcm = "Classificação anterior associada a alicates; confirmar classificação da corrente.";
          campos.ncm = null;
          campos.gtin = null;
          campos.pesoKg = null;
          campos.alturaCm = null;
          campos.larguraCm = null;
          campos.comprimentoCm = null;
          a._pendenciaIdentificacao = "GTIN e embalagem do cadastro de alicate removidos; conferir o item físico.";
          // Imagens e identificadores de outro tipo de item não podem
          // continuar vinculados à oferta corrigida.
          if (p.imagens.length) campos.imagens = [];
        }
      }
      if (!isDeepStrictEqual(a, p.atributos)) campos.atributos = JSON.parse(JSON.stringify(a));
      if (!Object.keys(campos).length) continue;
      planos.push({ tenantId: t.id, loja: slug, id: p.id, sku: p.sku, versao: p.versaoCatalogo, antes: p, campos });
    }
  }
  const dir = process.env.REVISAO_OUTPUT ?? "output/revisao-catalogos-20261024";
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const arquivo = path.join(dir, `plano-${Date.now()}.json`);
  await fs.writeFile(arquivo, JSON.stringify(planos, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ modo: aplicar ? "aplicar" : "simular", arquivo, total: planos.length, porLoja: Object.fromEntries(["domi-rio", "vedashow"].map(s => [s, planos.filter(p => p.loja === s).length])) }));
  if (!aplicar) return;
  for (const item of planos) {
    await salvarProdutoNoCatalogo(item.tenantId, item.id, item.campos, { origem, versao: item.versao });
    const salvo = await prisma.produto.findFirstOrThrow({ where: { tenantId: item.tenantId, id: item.id } });
    for (const [campo, valor] of Object.entries(item.campos)) if (!isDeepStrictEqual(salvo[campo as keyof typeof salvo], valor)) throw new Error(`Divergência após escrita: ${item.loja}/${item.sku}/${campo}`);
    await fs.appendFile(path.join(dir, "resultado.jsonl"), JSON.stringify({ loja: item.loja, sku: item.sku, id: item.id, versao: salvo.versaoCatalogo, campos: Object.keys(item.campos) }) + "\n", { mode: 0o600 });
  }
  console.log(JSON.stringify({ atualizado: planos.length, verificacao: "campos relidos e conferidos" }));
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
