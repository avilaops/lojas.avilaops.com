import assert from "node:assert/strict";
import { test } from "node:test";
import { brl, DadosInsuficientes, emailDoEvento, escapar } from "./emails-do-evento";
import { CANAIS_POR_TIPO, TIPOS_EXECUTAVEIS } from "./acoes-do-evento";

// `toLocaleString` separa "R$" do número com espaço não separável (U+00A0), não com
// espaço comum: comparar com "R$ 129,90" digitado à mão falha sem ninguém
// entender por quê. As asserções usam o mesmo formatador da tela.

const lojista = {
  lojaNome: "Padaria Aurora",
  lojaUrl: "https://padariaaurora.example",
  lojistaEmail: "contato@padariaaurora.example",
  emailRemetente: "pedidos@padariaaurora.example",
};

test("tipo que manda WhatsApp declara o canal, senão sai metade do aviso", () => {
  // Um tipo com WhatsApp declarado só é executado aqui quando o token existe;
  // declarar só "email" faria o aviso do lojista sumir sem ninguém notar.
  // Ver docs/WHATSAPP-TEMPLATES.md.
  for (const comWhatsapp of ["pedido.pago", "pedido.recusado", "carrinho.abandonado", "loja.criada", "loja.provisionada"]) {
    const canais = CANAIS_POR_TIPO[comWhatsapp as keyof typeof CANAIS_POR_TIPO] as readonly string[];
    assert.ok(canais?.includes("whatsapp"), `${comWhatsapp} não declarou o WhatsApp`);
  }
});

test("pedido.criado continua fora: o aviso dele é espera, não reação", () => {
  // `pix_pendente` dispara 30 min depois; enquanto não houver rotina para
  // isso, o tipo inteiro fica no n8n.
  assert.ok(!(TIPOS_EXECUTAVEIS as readonly string[]).includes("pedido.criado"));
});

test("tipo desconhecido não vira e-mail nenhum", () => {
  assert.equal(emailDoEvento({ tipo: "loja.inventada" }), null);
  assert.equal(emailDoEvento({}), null);
});

test("evento de SEO é do catálogo e não manda e-mail", () => {
  // Está no catálogo para sair da fila em casa, não para notificar alguém.
  assert.ok((TIPOS_EXECUTAVEIS as readonly string[]).includes("categoria.seo-publicado"));
  assert.deepEqual(CANAIS_POR_TIPO["categoria.seo-publicado"], []);
  assert.equal(emailDoEvento({ tipo: "categoria.seo-publicado", slug: "x" }), null);
});

test("recuperação de senha leva o link e diz o que fazer se não foi você", () => {
  const email = emailDoEvento({
    tipo: "lojista.recuperar-senha",
    nome: "Padaria Aurora",
    email: "dono@padariaaurora.example",
    link: "https://lojas.avilaops.com/redefinir?t=abc",
  });
  assert.ok(email);
  assert.equal(email.para, "dono@padariaaurora.example");
  assert.match(email.assunto, /Redefinir a senha/);
  assert.ok(email.texto.includes("https://lojas.avilaops.com/redefinir?t=abc"));
  assert.ok(email.texto.includes("ignore este e-mail"));
  assert.ok(email.html?.includes("https://lojas.avilaops.com/redefinir?t=abc"));
});

test("link que não é http(s) não vira botão nem linha", () => {
  // `javascript:` num e-mail é o clássico; aqui ele derruba o evento em vez de
  // virar um link clicável.
  assert.throws(
    () =>
      emailDoEvento({
        tipo: "lojista.recuperar-senha",
        nome: "X",
        email: "a@b.com",
        link: "javascript:alert(1)",
      }),
    DadosInsuficientes,
  );
});

test("campo obrigatório ausente é falha, não silêncio", () => {
  assert.throws(
    () => emailDoEvento({ tipo: "lojista.recuperar-senha", email: "a@b.com", link: "https://x.com" }),
    DadosInsuficientes,
  );
});

test("destinatário inválido não é falha: é evento sem para quem mandar", () => {
  // Pedido do Mercado Livre não tem e-mail do comprador — a conversa acontece
  // lá dentro. Isso é ignorar, não falhar.
  assert.equal(
    emailDoEvento({ tipo: "pedido.enviado", clienteEmail: "", numero: 7, ...lojista }),
    null,
  );
  assert.equal(
    emailDoEvento({ tipo: "pedido.enviado", clienteEmail: "sem-arroba", numero: 7, ...lojista }),
    null,
  );
});

test("pedido enviado leva transportadora e rastreio quando existem", () => {
  const email = emailDoEvento({
    tipo: "pedido.enviado",
    clienteEmail: "jose@exemplo.com",
    clienteNome: "José",
    numero: 1042,
    transportadora: "Correios",
    rastreio: "AA123456789BR",
    linkPedido: "https://padariaaurora.example/pedido/abc",
    ...lojista,
  });
  assert.ok(email);
  assert.equal(email.assunto, "Pedido 1042 enviado");
  assert.ok(email.texto.includes("José"));
  assert.ok(email.texto.includes("Correios"));
  assert.ok(email.texto.includes("AA123456789BR"));
  assert.ok(email.texto.includes("https://padariaaurora.example/pedido/abc"));
});

test("sem rastreio o e-mail não promete rastreio", () => {
  const email = emailDoEvento({
    tipo: "pedido.enviado",
    clienteEmail: "jose@exemplo.com",
    numero: 1042,
    ...lojista,
  });
  assert.ok(email);
  assert.ok(!/rastreio/i.test(email.texto), "prometeu rastreio que não existe");
  assert.ok(!/undefined|null/.test(email.texto));
});

