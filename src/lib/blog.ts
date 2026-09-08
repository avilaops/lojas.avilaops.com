/**
 * O blog da plataforma de lojas.
 *
 * Público: quem vende e ainda não vende pela internet. Não é o cliente final
 * do lojista; é o lojista. Por isso todo texto termina onde a plataforma
 * resolve o problema que ele acabou de descrever, e nenhum termina em "espero
 * ter ajudado".
 *
 * A pauta de um ano está em docs/CONTEUDO-365-DIAS.md, no monorepo.
 *
 * Regras de todo texto daqui:
 *
 * 1. A pergunta é respondida na primeira frase de `resposta`. Quem chegou pela
 *    busca quer a resposta, não a introdução.
 * 2. Exemplo brasileiro: Pix, Correios, Procon, CNPJ. Guia traduzido de artigo
 *    americano não ajuda quem vende em Ribeirão Preto.
 * 3. Nenhum cliente identificado sem autorização escrita.
 */
export type Post = {
  slug: string;
  title: string;
  description: string;
  /** Data de publicação (AAAA-MM-DD). Post com data futura não aparece. */
  publicadoEm: string;
  /** A resposta curta, antes de qualquer seção. */
  answer: string;
  sections: { title: string; body: string; checklist?: string[] }[];
  /** Slug de outro post, ou caminho da plataforma começando com "/". */
  related: string[];
  /**
   * Arte de compartilhamento, em `/media/blog/`. Sem ela o post entra no
   * WhatsApp e no LinkedIn como um bloco de texto sem imagem, que é o que
   * acontecia com os sete primeiros.
   */
  capa?: string;
};

