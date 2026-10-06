import { test } from "node:test";
import assert from "node:assert/strict";
import { checklistDeOnboarding, resumoDoChecklist, type EntradaChecklist, type IdPasso } from "./checklist-onboarding";

const URL_LOJA = "https://nova.lojas.avilaops.com";

/** Loja recém-criada: tudo vazio, `retiradaNaLoja` no padrão do schema. */
const vazia: EntradaChecklist = {
  status: "ATIVA",
  url: URL_LOJA,
  logoUrl: null,
  whatsapp: null,
  dominioPrincipal: null,
  produtosAtivos: 0,
  mpConfigurado: false,
  cepOrigem: null,
  tabelaFrete: [],
  entregaLocal: [],
  retiradaNaLoja: true,
  enderecoPublico: false,
  endereco: null,
};

/** Loja com os quatro passos obrigatórios feitos e sem domínio próprio. */
const completa: EntradaChecklist = {
  ...vazia,
  logoUrl: "/midia/logo.png",
  whatsapp: "5516999990000",
  produtosAtivos: 3,
  mpConfigurado: true,
  cepOrigem: "14010-000",
};

const enderecoCompleto = { logradouro: "Rua A", numero: "10", bairro: "Centro", cidade: "Ribeirão Preto", uf: "SP", cep: "14010-000" };

const passo = (entrada: EntradaChecklist, id: IdPasso) => checklistDeOnboarding(entrada).find((p) => p.id === id)!;

test("loja recém-criada: seis passos na ordem, nenhum feito", () => {
  const passos = checklistDeOnboarding(vazia);
  assert.deepEqual(passos.map((p) => p.id), ["identidade", "dominio", "catalogo", "recebimento", "entrega", "publicacao"]);
  assert.ok(passos.every((p) => !p.feito));
  const resumo = resumoDoChecklist(passos);
  assert.equal(resumo.total, 6);
  assert.equal(resumo.feitos, 0);
  assert.equal(resumo.obrigatoriosPendentes, 5);
  assert.equal(resumo.proximo?.id, "identidade");
  assert.equal(resumo.completo, false);
});

test("identidade: logo e WhatsApp juntos ligam o passo", () => {
  const p = passo({ ...vazia, logoUrl: "/midia/logo.png", whatsapp: "5516999990000" }, "identidade");
  assert.equal(p.feito, true);
  assert.equal(p.href, "/painel/configuracoes/marca");
});

test("identidade: logo sem WhatsApp fica pendente e diz o que falta", () => {
  const p = passo({ ...vazia, logoUrl: "/midia/logo.png", whatsapp: "   " }, "identidade");
  assert.equal(p.feito, false);
  assert.match(p.detalhe, /WhatsApp/);
  assert.doesNotMatch(p.detalhe, /símbolo/);
});

test("identidade: WhatsApp sem logo fica pendente e diz o que falta", () => {
  const p = passo({ ...vazia, logoUrl: "", whatsapp: "5516999990000" }, "identidade");
  assert.equal(p.feito, false);
  assert.match(p.detalhe, /símbolo/);
  assert.doesNotMatch(p.detalhe, /WhatsApp/);
});

test("domínio: preenchido liga o passo", () => {
  const p = passo({ ...vazia, dominioPrincipal: "loja.com.br" }, "dominio");
  assert.equal(p.feito, true);
  assert.equal(p.opcional, true);
});

test("domínio: vazio fica pendente, é opcional e mostra o endereço da plataforma", () => {
  const p = passo(vazia, "dominio");
  assert.equal(p.feito, false);
  assert.equal(p.opcional, true);
  assert.ok(p.detalhe.includes(URL_LOJA));
  assert.equal(p.href, "/painel/configuracoes/dominio");
});

test("catálogo: um produto ativo liga o passo", () => {
  const p = passo({ ...vazia, produtosAtivos: 1 }, "catalogo");
  assert.equal(p.feito, true);
  assert.equal(p.href, "/painel/produtos");
});

test("catálogo: sem produto ativo fica pendente", () => {
  assert.equal(passo(vazia, "catalogo").feito, false);
});

test("recebimento: credencial salva liga o passo", () => {
  const p = passo({ ...vazia, mpConfigurado: true }, "recebimento");
  assert.equal(p.feito, true);
  assert.equal(p.href, "/painel/configuracoes/recebimento");
});

test("recebimento: sem credencial fica pendente e diz a consequência", () => {
  const p = passo(vazia, "recebimento");
  assert.equal(p.feito, false);
  assert.match(p.detalhe, /o cliente monta o carrinho e não consegue pagar/);
});

test("entrega: CEP de origem com 8 dígitos liga o passo", () => {
  const p = passo({ ...vazia, cepOrigem: "14010-000" }, "entrega");
  assert.equal(p.feito, true);
  assert.equal(p.href, "/painel/configuracoes/entrega");
});

