# Migração da Brilhax para a plataforma de Lojas

Levantamento e plano de execução. Escrito em 09/09/2026.

A Brilhax roda hoje em pilha própria: Medusa v2 como backend de e-commerce e um
Next.js estático como vitrine, cinco containers no servidor de produção. A
proposta é trazê-la para a plataforma de Lojas como mais um tenant, e transformar
a identidade visual dela no nono layout da plataforma, disponível para os
próximos clientes do mesmo ramo.

A loja **ainda não foi lançada** para o público. Isso muda a natureza do
trabalho: não é migração de operação viva, é troca de fundação antes da estreia.
O risco cai muito e a janela é agora.

## Por que vale a pena

A plataforma cobre tudo que a Brilhax usa hoje, e algumas coisas que ela não tem.

| | Brilhax (Medusa) | Lojas |
|---|---|---|
| Pagamento | Mercado Pago, ligado em 09/09 | Mercado Pago por loja, credencial cifrada, webhook por slug, Pix com validade |
| Frete | CepCerto | CepCerto + ViaCEP + tabela por UF + retirada |
| Painel do lojista | Medusa genérico, quatro remendos nossos para virar utilizável em português | 31 telas, em português desde o começo |
| Mercado Livre | canais são etiquetas, sem integração | OAuth completo, publica anúncio |
| Catálogo | produto e variante | idem, mais marca, GTIN, atributos livres, compatibilidade e origem declarada da foto |
| Cupom, avaliação, conta do comprador, aviso de estoque, carrinho abandonado | não tem | tem |

Três ganhos que não aparecem na tabela:

**Um código só para manter.** O `google_product_category` que entrou no feed da
Brilhax em 08/09 falta na plataforma. Todo acerto feito hoje precisa ser feito
duas vezes, e a segunda sempre atrasa.

**Servidor.** A Brilhax ocupa cinco containers, com Postgres e Redis próprios,
num servidor que opera com menos de 200 MB livres de 3,8 GB e vive em swap.

**Receita.** Deixa de ser cliente de site e passa a assinante de plataforma.

## O que se descarta, dito na cara

Dois dias de trabalho recente no Medusa saem de cena: o checkout com Payment
Brick, o provedor de pagamento blindado e os remendos do painel (criação de tipo
no cadastro, erros em português, canal de aviso, URL pública das fotos).

Duas ressalvas honestas. A primeira: o aprendizado do provedor blindado já foi
conferido aqui e **a plataforma não tem o mesmo defeito** — o pedido só vira
`PAGO` quando o gateway responde "aprovado". A segunda: as credenciais do
Mercado Pago da Brilhax já estão em mãos e são reaproveitadas direto, sem pedir
nada ao cliente de novo.

## O layout como produto

Um layout da plataforma é um componente de 43 a 89 linhas em
`src/components/home/`, escolhido por um `enum` e composto de blocos que já
existem (`AtalhosCategorias`, `BeneficiosBarra`, `ProvaSocial`, `Garagem`).

Recriar a cara da Brilhax é escrever um arquivo desse tamanho e registrá-lo em
dois lugares. O layout `distribuidora` nasceu assim, da Vedashow.

O nono chama-se **`automotivo`** e serve estética automotiva, autopeças,
acessórios e oficina: vitrine por etapa do serviço (lavagem, polimento,
proteção), destaque de marca (a Brilhax é revenda Vonixx) e barra de benefícios
com envio para todo o Brasil e retirada no balcão.

## Plano

### Fase 1 — Layout automotivo (meio dia)

1. `src/components/home/Automotivo.tsx`, no padrão dos existentes.
2. Registrar em `src/lib/tema.ts`: `enum` do `TemaSchema` e lista `LAYOUTS`,
   com rótulo e descrição que o painel exibe.
3. Acrescentar o ramo no ternário de `src/app/page.tsx`.
4. Conferir em `ModelosInterativos.tsx`, a página que mostra os modelos a quem
   está criando loja.

Sai da fase valendo para qualquer cliente, não só para a Brilhax.

### Fase 2 — Loja em paralelo (1 dia)

Criar o tenant sem tocar em nada do que está no ar:

```
POST /api/admin/tenants
{ "nome": "Brilhax", "plano": "LOJA",
  "tema": { "layout": "automotivo", "primaria": "#E50914" } }
```

Fica em `brilhax.lojas.avilaops.com`. O `brilhax.com` continua servindo o site
atual o tempo inteiro.

Depois, catálogo em lote (`PUT /api/admin/tenants/brilhax/produtos?importarImagens=1`,
até 2.000 por chamada, idempotente por sku/slug). O parâmetro baixa as fotos de
`app.brilhax.com` para o `/uploads` da plataforma, e a loja deixa de depender do
Medusa no mesmo movimento.

Mapa dos campos:

| Medusa | Lojas | observação |
|---|---|---|
| `handle` | `slug` | mantém a URL do produto |
| `title` | `nome` | |
| `subtitle` | `marca` | Vonixx, Nitro, Vintex, Würth, Wolf Pads |
| categoria | `categoria` | criada se não existir |
| `variant.sku` | `sku` | |
| `variant.barcode` | `gtin` | 68 dos 225 têm |
| `calculated_price` | `precoCentavos` | **em reais no Medusa, multiplicar por 100** |
| `description` | `descricao` | |
| `thumbnail` + imagens | `imagens[]` | 82 dos 225 têm foto |
| tipo do produto | `atributos.tipo` | os 8 criados em 04/09 |
| `status` | `ativo` | `published` vira `true` |
| `variant.inventory_quantity` | `estoque` | |
| `variant.weight` | `pesoKg` | alimenta a cotação de frete |