export const POSTS: Post[] = [
  {
    slug: "o-que-e-loja-virtual",
    capa: "/media/blog/o-que-e-loja-virtual.jpg",
    title: "O que é uma loja virtual e o que ela faz que um catálogo não faz",
    description:
      "A diferença prática entre mostrar produto e vender produto: carrinho, frete calculado, pagamento e pedido registrado, com o que cada etapa resolve.",
    publicadoEm: "2026-09-01",
    answer:
      "Loja virtual é o site onde o cliente escolhe, calcula o frete, paga e recebe a confirmação sozinho, sem falar com ninguém. Catálogo online mostra produto e preço, mas termina em 'chama no WhatsApp'. A diferença não é visual: é quem faz o trabalho de fechar a venda. No catálogo é você, uma conversa por vez, no horário em que estiver acordado. Na loja é o site, em paralelo, de madrugada, no domingo.",
    sections: [
      {
        title: "O que o catálogo resolve bem",
        body: "Catálogo é barato, rápido de montar e funciona para quem vende poucos itens, com preço que muda por negociação, ou serviço que precisa de conversa antes do orçamento. Se cada venda sua exige entender a necessidade do cliente, o catálogo com botão de WhatsApp é honesto e suficiente. O erro é usar catálogo quando o produto é padronizado e o preço é o mesmo para todo mundo: aí a conversa não agrega nada e só atrasa.",
      },
      {
        title: "O que só a loja faz",
        body: "Quatro coisas que catálogo nenhum resolve: somar itens diferentes num pedido só, calcular frete pelo CEP antes de o cliente decidir, receber o pagamento na hora e registrar o pedido com endereço, itens e valores num lugar que você consulta depois. A quarta é a mais subestimada. Sem pedido registrado, seu histórico de vendas é uma conversa de WhatsApp que ninguém consegue somar no fim do mês.",
        checklist: [
          "Carrinho que junta vários produtos num pedido",
          "Frete calculado por CEP, antes do pagamento",
          "Pagamento por Pix, cartão ou boleto sem sair do site",
          "Pedido gravado com itens, endereço e valores",
          "Aviso automático para você e para o comprador",
        ],
      },
      {
        title: "O custo que ninguém soma antes",
        body: "Loja virtual não é só a plataforma. Entra a taxa do meio de pagamento em cada venda, a foto de cada produto, o tempo de cadastrar o catálogo, a embalagem medida para o frete não sair errado e alguém para separar e postar. Vale fazer essa conta antes, porque o preço mensal da plataforma costuma ser a menor parte dela. Quem descobre isso no meio do caminho normalmente para com a loja pela metade e volta para o WhatsApp.",
      },
      {
        title: "Quando começar por um e migrar para o outro",
        body: "Começar por catálogo e virar loja depois é um caminho legítimo, desde que o catálogo já use domínio próprio e o cadastro dos produtos seja aproveitável. O contrário costuma doer: quem monta loja completa sem ter fotos, descrição, peso e medida de cada produto acaba com uma loja bonita que não calcula frete e não aparece na busca. Comece pelo cadastro correto, mesmo que a venda ainda saia pelo WhatsApp.",
        checklist: [
          "Domínio próprio desde o primeiro dia",
          "Foto, descrição e preço de cada item",
          "Peso e medida da caixa de cada produto",
          "Política de troca e devolução escrita",
          "CNPJ e razão social visíveis no rodapé",
        ],
      },
    ],
    related: ["/criar", "/ajuda", "/#planos", "o-que-e-carrinho-de-compras"],
  },
  {
    slug: "o-que-e-carrinho-de-compras",
    capa: "/media/blog/o-que-e-carrinho-de-compras.jpg",
    title: "O que é carrinho de compras e por que ele existe",
    description:
      "Para que serve o carrinho numa loja virtual, por que ele aumenta o valor do pedido e o que fazer com quem enche o carrinho e vai embora.",
    publicadoEm: "2026-09-02",
    answer:
      "Carrinho é onde o cliente acumula produtos antes de pagar. Ele existe por uma razão comercial simples: sem carrinho, cada item é uma compra separada, com um frete cada. Com carrinho, o cliente que ia levar um leva três, paga um frete só e o seu pedido médio sobe sem que você tenha vendido nada a mais.",
    sections: [
      {
        title: "O carrinho é o que junta o frete",
        body: "Numa loja sem carrinho, comprar três produtos significa três pedidos e três fretes. Ninguém faz isso. O carrinho transforma o frete de obstáculo em incentivo: se falta pouco para o frete grátis, o cliente procura mais um item. Essa é a mecânica por trás de quase toda regra de 'frete grátis acima de R$ 150', e ela só funciona porque existe um lugar para acumular.",
      },
      {
        title: "O que o carrinho precisa mostrar",
        body: "Um carrinho que esconde informação atrasa a decisão e derruba a venda. Ele precisa mostrar cada item com foto e preço, permitir mudar a quantidade e remover, exibir o subtotal e, principalmente, calcular o frete antes de o cliente entrar na tela de pagamento. Frete que só aparece no fim é o motivo mais comum de abandono no Brasil, junto com o prazo de entrega que só aparece depois do cadastro.",
        checklist: [
          "Foto, nome e preço de cada item",
          "Botão claro de alterar quantidade e remover",
          "Subtotal atualizado a cada mudança",
          "Cálculo de frete por CEP dentro do carrinho",
          "Prazo de entrega junto do valor do frete",
        ],
      },
      {
        title: "Carrinho abandonado não é fracasso",
        body: "Muita gente enche o carrinho para simular o frete, comparar preço ou guardar para depois. Abandono alto não significa que a loja está quebrada; significa que parte das visitas ainda está pesquisando. O que importa é separar quem desistiu por preço, quem desistiu por frete e quem foi interrompido. O terceiro grupo volta com um lembrete simples. Os dois primeiros exigem mudar a oferta, não insistir na mensagem.",
      },
      {
        title: "Quando a loja não deveria ter carrinho",
        body: "Serviço com escopo variável, produto sob medida e venda que depende de consulta técnica não cabem em carrinho. Nesses casos o carrinho vira uma promessa que a operação não cumpre: o cliente fecha, paga, e alguém precisa ligar depois para dizer que o valor era outro. Nesse cenário, o caminho honesto é orçamento, e o site serve para qualificar antes da conversa.",
      },
    ],
    related: ["o-que-e-loja-virtual", "/criar", "o-que-e-checkout-da-loja", "/ajuda"],
  },
  {
    slug: "o-que-e-checkout-da-loja",
    capa: "/media/blog/o-que-e-checkout-da-loja.jpg",
    title: "O que é a tela de fechamento do pedido (checkout) e por que ela decide a venda",
    description:
      "O que acontece no checkout de uma loja virtual, quais campos derrubam a conversão e por que essa é a tela onde mais se perde dinheiro.",
    publicadoEm: "2026-09-03",
    answer:
      "Checkout é a tela final da compra, onde o cliente informa entrega e pagamento e confirma o pedido. Ela decide a venda porque é o único lugar da loja onde o cliente já quis comprar e ainda pode desistir. Todo obstáculo aqui custa dinheiro que já estava praticamente na mão: cadastro longo, frete surpresa, campo que recusa o CEP, forma de pagamento que falta.",
    sections: [
      {
        title: "O que o checkout pede, e por quê",
        body: "Ele pede quem é (nome, e-mail, telefone), para onde vai (endereço e CEP), como entrega (frete escolhido) e como paga. Cada campo além desses precisa se justificar. Perguntar CPF é comum e costuma ser exigência da emissão de nota ou do meio de pagamento, mas perguntar data de nascimento, sexo ou 'como conheceu a loja' na hora de pagar é trocar venda por dado que você provavelmente nunca vai usar.",
        checklist: [
          "Nome, e-mail e telefone",
          "CEP com preenchimento automático de rua, bairro e cidade",
          "Número e complemento separados",
          "Escolha de frete com prazo visível",
          "Forma de pagamento com Pix, cartão e boleto",
        ],
      },
      {
        title: "Comprar sem criar conta",
        body: "Obrigar cadastro antes de comprar é um dos custos mais caros e mais invisíveis de uma loja. O comprador de primeira viagem não quer criar senha para levar um produto de sessenta reais. A saída é deixar comprar como visitante e oferecer a conta depois da compra, quando ele já tem motivo para querer acompanhar o pedido. Você não perde o cadastro: o pedido já traz nome, e-mail, telefone e endereço.",
      },
      {
        title: "O que a loja precisa fazer se o pagamento não estiver pronto",
        body: "Loja sem credencial de pagamento configurada não deveria oferecer 'finalizar compra'. Parece óbvio, e é um erro comum: a vitrine fica pronta, alguém mostra para o cliente, ele escolhe o produto, preenche endereço e só no último passo aparece um aviso de que o pagamento ainda não foi configurado. Quem paga esse vexame é o lojista, na frente do cliente dele. O certo é a vitrine continuar inteira e o pedido sair por WhatsApp até a credencial existir.",
      },
      {
        title: "Onde olhar quando o checkout está perdendo gente",
        body: "Antes de mexer no visual, olhe três números: quantos chegam ao checkout, quantos escolhem frete e quantos concluem. A maior queda costuma estar entre chegar e escolher frete, e nesse caso o problema quase nunca é a tela. É o valor do frete, o prazo, ou a caixa padrão da loja cotando um produto pequeno como se fosse grande porque ninguém cadastrou as medidas.",
        checklist: [
          "Medir quantos entram e quantos concluem",
          "Conferir o frete cotado para os produtos mais vendidos",
          "Cadastrar peso e medida de cada produto",
          "Testar a compra inteira no celular, como cliente",
          "Conferir se aparece Pix, cartão e boleto",
        ],
      },
    ],
    related: ["o-que-e-carrinho-de-compras", "/criar", "quem-e-quem-no-pagamento-online", "o-que-e-loja-virtual"],
  },
  {
    slug: "quem-e-quem-no-pagamento-online",
    capa: "/media/blog/quem-e-quem-no-pagamento-online.jpg",
    title: "Quem é quem no pagamento online: loja, banco, bandeira e intermediário",
    description:
      "Quem participa de cada venda online no Brasil, o que cada um cobra e por que o dinheiro do cartão demora mais que o do Pix.",
    publicadoEm: "2026-09-04",
    answer:
      "Numa venda online participam quatro figuras: a sua loja, o intermediário de pagamento que processa a cobrança, a bandeira do cartão e o banco (o seu e o do cliente). No Pix a cadeia é curta e o dinheiro cai em minutos. No cartão ela é longa, cada elo cobra a sua parte e o recebimento demora. Entender isso muda o que você oferece na tela de pagamento.",
    sections: [
      {
        title: "O caminho do Pix",
        body: "O cliente paga, o banco dele conversa com o seu, e o dinheiro chega em segundos. O intermediário entra só para gerar o código e avisar a loja de que caiu. É por isso que o Pix costuma ser o meio mais barato para o lojista e o mais rápido para o caixa. A contrapartida é que ele não parcela e não tem o mesmo poder de compra por impulso que o cartão.",
      },
      {
        title: "O caminho do cartão",
        body: "O cliente digita o cartão, o intermediário manda para a bandeira, a bandeira consulta o banco emissor, o banco autoriza ou recusa, e só depois a loja recebe a confirmação. Cada um cobra: o intermediário pela transação, a bandeira pela rede, o emissor pelo risco. Além da taxa, existe o prazo: parcelado costuma cair mês a mês, e é por isso que uma loja pode vender bem e ficar sem caixa.",
        checklist: [
          "Saber a taxa por meio: Pix, débito, crédito à vista, crédito parcelado",
          "Saber o prazo de recebimento de cada um",
          "Conferir se o parcelamento tem juros para o cliente ou para você",
          "Somar as taxas do mês, não olhar só a de uma venda",
        ],
      },
      {
        title: "O boleto no meio do caminho",
        body: "Boleto ainda existe porque parte do público não tem cartão e não confia em pagar por aplicativo. Ele é barato por transação, mas tem duas características que atrapalham: só compensa em valores maiores e o cliente pode simplesmente não pagar. Boleto emitido não é venda; é intenção. Reserve estoque com cuidado e defina em quanto tempo o pedido cai por falta de pagamento.",
      },
      {
        title: "O erro mais comum na primeira configuração",
        body: "Quem segue tutorial normalmente copia a credencial de teste em vez da de produção. A loja funciona, a tela de pagamento aparece, o pedido é confirmado e nenhum centavo entra, porque tudo aconteceu em dinheiro de brinquedo. É um erro silencioso, que costuma ser descoberto no fim do mês. Antes da primeira venda de verdade, faça uma compra real de valor baixo, com um CPF diferente do titular da conta, e confira o dinheiro no extrato.",
      },
    ],
    related: ["para-que-serve-o-pix-na-loja", "o-que-e-gateway-de-pagamento", "/criar", "/#recursos"],
  },
  {
    slug: "para-que-serve-o-pix-na-loja",
    capa: "/media/blog/para-que-serve-o-pix-na-loja.jpg",
    title: "Para que serve o Pix numa loja e como o dinheiro chega até você",
    description:
      "Como funciona o Pix numa loja virtual, quanto tempo leva para o pedido ser confirmado e o que fazer quando o pagamento não cai.",
    publicadoEm: "2026-09-05",
    answer:
      "O Pix numa loja serve para receber à vista, com taxa baixa e confirmação em minutos. O cliente escolhe Pix, a loja gera um código com validade, ele paga pelo aplicativo do banco e o pagamento avisa a loja automaticamente, que então confirma o pedido e libera a separação. Nada disso depende de você conferir comprovante na mão.",
    sections: [
      {
        title: "O código tem prazo, e isso é bom",
        body: "O código Pix de uma compra costuma valer poucos minutos ou algumas horas. O prazo curto protege duas coisas: o preço, que pode mudar, e o estoque, que fica reservado enquanto o pedido está aberto. Prazo longo demais em loja pequena vira produto preso esperando alguém que já desistiu. Trinta minutos costuma ser suficiente para quem realmente vai pagar.",
      },
      {
        title: "Como a loja sabe que o dinheiro caiu",
        body: "O meio de pagamento envia um aviso automático para a loja assim que o Pix é compensado. Esse aviso é o que muda o pedido de 'aguardando pagamento' para 'pago'. Quando ele não está configurado, o pedido só é confirmado numa verificação periódica, e o cliente que pagou fica olhando uma tela dizendo que está pendente. É a origem da maior parte das mensagens de 'já paguei, e agora?'.",
        checklist: [
          "Configurar o aviso automático de pagamento",
          "Guardar o segredo que valida esse aviso",
          "Testar com uma compra real de valor baixo",
          "Definir em quanto tempo o pedido expira sem pagamento",
        ],
      },
      {
        title: "Comprovante não é pagamento",
        body: "Nunca libere pedido contra print de comprovante. O golpe do falso comprovante é rotina no comércio pequeno, e a imagem enviada pelo WhatsApp é trivial de forjar. Quem confirma o pagamento é o extrato ou o aviso automático da loja, nunca a captura de tela mandada pelo comprador. Vale escrever essa regra para a equipe, porque na correria a tendência é aceitar para não parecer desconfiado.",
      },
      {
        title: "Pix não elimina a conciliação",
        body: "Receber rápido não é o mesmo que saber o que entrou. Ao fim do mês você ainda precisa cruzar pedidos com recebimentos, achar o que foi estornado, o que foi pago duas vezes e o que foi pago fora do sistema. Loja pequena resolve isso com um relatório mensal simples. O que não funciona é conferir a conta pela memória, que é o método mais comum e o mais caro.",
      },
    ],
    related: ["quem-e-quem-no-pagamento-online", "/#recursos", "/criar", "o-que-e-gateway-de-pagamento"],
  },
  {
    slug: "o-que-e-gateway-de-pagamento",
    capa: "/media/blog/o-que-e-gateway-de-pagamento.jpg",
    title: "O que é o intermediário de pagamento (gateway) e quanto ele cobra",
    description:
      "O que faz o intermediário de pagamento de uma loja virtual, quais taxas ele cobra e o que olhar antes de escolher um.",
    publicadoEm: "2026-09-06",
    answer:
      "O intermediário de pagamento, conhecido no mercado pelo termo em inglês gateway, é a empresa que processa a cobrança da sua loja: gera o Pix, fala com a bandeira do cartão, valida o boleto e avisa a loja quando o dinheiro entra. Ele cobra por transação, com percentual que muda conforme o meio de pagamento e o prazo em que você quer receber.",
    sections: [
      {
        title: "O que ele faz por você",
        body: "Sem intermediário, aceitar cartão exigiria contrato direto com bandeiras e adquirentes, além de responsabilidade sobre dados de cartão, que é um assunto de segurança pesado. O intermediário concentra isso: um contrato, uma integração, todos os meios de pagamento. Em troca, ele cobra por venda. Para negócio pequeno, essa troca compensa quase sempre.",
      },
      {
        title: "As taxas que existem de verdade",
        body: "Olhe quatro números, não um: a taxa do Pix, a do cartão de débito, a do crédito à vista e a do crédito parcelado. Some ainda o custo de antecipar, se você pretende receber antes do prazo. O anúncio costuma mostrar a menor delas. A conta que importa é a taxa média ponderada pelo que a sua loja realmente vende, e essa só aparece depois de um mês de operação.",
        checklist: [
          "Taxa por meio de pagamento, não a taxa de vitrine",
          "Prazo de recebimento de cada meio",
          "Custo de antecipação, se for usar",
          "Existência de mensalidade ou taxa de saque",
          "Quem responde quando um pagamento some",
        ],
      },
      {
        title: "Onde o dinheiro cai",
        body: "Verifique se o dinheiro cai direto na conta da sua empresa ou fica numa carteira do intermediário até você sacar. Os dois modelos são comuns e legítimos, mas mudam o seu fluxo de caixa e a burocracia do fim do mês. Também confira se a conta está no CNPJ certo: conta pessoal recebendo venda de empresa é um problema contábil que aparece tarde e dá trabalho.",
      },
      {
        title: "Trocar de intermediário depois é caro",
        body: "Migrar significa reconfigurar a loja, refazer o aviso automático de pagamento, remontar as assinaturas recorrentes se houver e conviver com um período em que pedidos antigos e novos vivem em sistemas diferentes. Não é impossível, mas é o tipo de trabalho que ninguém orça. Vale gastar uma tarde comparando antes, em vez de escolher pelo primeiro tutorial que aparecer.",
      },
    ],
    related: ["quem-e-quem-no-pagamento-online", "para-que-serve-o-pix-na-loja", "/criar", "o-que-e-checkout-da-loja"],
  },
  {
    slug: "o-que-e-sku",
    capa: "/media/blog/o-que-e-sku.jpg",
    title: "O que é SKU, o código interno de cada produto",
    description:
      "Para que serve o SKU numa loja, como criar um código que se entende sozinho e por que ele evita erro de envio e de estoque.",
    publicadoEm: "2026-09-07",
    answer:
      "SKU é o código que identifica cada produto dentro da sua operação. A sigla vem do inglês (unidade de manutenção de estoque), mas a função é simples: dar a cada item, e a cada variação de item, um nome curto e único que serve para conferir, contar, separar e importar planilha sem duplicar cadastro.",
    sections: [
      {
        title: "Por que o nome do produto não basta",
        body: "Nome muda. 'Camiseta Branca P' pode virar 'Camiseta Básica Branca Tamanho P' quando alguém resolve melhorar a descrição, e nesse momento qualquer planilha antiga deixa de casar com o cadastro. O SKU não muda. É por isso que ele é a chave usada na importação: com SKU, reimportar a planilha atualiza o produto; sem SKU, cria um segundo cadastro igual, com estoque separado.",
      },
      {
        title: "Como montar um código que se lê sozinho",
        body: "Use partes com significado, separadas por hífen, em maiúsculas, sem acento e sem espaço. Uma estrutura que funciona é marca, produto, variação. 'MICH-CTX-27518' diz muito mais em conferência do que '00417'. Evite números sequenciais puros: eles não ajudam quem está no depósito com a caixa na mão, que é exatamente onde o SKU precisa funcionar.",
        checklist: [
          "Só letras, números e hífen",
          "Sem acento, espaço ou barra",
          "Partes com significado: marca, produto, variação",
          "Único em toda a loja, inclusive entre variações",
          "O mesmo código no site, na planilha e na prateleira",
        ],
      },
      {
        title: "Variação também tem SKU",
        body: "Camiseta P, M e G são três unidades de estoque, não uma. Se as três dividirem o mesmo código, o sistema não consegue dizer que acabou o M enquanto sobra G, e a loja continua vendendo um tamanho que você não tem. Cada combinação de tamanho, cor ou voltagem precisa do seu próprio código, normalmente o código do produto mais um sufixo.",
      },
      {
        title: "O código do fabricante não é o seu SKU",
        body: "Guarde os dois. O código do fabricante serve para comprar, comparar e achar equivalência entre peças. O seu SKU serve para a sua operação, e continua valendo se você trocar de fornecedor ou se o fabricante mudar a numeração. Confundir os dois é o motivo comum de um mesmo produto entrar duas vezes no catálogo com nomes ligeiramente diferentes.",
      },
    ],
    related: ["o-que-e-loja-virtual", "/criar", "/ajuda", "o-que-e-checkout-da-loja"],
  },
];

