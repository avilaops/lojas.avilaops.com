# Brilhax: checklist da virada de domínio

Complementa `migracao-brilhax.md`, que tem o plano. Este é o documento da
troca. Escrito em 11/09/2026; **estado revisto em 17/09/2026**.

> **A virada FOI EXECUTADA.** `brilhax.com` serve a plataforma. O que segue
> abaixo do próximo bloco é o registro de como se chegou aqui, preservado
> porque a volta atrás e o desligamento do legado ainda se apoiam nele. Onde o
> texto antigo diz "não executado", vale o quadro de 17/09.

## Estado em 17/09/2026, medido de fora

Conferido contra o domínio no ar, sem acesso ao servidor. Cada linha é uma
requisição feita nesta data.

| O que | Medido |
|---|---|
| `brilhax.com` | 200, servido pela plataforma |
| Canonical da home | `https://brilhax.com` |
| `brilhax.lojas.avilaops.com` | `noindex, follow`, canonical para `brilhax.com` |
| As 12 regras de redirect | aplicadas; categoria, políticas e termos devolvem 301 para o destino da tabela abaixo, sem cadeia |
| Barra final (`/sobre/`, `/contato/`, `/produtos/<slug>/`) | 308 da aplicação, um salto |
| `robots.txt` | carrinho, checkout, pedido, conta e API fora do rastreio |
| Ícones e manifesto da loja | 200, com o tipo certo (o 404 de `/uploads` em `.ico`, `.svg` e `.webmanifest` saiu com o deploy) |
| `sitemap.xml` | 94 URLs: 80 de produto, 7 de categoria, 4 de política, sobre, contato e a home |
| `feed/merchant.xml` | 79 itens, todos com título, descrição, preço, marca e imagem |

**Uma lacuna encontrada e fechada nesta rodada.** Dos 79 itens, 8 saíam sem
`google_product_category`: 7 em "Acessórios" e 1 em "Produtos para Moto". A
causa é a portabilidade do mapa da Brilhax para a plataforma, em que o
reconhecimento passou de `slug` da categoria para palavra no nome, e estes dois
nomes não têm palavra que os denuncie. Corrigido em `categoria-google.ts`:
nomes genéricos passam a ser resolvidos pelo ramo que as OUTRAS categorias da
mesma loja provam, então "Acessórios" vira prateleira de escova de carro na
Brilhax e continua sem prateleira numa loja de beleza ou pet. **Vale para toda
a plataforma** e entra no ar no próximo deploy. O nono item sem prateleira,
LAMAX NITRO 500ML, é cadastro: está sem categoria nenhuma.

**O que este quadro não prova:** não fala de pagamento real, de indexação no
Google nem do Merchant Center. Para esses, ver os bloqueadores no fim, que
continuam valendo naquilo que ninguém mediu de dentro.

## Registro da preparação (11/09)

O que vem abaixo é o documento como estava na véspera, e descreve o que ainda
**não** tinha sido feito naquela data.

## Estado verificado em 11/09

| | Evidência |
|---|---|
| Repositório | `main` sincronizado com `origin/main`; `categoriaSemImagem` preservado em `tema.ts` |
| Commits 435661b, 6000cd3, bc15b22 | existem; depois deles vieram 40cd8ee (meu) e ab9f83a (outra sessão) |
| Versão publicada | standalone de 10/09 22:49, depois de 40cd8ee |
| 40cd8ee está no ar? | **sim**: `vedashow.lojas.avilaops.com` devolve `noindex, follow`, `vedashow.com.br` segue indexável, e `divergencia:` e `valorEmCentavos` estão em `.next/server/chunks/lojas-build_18z0akv._.js` |
| WIP de outra sessão | 16 arquivos do painel alterados e não commitados. **Não entram no meu commit nem no pacote de deploy** |

## O que esta rodada mudou

### Erros meus, de rodadas anteriores

**O teste da falha temporária afirmava o comportamento errado.** Eu tinha
escrito que o webhook devolver 200 quando a consulta ao gateway falha era o
certo. Não é. A documentação do Mercado Pago: o integrador responde 200 ou 201
em até 22 segundos; sem isso, o MP reenvia a cada 15 minutos. Com 200 ele dá a
notificação por entregue e nunca mais tenta. E nada mais na plataforma consulta
pagamento de pedido. Pedido pago ficaria aguardando para sempre.