test("quem responde é o lojista, e o remetente é o da loja quando existe", () => {
  const email = emailDoEvento({
    tipo: "pedido.entregue",
    clienteEmail: "jose@exemplo.com",
    numero: 9,
    ...lojista,
  });
  assert.ok(email);
  assert.equal(email.responderPara, "contato@padariaaurora.example");
  assert.equal(email.de, "pedidos@padariaaurora.example");
  assert.equal(email.nomeDe, "Padaria Aurora");
});

test("loja sem remetente provisionado sai pela plataforma, com o nome da loja", () => {
  const email = emailDoEvento({
    tipo: "pedido.entregue",
    clienteEmail: "jose@exemplo.com",
    numero: 9,
    lojaNome: "Oficina do Vale",
    lojistaEmail: "dono@oficina.example",
  });
  assert.ok(email);
  assert.equal(email.de, null, "sem emailRemetente o endereço é o padrão da plataforma");
  assert.equal(email.nomeDe, "Oficina do Vale");
});

test("pedido cancelado diz o motivo e o valor quando o evento traz", () => {
  const email = emailDoEvento({
    tipo: "pedido.cancelado",
    clienteEmail: "jose@exemplo.com",
    numero: 55,
    totalCentavos: 12990,
    motivo: "pagamento não confirmado",
    ...lojista,
  });
  assert.ok(email);
  assert.ok(email.texto.includes("pagamento não confirmado"));
  assert.ok(email.texto.includes(brl(12990)));
});

test("aviso de estoque só sai para quem pediu, e com o preço em reais", () => {
  const email = emailDoEvento({
    tipo: "loja.voltou-ao-estoque",
    nome: "Padaria Aurora",
    destinatario: "quemesperava@exemplo.com",
    produtoNome: "Rolamento 6205",
    precoCentavos: 4990,
    url: "https://padariaaurora.example/produtos/rolamento-6205",
  });
  assert.ok(email);
  assert.equal(email.para, "quemesperava@exemplo.com");
  assert.equal(email.assunto, "Rolamento 6205 voltou ao estoque");
  assert.ok(email.texto.includes(brl(4990)));
});

test("preço zero não vira 'R$ 0,00' no e-mail", () => {
  // Mesma regra do `sobConsulta` da vitrine: preço zero lê como de graça.
  const email = emailDoEvento({
    tipo: "loja.voltou-ao-estoque",
    nome: "X",
    destinatario: "a@b.com",
    produtoNome: "Peça sob consulta",
    precoCentavos: 0,
  });
  assert.ok(email);
  assert.ok(!email.texto.includes(brl(0)));
});

test("relatório semanal traz os cinco números e o período", () => {
  const email = emailDoEvento({
    tipo: "loja.relatorio-semanal",
    nome: "Padaria Aurora",
    emailContato: "dono@padariaaurora.example",
    periodo: "12/09/2026 a 19/09/2026",
    pedidosPagos: 14,
    receitaCentavos: 187650,
    ticketMedioCentavos: 13403,
    carrinhosAbandonados: 3,
    novasAvaliacoes: 2,
    topProdutos: "4x Pão de queijo, 2x Bolo",
    url: "https://padariaaurora.example",
  });
  assert.ok(email);
  assert.equal(email.assunto, "Padaria Aurora: a semana de 12/09/2026 a 19/09/2026");
  for (const esperado of ["14", brl(187650), brl(13403), "Pão de queijo"]) {
    assert.ok(email.texto.includes(esperado), `faltou ${esperado}`);
  }
});

test("'-' em mais vendidos não vira linha no relatório", () => {
  const email = emailDoEvento({
    tipo: "loja.relatorio-semanal",
    nome: "X",
    emailContato: "a@b.com",
    periodo: "p",
    topProdutos: "-",
  });
  assert.ok(email);
  assert.ok(!email.texto.includes("Mais vendidos"));
});

test("nome de produto com HTML não vira marcação na caixa de entrada", () => {
  const email = emailDoEvento({
    tipo: "loja.voltou-ao-estoque",
    nome: "X",
    destinatario: "a@b.com",
    produtoNome: '<img src=x onerror="alert(1)"> & cia',
  });
  assert.ok(email);
  assert.ok(!email.html?.includes("<img"), "HTML do lojista entrou cru");
  assert.ok(email.html?.includes("&lt;img"));
  assert.ok(email.html?.includes("&amp; cia"));
});

test("escapar cobre os quatro caracteres que quebram marcação", () => {
  assert.equal(escapar('<a href="x">&</a>'), "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
});

test("todo tipo com canal de e-mail é tratado no switch", () => {
  // Acrescentar tipo na tabela e esquecer o `case` devolveria `undefined` — o
  // e-mail simplesmente não sairia, e o evento fecharia como ignorado.
  const comEmail = TIPOS_EXECUTAVEIS.filter((t) => (CANAIS_POR_TIPO[t] as readonly string[]).includes("email"));
  for (const tipo of comEmail) {
    let resultado: unknown = "não chamou";
    try {
      resultado = emailDoEvento({ tipo });
    } catch (erro) {
      // Faltar campo obrigatório é resposta legítima: quer dizer que o `case`
      // existe e chegou a pedir os dados.
      assert.ok(erro instanceof DadosInsuficientes, `${tipo} lançou ${erro}`);
      continue;
    }
    assert.notEqual(resultado, undefined, `${tipo} caiu fora do switch`);
  }
});