test("entrega: tabela de frete liga o passo", () => {
  assert.equal(passo({ ...vazia, tabelaFrete: [{ ufs: ["SP"], preco: 1500, prazoDiasUteis: 3 }] }, "entrega").feito, true);
});

test("entrega: entrega local liga o passo", () => {
  assert.equal(passo({ ...vazia, entregaLocal: [{ prefixos: ["140"], nome: "Motoboy", preco: 800, prazoDiasUteis: 1 }] }, "entrega").feito, true);
});

test("entrega: retirada com endereço público completo liga o passo", () => {
  assert.equal(passo({ ...vazia, enderecoPublico: true, endereco: enderecoCompleto }, "entrega").feito, true);
});

test("entrega: retiradaNaLoja sem endereço público não conta", () => {
  assert.equal(passo({ ...vazia, retiradaNaLoja: true, enderecoPublico: false, endereco: enderecoCompleto }, "entrega").feito, false);
  assert.equal(passo({ ...vazia, retiradaNaLoja: true, enderecoPublico: true, endereco: null }, "entrega").feito, false);
});

test("entrega: CEP de origem incompleto fica pendente", () => {
  assert.equal(passo({ ...vazia, cepOrigem: "14010" }, "entrega").feito, false);
});

test("loja completa sem domínio: publicada, e o domínio opcional não segura", () => {
  const passos = checklistDeOnboarding(completa);
  const resumo = resumoDoChecklist(passos);
  const publicacao = passos.find((p) => p.id === "publicacao")!;
  const dominio = passos.find((p) => p.id === "dominio")!;
  assert.equal(resumo.completo, true);
  assert.equal(resumo.proximo, null);
  assert.equal(resumo.feitos, 5);
  assert.equal(publicacao.feito, true);
  assert.equal(publicacao.href, URL_LOJA);
  assert.equal(publicacao.acao, "Abrir a loja");
  assert.equal(dominio.feito, false);
  assert.equal(dominio.opcional, true);
});

test("publicação: ATIVA com obrigatório pendente lista o que falta e aponta o primeiro", () => {
  const p = passo({ ...completa, mpConfigurado: false, cepOrigem: null }, "publicacao");
  assert.equal(p.feito, false);
  assert.match(p.detalhe, /Recebimento, Entrega/);
  assert.equal(p.href, "/painel/configuracoes/recebimento");
});

test("publicação: loja completa em PROVISIONANDO não está publicada", () => {
  const passos = checklistDeOnboarding({ ...completa, status: "PROVISIONANDO" });
  const p = passos.find((x) => x.id === "publicacao")!;
  assert.equal(p.feito, false);
  assert.match(p.detalhe, /ainda está sendo configurada/);
  assert.equal(p.href, "/painel");
  assert.equal(resumoDoChecklist(passos).completo, false);
});

test("publicação: PROVISIONANDO com pendência aponta o primeiro obrigatório pendente", () => {
  assert.equal(passo({ ...completa, status: "PROVISIONANDO", produtosAtivos: 0 }, "publicacao").href, "/painel/produtos");
});

test("publicação: loja completa SUSPENSA não está publicada e leva à assinatura", () => {
  const passos = checklistDeOnboarding({ ...completa, status: "SUSPENSA" });
  const p = passos.find((x) => x.id === "publicacao")!;
  assert.equal(p.feito, false);
  assert.match(p.detalhe, /suspensa/);
  assert.equal(p.href, "/painel/configuracoes/assinatura");
  const resumo = resumoDoChecklist(passos);
  assert.equal(resumo.completo, false);
  assert.equal(resumo.proximo?.id, "publicacao");
});

test("publicação: CANCELADA leva à assinatura", () => {
  const p = passo({ ...completa, status: "CANCELADA" }, "publicacao");
  assert.equal(p.feito, false);
  assert.match(p.detalhe, /cancelada/);
  assert.equal(p.href, "/painel/configuracoes/assinatura");
});

test("todo href de passo pendente começa com /painel", () => {
  const cenarios: EntradaChecklist[] = [
    vazia,
    { ...vazia, status: "PROVISIONANDO" },
    { ...vazia, status: "SUSPENSA" },
    { ...vazia, status: "CANCELADA" },
    { ...completa, status: "PROVISIONANDO" },
    { ...completa, status: "SUSPENSA" },
    { ...completa, mpConfigurado: false },
    completa,
  ];
  for (const entrada of cenarios) {
    for (const p of checklistDeOnboarding(entrada)) {
      if (!p.feito) assert.ok(p.href.startsWith("/painel"), `${entrada.status}/${p.id}: ${p.href}`);
    }
  }
});