Números: **225 produtos** (100 publicados, 125 rascunho), **7 categorias**,
**82 com foto**. A Vedashow tem 2.114 na mesma plataforma, então escala não é
questão aqui.

### Fase 3 — Pagamento e frete (2 horas)

As credenciais do Mercado Pago da Brilhax (conta BRILHAXCAR, do cliente) já
estão em `Websites/brilhax.com/.env.production`. Entram no tenant pelo painel,
que as cifra no banco.

Atenção ao webhook: a plataforma usa `/api/webhooks/mercadopago?loja=brilhax`,
diferente do endereço do Medusa. Precisa ser trocado no painel do Mercado Pago
**na virada**, não antes, senão as confirmações param de chegar no site que
ainda está no ar.

Frete: mesma CepCerto de hoje, mais retirada no balcão de Ribeirão Preto.

### Fase 4 — Conteúdo e SEO (4 horas)

O que a plataforma ainda não faz e a Brilhax faz:

- **`google_product_category` no feed.** A plataforma manda mais campos que a
  Brilhax (`color`, `size`, `material`, `item_group_id`, `sale_price`,
  `shipping_weight`) e não manda esse. Portar o mapa de
  `Websites/brilhax.com/scripts/lib/categoria-google.mjs`, que já traz as sete
  categorias conferidas contra a taxonomia oficial. **Vale para todos os
  clientes**, não só para a Brilhax.
- **Política de termos de uso.** A plataforma tem três tipos (`envio`,
  `devolucao`, `privacidade`); a Brilhax publica quatro. Acrescentar `termos`.

Textos institucionais (sobre, contato, políticas) são copiados do site atual.

### Fase 5 — Virada (2 horas)

Só depois de conferir a loja de ponta a ponta em `brilhax.lojas.avilaops.com`,
com uma compra de verdade de valor baixo.

**Redirects.** São 117 URLs indexadas. A Brilhax usa `trailingSlash: true` e a
plataforma não, então **toda URL muda pelo menos a barra final**:

| origem | destino | quantas |
|---|---|---|
| `/produtos/{slug}/` | `/produtos/{slug}` | 101 |
| `/produtos/categoria/{slug}/` | `/categoria/{slug}` | 8 |
| `/politica-de-envio/` | `/politicas/envio` | 1 |
| `/politica-de-devolucao/` | `/politicas/devolucao` | 1 |
| `/politica-de-privacidade/` | `/politicas/privacidade` | 1 |
| `/termos-de-uso/` | `/politicas/termos` | 1 |
| `/`, `/produtos/`, `/sobre/`, `/contato/` | sem a barra | 4 |

Tudo 301. Sem isso, 101 páginas de produto já indexadas perdem posição.

**Domínio.** `brilhax.com` e `www` passam a apontar para a plataforma, sem proxy
laranja, com o `PATCH` que alimenta o Caddy. O `www` responde 308 para o apex.

**O e-mail não se toca.** As caixas do cliente ficam onde estão; mexer no MX ao
trocar o site é o erro clássico e derruba o e-mail da loja.

**Volta atrás:** DNS de novo para o site antigo. Os cinco containers ficam de pé
por duas semanas depois da virada, desligados só quando o tráfego novo estiver
estável.

### Fase 6 — Desligar (1 hora, duas semanas depois)

Backup do banco do Medusa, containers parados, imagens removidas. O repositório
`avilaops/brilhax.com` fica como está, arquivado.

## Prazo

| Fase | Tempo |
|---|---|
| 1. Layout automotivo | meio dia |
| 2. Loja em paralelo e catálogo | 1 dia |
| 3. Pagamento e frete | 2 h |
| 4. Conteúdo e SEO | 4 h |
| 5. Virada | 2 h |
| 6. Desligar | 1 h, depois |

**3 a 4 dias de trabalho**, com a virada acontecendo só quando a loja em
paralelo estiver aprovada.

## Riscos

**Perder posição no Google.** É o único risco de verdade, e a mitigação é a
tabela de redirects acima, conferida URL a URL antes da virada. A favor: a loja
não foi lançada, o tráfego atual é baixo e não há venda a perder.

**Foto que não migra.** A importação não para por causa de uma imagem: a que
falhar fica com a URL original. Mas URL original apontando para o Medusa vira
link quebrado quando os containers forem desligados, então a conferência entre
as fases 2 e 6 precisa listar as que ficaram para trás.

**Rascunhos.** 125 dos 225 produtos são rascunho, e 143 estão sem foto. Isso
migra do jeito que está: catálogo pela metade continua pela metade do outro
lado. É trabalho do cliente, e a migração não muda o tamanho dele.

## O que fica pendente do lado do cliente

- 22 produtos publicados sem preço e 17 sem foto, que hoje já ficam fora do
  feed do Google.
- Conta do Google Merchant Center no CNPJ da Brilhax, para o feed ser lido.
- Decidir se boleto entra (hoje o checkout oferece cartão e Pix).