const hoje = () => new Date().toISOString().slice(0, 10);

/**
 * Os posts que já podem aparecer.
 *
 * A pauta é de um post por dia, e a data faz esse trabalho sozinha: o texto
 * entra escrito com a data em que deve aparecer e fica invisível até lá. Assim
 * dá para escrever a semana inteira numa tarde sem publicar tudo de uma vez,
 * que é o único jeito de sustentar um ritmo diário.
 */
export function postsPublicados(): Post[] {
  const limite = hoje();
  return POSTS.filter((p) => p.publicadoEm <= limite).sort((a, b) => b.publicadoEm.localeCompare(a.publicadoEm));
}

export function acharPost(slug: string): Post | undefined {
  return postsPublicados().find((p) => p.slug === slug);
}

/** Só o que é post de verdade; caminho da plataforma passa direto. */
export function tituloDoRelacionado(alvo: string): string | null {
  if (alvo.startsWith("/")) return null;
  return POSTS.find((p) => p.slug === alvo)?.title ?? null;
}

/** Seis cores, rotativas pela ordem de publicação. A página do texto usa a
 *  mesma do cartão de onde o leitor veio, senão a troca de tela parece um
 *  site diferente. */
export function corDoPost(slug: string): number {
  const i = POSTS.findIndex((p) => p.slug === slug);
  return (i < 0 ? 0 : i) % 6;
}