**Documentei errado o boleto.** Escrevi que "o produto sai do estoque sem o
dinheiro ter entrado". É o contrário: o estoque só baixa quando o pedido vira
PAGO. Ver "Boleto".

**Escrevi que o webhook de produção recebeu o teste do painel em 09/09.** Aquele
evento foi para o Medusa. A plataforma nunca recebeu evento real.

### Defeitos anteriores a esta migração

Todos existiam antes do meu trabalho; a evidência é o código de `main`.

| Defeito | Efeito | Correção |
|---|---|---|
| `pedido.recusado` emitido em todo webhook de recusa | reenvio do MP repetia o e-mail de recusa; recusa atrasada avisava recusa de pedido já pago | só emite quando o pedido sai de AGUARDANDO_PAGAMENTO |
| webhook respondia 200 quando a consulta falhava | pagamento aprovado se perdia sem reenvio | responde 500; reprocessar é seguro |
| `data.id` lido do corpo antes da query | a documentação monta o manifesto com o da query | query primeiro; query e corpo divergentes, recusa |
| nenhuma rotina conferia pedido aguardando pagamento | Pix e boleto dependiam 100% do webhook | `POST /api/admin/pedidos/verificar` |
| meta description de produto só com `descricaoCurta` | **nenhum** produto da Brilhax tinha description; o site antigo tem em todos | cai para a descrição completa, resumida |
| `metadataDeListagem` gravava `description: undefined` | `/produtos` e a busca saíam sem description | só grava quando existe |
| JSON-LD com a descrição crua | HTML literal no rich result | texto puro |

Todas são **mudanças compartilhadas por todas as lojas**, com regressão:
`pedidos-webhook.test.ts` (12 casos), `mercadopago-webhook.test.ts` (13) e
`seo-texto.test.ts` (9).

## Catálogo reconciliado

Tabela por produto em `deploy/brilhax/catalogo-reconciliado.csv` (224 linhas).
Os números que circularam nos relatórios, explicados:

| Número | O que é, conferido no banco |
|---|---|
| 224 importados | 225 do Medusa menos "teste" |
| 79 ativos | têm preço |
| 62 no feed | os 79 ativos **com imagem** |
| 17 sem imagem | os 79 ativos **sem imagem**: fora do feed porque `image_link` é obrigatório |
| 145 inativos | 142 sem preço + 3 rascunhos do Medusa com preço. **Não é 224 − 79 por suposição**: é consulta |
| "21 publicados sem preço" | os 21 produtos do sitemap antigo hoje inativos. **Todos sem preço; 20 com imagem** |
| "22 em redirects" | esses 21 mais "teste": as URLs de produto do sitemap antigo que dariam 404 |
| "19 indexados" | **não reproduzível e sem fonte.** Descartado |

**Indexação pelo Google: não verificado.** A conta de serviço alcança só
`sorroche.beauty`, `saudepet.app.br` e `brasamineira.com.br`. "Estar no sitemap
antigo" é o que o site ofereceu ao Google, não o que o Google indexou.

**Nada mudou depois da importação.** Comparando Medusa e plataforma produto a
produto: 0 preços divergentes e 0 produtos alterados no Medusa depois de
09/09. O único que existe só no Medusa é "teste".

### Os 21 do sitemap antigo hoje inativos

Todos com preço zero. Se reativados como "sob consulta" (`sobConsulta()`, que é
como o site antigo os mostra), 20 viram página publicável; o que não tem foto
fica `noindex` pela regra `publicavel()`.

`aplicador-esp-pct-2und`, `cera-luster-500ml-vonixx`,
`kit-alicate-para-instalacao-de-gaxetas-hidraulica`, `lava-autos-500ml`,
`ox-pro-500ml`, `pano-de-micro-fibra-azul-escuro-37x57`,
`pano-de-microfibra-sem-costura-40x40-vinixx`,
`pano-micro-fibra-azul-escuro-47x77-230gsm`,
`pincel-externo-n14-cerdas-medias-vonixx`,
`pincel-interno-cerdas-medias-vonixx-detalhamento-automotivo`, `prizm-1-5`,
`sintra-5-litros`, `snow-foan-bico-amarelo-furacao-1-3`, `snow-foan-manual`,
`v-cut-polidor-de-cortes-premium`, `v-floc-1-5`, `v-floc-3l`, `v-mol-5-litros`,
`v-mol-500ml`, e dois que foram **testes de cadastro de 03/09**:
`lamax-limpador-multiuso` (sem foto) e `speel-car-500ml`.

