import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BookOpen, Check } from "lucide-react";

export const metadata: Metadata = {
  title: "Ajuda — como cadastrar a loja, categorias, produtos e pedidos | Lojas Avila Ops",
  description:
    "Passo a passo da plataforma Lojas Avila Ops: criar a loja, marca, categorias, produtos (um a um ou por planilha), publicar, pedidos e erros comuns. Na linguagem de quem vende, sem termo técnico.",
  alternates: { canonical: "https://lojas.avilaops.com/ajuda" },
};

/**
 * Tutorial da plataforma, um capítulo por tela, no máximo cinco passos cada.
 * Pedido do Nicolas em 28/08/2026: onboarding sem chamada de vídeo a cada
 * cliente. Texto na linguagem do lojista; o que é técnico fica fora.
 */
const CAPITULOS = [
  {
    id: "criar",
    titulo: "1. Criar a loja",
    resumo: "Dez minutos no estúdio. A loja entra no ar no mesmo dia.",
    passos: [
      "Abra lojas.avilaops.com/criar. São cinco etapas curtas: Negócio, Essência, Direção de marca, Operação e a conclusão, onde você cria a senha.",
      "Em Negócio, informe o nome da loja, o segmento, o seu e-mail (é o seu login), o WhatsApp da loja e o plano. O WhatsApp é obrigatório: é por ele que avisamos pedido pago.",
      "Em Essência e Direção de marca, responda para quem você vende e o que te diferencia. A plataforma monta cores, fonte e layout a partir disso; tudo pode ser trocado depois.",
      "Em Operação, informe o CEP de onde os pedidos saem, se tem retirada na loja e em quantos dias despacha. Se já tiver uma planilha de produtos, envie aqui; se não, cadastre depois.",
      "Na conclusão, crie a senha. Sua loja responde em seunome.lojas.avilaops.com na hora, com SSL. Você tem 14 dias de teste; a mensalidade começa quando a loja entra no ar de verdade.",
    ],
    dica: "Domínio próprio (sualoja.com.br) é do plano Loja Pro. A Avila Ops registra e configura; você não mexe em DNS.",
  },
  {
    id: "marca",
    titulo: "2. Marca: logo, cores e layout",
    resumo: "Aba Marca do painel. É o que o cliente vê primeiro.",
    passos: [
      "Entre em lojas.avilaops.com/entrar com o e-mail e a senha que você criou. O painel abre na Visão geral; clique em Marca.",
      "Logo: envie um PNG ou SVG com fundo transparente, de preferência com pelo menos 512 px de largura. Ele aparece no topo da loja, no ícone da aba do navegador e ao compartilhar links.",
      "Cor principal e layout: escolha entre sete composições (Clássico, Vitrine, Editorial, Minimal, Spotlight, Mercado e Conversão). A prévia mostra como fica; salve e abra a loja no celular para conferir.",
      "Aviso no topo: uma frase curta que aparece em toda página (\"Frete grátis acima de R$ 150\", \"Pedidos até 16h saem no mesmo dia\"). Deixe vazio para não mostrar.",
      "Em Conta → Dados da empresa, informe razão social e CNPJ. Eles entram sozinhos no rodapé e nas políticas; é exigência da lei do comércio eletrônico.",
    ],
    dica: "Foto do WhatsApp e endereço também ficam na aba Marca. O endereço só aparece na loja se você marcar \"endereço público\".",
  },
  {
    id: "categorias",
    titulo: "3. Categorias",
    resumo: "Menu da loja. Poucas e claras vendem mais do que muitas.",
    passos: [
      "Na aba Produtos, abra Categorias e clique em Nova categoria. Nome curto, como o cliente fala: \"Pneus\", \"Capacetes\", \"Ração\".",
      "Arraste para ordenar. A ordem aqui é a ordem do menu da loja.",
      "Imagem da categoria é opcional; se colocar, use uma foto quadrada de um produto típico.",
      "Para apagar, a categoria precisa estar sem produtos: mova os produtos antes.",
      "O texto de busca (título e descrição para o Google) de cada categoria é gerado de madrugada e pode ser revisado no próprio cadastro da categoria.",
    ],
    dica: "Se a loja vende peças de moto, o segmento Motopeças liga a garagem: o cliente escolhe a moto e só vê o que serve nela.",
  },
  {
    id: "produtos",
    titulo: "4. Produtos: um a um ou por planilha",
    resumo: "Nome, foto e preço já vendem. O resto é ganho.",
    passos: [
      "Um a um: aba Produtos → Novo produto. Preencha nome, categoria, preço e estoque. Preço anterior (\"de R$ 99 por R$ 79\") aparece riscado na loja.",
      "Fotos: envie até dez. Use \"Tratar com IA\" para recortar o produto e deixar o fundo branco; assim todo o catálogo fica igual, mesmo com foto de celular. A primeira foto é a da vitrine.",
      "Variações (tamanho, cor, voltagem): até três opções. A plataforma monta a grade e você informa preço e estoque de cada combinação.",
      "Por planilha: baixe o modelo CSV no painel, preencha e envie. Colunas aceitas: nome, categoria, marca, sku, preco, preco_de, descricao_curta, descricao, imagem, destaque, peso_kg. Só nome e preco são obrigatórios; preço no formato 59,90.",
      "Estoque: quando zera, o produto some do carrinho e ganha o botão \"Avise-me quando chegar\". Ao repor, quem pediu aviso recebe e-mail sozinho.",
    ],
    dica: "Peso e medidas da embalagem deixam o frete exato. Sem eles, a plataforma usa o peso padrão da loja.",
  },
  {
    id: "publicar",
    titulo: "5. Subir para o site e aparecer no Google",
    resumo: "Produto ativo aparece na hora. O Google leva dias.",
    passos: [
      "Todo produto marcado como ativo aparece na loja no momento em que você salva. Para tirar do ar, desmarque \"ativo\"; para apagar de vez, use Apagar.",
      "Abra a loja no celular e faça um pedido de teste até a tela do Pix. É o caminho que o seu cliente vai fazer.",
      "Google: o mapa do site (sitemap) é gerado sozinho e a plataforma avisa os buscadores quando algo muda. Na aba Buscadores você acompanha o que já foi enviado.",
      "Google Shopping, Instagram e TikTok: na aba Anúncios está o endereço do catálogo da sua loja. Cole nas contas de anúncio e os produtos entram com preço e foto.",
      "Aparecer no Google leva de dias a semanas e depende de conteúdo: descrições reais, categorias claras e fotos boas contam mais do que qualquer ajuste técnico.",
    ],
    dica: "Compartilhe o link da loja no WhatsApp e no Instagram: a prévia já sai com a sua logo e a sua cor.",
  },
  {
    id: "pedidos",
    titulo: "6. Pedidos: do Pix à entrega",
    resumo: "Você recebe no WhatsApp. O resto é clicar.",
    passos: [
      "Pedido pago chega no WhatsApp da loja com itens, valor e endereço. O cliente recebe a confirmação por e-mail.",
      "Na aba Pedidos, clique em Separar quando começar a montar o pacote.",
      "Frete pelos Correios ou transportadora: na aba Entrega você emite a etiqueta com o valor já cotado; o código de rastreio entra sozinho no pedido.",
      "Clique em Marcar enviado (com o código de rastreio, se houver). O cliente recebe o e-mail com o rastreio e o link para acompanhar.",
      "Ao entregar, Marcar entregue. Na Visão geral você vê a receita dos últimos 30 dias, os mais vendidos e o que ainda falta separar.",
    ],
    dica: "Pix não pago em 30 minutos vira um lembrete automático para o cliente. Carrinho abandonado também recebe um aviso.",
  },
  {
    id: "erros",
    titulo: "7. Erros comuns e como resolver",
    resumo: "Os cinco que mais aparecem no suporte.",
    passos: [
      "Foto ruim: fotografe o produto sozinho, com luz do dia, e use \"Tratar com IA\". Foto de catálogo do fabricante também serve, desde que seja do produto certo.",
      "Produto sem categoria: ele existe, mas não está no menu. Edite o produto e escolha a categoria.",
      "Preço zerado ou errado: na planilha, o preço precisa vir como 59,90 (com vírgula) ou 59.90. Confira a coluna preco antes de enviar.",
      "Checkout sumiu da loja: a mensalidade está em atraso. Na aba Assinatura você cadastra o cartão e a loja volta a vender na hora.",
      "Domínio próprio não abre: é do plano Loja Pro e leva até 48 h para o DNS propagar depois que a Avila Ops configura. Enquanto isso, seunome.lojas.avilaops.com continua funcionando.",
    ],
    dica: "Não achou aqui? Fale com a Avila Ops pelo WhatsApp que consta no rodapé do painel. Respondemos em horário comercial.",
  },
] as const;