**Não reativei nenhum.** Proposta para a decisão: os 19 de catálogo como "sob
consulta"; os 2 testes e "teste" em 404. O 404 fica em vez de 410 porque a
aplicação não devolve 410 sem mudança de código, e o Google trata os dois como
remoção.

## Redirects

`deploy/brilhax/redirects.caddy`: 12 regras, testadas em 10/09 numa instância
isolada do Caddy (porta 8899, container próprio, removido depois). **O arquivo
não mudou desde então** (`git diff HEAD` vazio).

Como o domínio definitivo continua `brilhax.com`, só leva redirect o que muda
de caminho. O resto é a mesma URL, e a aplicação já responde.

| Origem | Quem responde | Status | Location | Saltos | Final | Por quê |
|---|---|---|---|---|---|---|
| `/produtos/categoria/lavagem/` | Caddy | 301 | `/categoria/lavagem` | 1 | 200 | categoria mudou de lugar |
| `/produtos/categoria/kits/` | Caddy | 301 | `/categoria/kits-completos` | 1 | 200 | a plataforma gera o slug pelo nome "Kits Completos" |
| `/produtos/categoria/moto/` | Caddy | 301 | `/categoria/produtos-para-moto` | 1 | 200 | idem, "Produtos para Moto" |
| `/produtos/categoria/lavagem/?pagina=2` | Caddy | 301 | `/categoria/lavagem?pagina=2` | 1 | 200 | query preservada |
| `/politica-de-envio/`, `-devolucao/`, `-privacidade/` | Caddy | 301 | `/politicas/<tipo>` | 1 | 200 | políticas agrupadas |
| `/termos-de-uso/` | Caddy | 301 | `/politicas/termos` | 1 | 200 | idem |
| `/produtos/acidus-fast-500ml/` | aplicação | 308 | `/produtos/acidus-fast-500ml` | 1 | 200 | mesma URL sem a barra |
| `/produtos/?marca=Vonixx` | aplicação | 308 | `/produtos?marca=Vonixx` | 1 | 200 | query preservada; o filtro existe |
| `/sobre/`, `/contato/` | aplicação | 308 | sem a barra | 1 | 200 | idem |
| `/produtos/lava-autos-500ml` | aplicação | 404 | | 0 | 404 | inativo; depende da decisão acima |
| `/produtos/teste` | aplicação | 404 | | 0 | 404 | removido sem substituto |
| `/produtos/categoria/lavagem/extra/` | aplicação | 404 | | 0 | 404 | nunca existiu |
| `/pedido/?id=order_123` | aplicação | 308 | `/pedido?id=…` | 1 | 404 | pedido do Medusa não existe aqui; os 3 que existem são de teste |

Sem cadeia: as regras do Caddy apontam direto para o caminho final, sem barra,
então a aplicação não emenda um 308 depois do 301.

## SEO: pré e pós virada

**Pré-virada (hoje, medido):** `brilhax.lojas.avilaops.com` é o endereço
oficial da loja (sem `dominioPrincipal`), então é indexável, e canonical,
sitemap e feed apontam para ele. Correto até a virada.

**Pós-virada (medido no análogo):** a Vedashow já tem domínio próprio. Em
`vedashow.com.br`, canonical da home, primeira URL do sitemap, primeiro link do
feed, linha `Sitemap:` do robots e `url` do JSON-LD apontam todos para
`vedashow.com.br`, e o subdomínio devolve `noindex, follow`. As 6 menções a
`lojas.avilaops.com` na página de produto são o logo servido de `/uploads`:
hospedagem de arquivo, não link interno nem canonical.

**Para a Brilhax, conferir depois do `PATCH`, não presumir.**

`noindex` e `robots.txt` não se atrapalham: as páginas do subdomínio não são
bloqueadas no robots, então o Google rastreia e lê o `noindex`. Carrinho,
checkout e API seguem com as próprias barreiras; `noindex` não é autenticação.

## Pagamento

### Resultados separados por ambiente

**Local (testes automatizados, sem rede): 227 passando** na suíte de
`lojas.avilaops.com` mais `packages/checkout`.

| O que se queria saber | Resultado |
|---|---|
| Evento com assinatura válida aceito | aceito |
| Assinatura de outra loja, corpo adulterado, query e corpo divergentes | recusados |
| Consulta ao gateway antes de confirmar | a rota chama `consultar()` e usa a resposta, nunca o corpo |
| Valor divergente do total | não confirma; grava `divergencia:` |
| Evento duplicado | não baixa estoque de novo nem repete aviso |
| Evento fora de ordem | pedido pago ou enviado não regride; estorno vale sempre |
| Pendente, aprovado, recusado, cancelado, estornado | cada um chega intacto; Pix expirado chega como `cancelled` |
| Falha temporária | 500, e o MP reenvia; o pedido não muda |
| Isolamento entre lojas | busca por `tenantId`; segredo e token por loja |
| Segredos nas respostas | ausentes |

**Sandbox: não usado.** Trocar credencial de produção por credencial de teste
estava proibido, e a conta não tem par de teste configurado.

**Produção (leitura, sem transação):**

| | Evidência |
|---|---|
| Token e segredo do webhook da Brilhax salvos | `psql`: `brilhax\|t\|t` (só presença) |
| A loja vende | checkout mostra "Finalizar compra", produto "Adicionar ao carrinho" |
| Token exposto pela API de admin | não: nenhum campo devolve o token |
| Webhook já processou evento real | **nunca**: nenhum pedido, em nenhuma loja, tem `pagamentoId` |

### O que continua desconhecido, e importa

A documentação trata a assinatura `x-signature` para os webhooks configurados
no painel. A plataforma não usa o do painel: manda `notification_url` em cada
cobrança. **Não há prova de que essas notificações chegam assinadas.** Se não
chegarem, o webhook devolve 401 e nenhum Pix se confirma por ele.

Cartão não depende disso: aprovado na hora, o pedido já nasce PAGO. Pix e
boleto dependem. A mitigação é a rotina `pedidos/verificar`, que confere no
gateway independente de webhook; **ela ainda não está agendada no n8n**. A
compra de teste em Pix responde a pergunta.

**Recebedor e moeda:** `consultar()` usa o token da loja, e pagamento de outra
conta não é visível com ele, então o recebedor é conferido de forma implícita.
A moeda não é conferida; contas brasileiras só operam BRL, e isso fica como
risco residual anotado, não como defeito.

### Roteiro da compra real (PARA APROVAÇÃO, não executado)

| Item | Proposta |
|---|---|
| Produto | AROMINHA CARRO NOVO SCENT, R$ 15,00 (o menor preço ativo) |
| Pedidos | 2: um em Pix, um em cartão. Boleto fica de fora (compensa em dias) |
| Quem paga | Nicolas, conta pessoal |
| Recebedor | BRILHAXCAR, conta do cliente |
| Estoque | o produto não controla estoque; nada a baixar nem repor |
| Conferir no cartão | pedido nasce PAGO, valor igual ao cobrado |
| Conferir no Pix | pedido vira PAGO **pelo webhook** (log sem 401) em minutos; se não virar, rodar `pedidos/verificar` e registrar que a assinatura não chegou |
| Conferir em ambos | pagamento na conta MP da Brilhax, e-mail de confirmação uma vez só |
| Estorno | pelo painel do MP, no mesmo dia. **Autorização separada** |
| Custo | R$ 30, estornáveis |

## Boleto

Habilitado no cadastro da loja (`meiosPagamento: pix, cartao, boleto`), não só
na tela. Funcionamento, lido no código:

- **Reserva:** não há. O estoque só baixa quando o pedido vira PAGO. Dois
  clientes podem gerar boleto para a última unidade e os dois pagarem.
- **Expiração:** o MP cancela o boleto vencido; o pedido vira CANCELADO sem
  mexer em estoque, porque nada foi baixado.
- **Hoje:** nenhum produto da Brilhax controla estoque, então o risco acima não
  existe enquanto for assim.

**Não mexi.** Manter ou desligar é decisão do cliente.

## Conteúdo institucional (Fase 4)