export default function Ajuda() {
  return (
    <div className="pl-site pl-ajuda">
      <section className="pl-secao">
        <div className="pl-container">
          <header className="pl-secao-cabecalho">
            <div>
              <span className="pl-kicker"><BookOpen size={14} /> Ajuda</span>
              <h1>Da loja vazia ao primeiro pedido, em sete capítulos.</h1>
            </div>
            <p>Cada capítulo é uma tela do painel, com no máximo cinco passos. Leia no celular, com o painel aberto do lado.</p>
          </header>

          <nav className="pl-ajuda-indice" aria-label="Capítulos">
            {CAPITULOS.map((c) => (
              <a key={c.id} href={`#${c.id}`}><strong>{c.titulo}</strong><span>{c.resumo}</span></a>
            ))}
          </nav>

          {CAPITULOS.map((c) => (
            <article key={c.id} id={c.id} className="pl-ajuda-capitulo">
              <h2>{c.titulo}</h2>
              <p className="pl-ajuda-resumo">{c.resumo}</p>
              <ol>
                {c.passos.map((p, i) => (
                  <li key={i}><span>{i + 1}</span><p>{p}</p></li>
                ))}
              </ol>
              <p className="pl-ajuda-dica"><Check size={15} /> {c.dica}</p>
            </article>
          ))}

          <div className="pl-ajuda-rodape">
            <p>Ainda não tem loja?</p>
            <Link href="/criar" className="pl-botao pl-botao-primario">Criar minha loja <ArrowRight size={17} /></Link>
            <Link href="/entrar" className="pl-link">Já tenho: entrar no painel <ArrowRight size={16} /></Link>
          </div>
        </div>
      </section>
    </div>
  );
}