| Página | Conclusão técnica | Aprovação do conteúdo |
|---|---|---|
| Sobre | publicada, canonical, description | vem do cadastro; **não revisado** pela Brilhax |
| Contato | idem | idem |
| Envio e retirada | idem | gerado do cadastro; **não revisado** |
| Trocas e devoluções | idem | base no art. 49 do CDC; **não revisado** |
| Privacidade | idem | base na LGPD; **não revisado** |
| Termos de uso | publicada | **não revisado** |
| Canonical, sitemap, robots | medidos em desktop e celular | não se aplica |

"Implementado e publicado" não é "revisado pelo responsável", e referência ao
CDC não é adequação jurídica. Faltam, nos termos, decisões que só a Brilhax
toma: garantia própria, erro de preço além do mínimo legal e foro.

## Merchant Center

Não verificável. A chamada à Merchant API com a conta de serviço responde que o
projeto GCP não está registrado em conta Merchant nenhuma, o que não diz nada
sobre a Brilhax ter ou não conta própria. Titularidade, acesso e pendências
dependem de alguém da Brilhax entrar no painel. **Nada foi criado nem enviado.**

## Dados além do catálogo

| No Medusa | Quantos | O que são |
|---|---|---|
| Pedidos | 3 | todos de teste |
| Pagamentos | 3 | `pp_system_default`, nenhum capturado |
| Clientes | 21 | 6 internos e 15 `@storebotmail.joonix.net`, robô de teste do Google |
| Carrinhos abertos | 28 | do período de testes |

**O que migra:** o catálogo, já migrado e sem divergência. **O que fica no
legado:** os 3 pedidos e os carrinhos, todos de teste, que não migram. Clientes
não migram: nenhum é real. Se houver venda até a virada, refazer este
levantamento.

## O dia da virada

1. **Backup com restauração verificada**
   - [ ] Dump do banco `lojas` restaurado num banco descartável, com contagem de
         produtos da Brilhax igual à de produção.
   - [ ] Dump de `medusa_store`, idem.
   - [ ] `/opt/brilhax-stack/.env` e `/opt/lojas/.env`.
   - [ ] Guardar o `standalone.tgz` que estiver no ar.

2. **Uma operação vendendo por vez**
   - [ ] Antes de apontar o DNS: tirar o Mercado Pago da região Brasil no
         Medusa, para a API antiga não fechar pedido pago enquanto o DNS
         propaga.
   - [ ] Preço e estoque: rodar de novo a comparação Medusa x plataforma. Hoje:
         0 divergências.

3. **DNS, TLS e identificação**
   - [ ] `brilhax.com` e `www` para o servidor da plataforma, sem proxy laranja.
   - [ ] `PATCH` no tenant com `dominioPrincipal` e `dominios`.
   - [ ] Certificado emitido antes de mandar tráfego.
   - [ ] O domínio serve a Brilhax, e não outra loja do servidor.
   - [ ] **Não tocar em MX, SPF, DKIM nem DMARC.** O e-mail da Brilhax fica onde
         está. Tirar print dos registros antes de mexer em qualquer coisa.

4. **Webhooks**
   - [ ] A plataforma recebe pela `notification_url` de cada cobrança; o
         endereço cadastrado no painel do MP aponta para o Medusa e não precisa
         mudar para a plataforma funcionar.
   - [ ] Pedidos antigos: nenhum real, então não há webhook de pedido antigo a
         preservar.
   - [ ] `pedidos/verificar` agendado de hora em hora no n8n **antes** da virada.

5. **Redirects**
   - [ ] Aplicar as 12 regras no bloco do domínio.
   - [ ] Conferir a tabela acima, inclusive os casos que **não** redirecionam.

6. **Depois de virar**
   - [ ] Canonical, sitemap, feed e JSON-LD em `brilhax.com`.
   - [ ] Subdomínio servindo `noindex, follow`.
   - [ ] Search Console: sitemap novo. **Não** usar "mudança de endereço": o
         endereço não muda.

## Monitorar por 14 dias

404 vindo de URL antiga · 5xx · 401 no webhook · pedidos em AGUARDANDO há mais
de uma hora · cada pagamento conferido contra o painel do MP · indexação.

**Os 14 dias são janela de observação, não autorização automática para
desligar.**

## Voltar atrás

Enquanto o stack antigo estiver de pé, a volta é DNS. **Pedido recebido depois
da virada mora na plataforma**: voltar o DNS não os apaga, e eles continuam
sendo atendidos pelo painel da plataforma, que segue em
`brilhax.lojas.avilaops.com`. O rollback é do site, nunca dos pedidos. Se a
volta acontecer, religar o MP na região do Medusa só depois de exportar a
lista de pedidos da plataforma.

## Desligar o legado

Só com todos: 14 dias completos · zero 404 de URL antiga · zero 401 no webhook
· ao menos um pedido pago conferido · cliente ciente de que a volta deixa de
ser rápida · **autorização explícita**.

**Desligar o Medusa não remove os redirects.** As 12 regras ficam na
infraestrutura nova por pelo menos um ano, que é a orientação do Google.

## Deploy preparado, não executado

Fluxo existente: `scripts/empacotar.sh` na máquina local gera o
`standalone.tgz`, que sobe para `/opt/lojas/` e é aplicado por
`deploy/deploy.sh`.

**Pacote pronto, esperando autorização:**
`D:/avilaops.com/lojas-rodada-brilhax/deploy-pendente/lojas-standalone-ae1f8b0.tgz`
(160.169.652 bytes).

- Montado num worktree limpo em `ae1f8b0` (`D:/avilaops.com/lojas-rodada-brilhax`),
  não na árvore de trabalho, que tem 16 arquivos em andamento de outra sessão.
- `gzip -t` íntegro; 3 CSS em `.next/static`, `public/`, `prisma/schema.prisma`
  e `server.js` presentes.
- Conferido **dentro do `.tgz`**, no código compilado: rota
  `api/admin/pedidos/verificar`, `Falha temporária; reenviar` (500),
  `divergencia:` (valor) e `"recusado"===a&&m&&` (recusa uma vez só).
- `appDir`, `relativeAppDir`, `outputFileTracingRoot` e `turbopack.root`
  idênticos aos do pacote em produção. O nome do worktree aparece nos nomes de
  chunk, o mesmo padrão do pacote em produção (`lojas-build_…`, 151 arquivos).
- `packages/checkout` (a correção do 500 e do `data.id`) **não está em git
  nenhum**; entra no pacote porque o build o compila de `file:../packages/checkout`.
  Se o disco se perder, a correção se perde.
- Depois do deploy: agendar `POST /api/admin/pedidos/verificar` no n8n.

A conferência final do `empacotar.sh` usava `tar tzf` sem `--force-local`: com
saída em `C:/…`, o tar do Git Bash toma "C:" por servidor remoto e a checagem
falha depois de o pacote já estar gravado. Corrigido junto com este documento.

## Decisões pendentes

1. **Os 21 inativos do sitemap antigo**: proposta acima (19 sob consulta, 2 em
   404). E os outros 124 inativos: manter fora ou "sob consulta".
2. **Boleto**: manter ou desligar.
3. **Termos e demais políticas**: revisão de quem responde pela Brilhax.
4. **Merchant Center**: a Brilhax confirmar se tem conta e dar acesso.
5. **17 produtos ativos sem foto**: trabalho de catálogo.

## Bloqueadores, revistos em 17/09

Eram bloqueadores da virada. A virada aconteceu, então o que sobrou são
pendências de operação — nenhuma impede a loja de vender, e nenhuma se resolve
sem acesso que a Brilhax controla.

| # | Pendência | Estado em 17/09 | Quem resolve |
|---|---|---|---|
| 1 | Pix confirmado de ponta a ponta; assinatura da `notification_url` | **aberto**, e é o de maior risco: cartão nasce PAGO, Pix depende do webhook | autorização da compra de teste |
| 2 | Correções da rodada publicadas | **fechado**: estão no ar (ícones e manifesto respondem) | — |
| 3 | `pedidos/verificar` agendado no n8n | **não verificável daqui**; confirmar no n8n. É a rede de proteção do item 1 | conferir no n8n |
| 4 | Conteúdo institucional e termos revisados | **aberto**: publicado não é revisado | Brilhax |
| 5 | Destino dos 21 inativos do sitemap antigo | **aberto** | Brilhax |
| 6 | Indexação e Merchant | **aberto** | acesso da Brilhax ao Search Console e ao Merchant |

O prazo de 14 dias de observação conta a partir da virada, e o desligamento do
legado continua exigindo autorização explícita.
