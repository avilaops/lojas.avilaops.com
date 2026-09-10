# Brilhax: checklist da virada de domínio

Complementa `migracao-brilhax.md`, que tem o plano. Este é o documento da
troca. Revisado em 10/09/2026, segunda auditoria.

**Nada aqui foi executado.** `brilhax.com` segue no ar, intocado; os redirects
estão prontos e **não aplicados**; nenhum pagamento real foi feito.

> **A virada está BLOQUEADA.** Ver "Bloqueadores" no fim.

## O que a segunda auditoria mudou

Três conclusões da primeira rodada estavam erradas e foram corrigidas.

**O mapa de redirects tinha 117 regras e devia ter 12.** O plano mantém
`brilhax.com` como endereço definitivo: a plataforma passa a atender o mesmo
domínio. Isso é troca de infraestrutura sob a mesma URL, não mudança de
endereço. `brilhax.com/produtos/glazy-500ml/` e `/produtos/glazy-500ml` são o
mesmo endereço menos a barra, e o Next já devolve 308. As 105 regras a mais
apontavam para o subdomínio de homologação, o que **moveria o site para lá**.

**"145 produtos vieram sem preço" era 224 − 79, não uma consulta.** São 142 sem
preço e 3 que têm preço e vieram como rascunho do Medusa.

**"79 ativos com preço e imagem" também estava errado.** São 79 com preço, dos
quais 62 com imagem e 17 sem. Os 17 são exatamente os que ficam fora do feed.

## Catálogo reconciliado

Tabela por produto em `deploy/brilhax/catalogo-reconciliado.csv` (224 linhas,
com id, slug, status de origem e atual, preço, estoque, imagem, feed, motivo de
exclusão e presença no sitemap antigo).

| Conjunto | Quantos | Como se explica |
|---|---|---|
| Importados | 224 | 225 do Medusa menos o produto "teste" |
| Ativos | 79 | têm preço |
| … com imagem | 62 | **entram no feed** |
| … sem imagem | 17 | fora do feed: `image_link` é obrigatório no Merchant |
| Inativos | 145 | 142 sem preço + 3 rascunhos com preço |
| No sitemap antigo | 100 | 79 hoje ativos + 21 hoje inativos |

**Indexação pelo Google: NÃO VERIFICADO.** A conta de serviço só alcança
`sorroche.beauty`, `saudepet.app.br` e `brasamineira.com.br`; `brilhax.com` não
está entre as propriedades. Onde este documento diz "indexado", leia "publicado
no sitemap antigo", que é outra coisa.

## Redirects

`deploy/brilhax/redirects.caddy` — **12 regras**, testadas numa instância
isolada do Caddy (porta 8899, container próprio, removido depois).

| Origem | Status | Location | Saltos | Por quê |
|---|---|---|---|---|
| `/produtos/categoria/lavagem/` | 301 | `/categoria/lavagem` | 1 | a plataforma serve categoria na raiz |
| `/produtos/categoria/kits/` | 301 | `/categoria/kits-completos` | 1 | slug mudou: a plataforma gera pelo nome |
| `/produtos/categoria/moto/` | 301 | `/categoria/produtos-para-moto` | 1 | idem |
| `/produtos/categoria/lavagem/?pagina=2` | 301 | `/categoria/lavagem?pagina=2` | 1 | parâmetro preservado |
| `/politica-de-envio/` | 301 | `/politicas/envio` | 1 | políticas agrupadas |
| `/termos-de-uso/` | 301 | `/politicas/termos` | 1 | idem |
| `/produtos/glazy-500ml/` | — | — | 0 | **sem redirect**: mesma URL |
| `/`, `/sobre/`, `/contato/` | — | — | 0 | idem |
| `/produtos/categoria/lavagem/extra/` | — | — | 0 | nunca existiu: 404 da aplicação |

O teste isolado achou um erro que a conferência de destinos não acharia: a
regra `redir /produtos/categoria/* … {path.1}` mandava **todas** as categorias
para `/categoria/categoria`, porque `path.1` é o segundo segmento. Só apareceu
porque a regra foi executada.

### O que NÃO foi decidido: os 21 produtos

21 URLs publicadas no sitemap antigo apontam para produto hoje inativo. A
versão anterior os mandava para a categoria. **Isso foi revertido**, por dois
motivos:

1. Produto temporariamente sem preço não é produto descontinuado. Redirect de
   massa para categoria é o padrão que o Google trata como soft 404.
2. **A plataforma já sabe lidar com isso.** `src/lib/produto-regras.ts` tem
   `sobConsulta()`: produto sem preço tem página, mostra "Preço sob consulta" e
   negocia pelo WhatsApp. É exatamente o que o site antigo faz hoje, e o que os
   termos antigos descrevem ("Produto sem preço exibido é produto cujo valor é
   consultado").

A decisão de importá-los como **inativos** foi minha, na Fase 2, e é o que os
tira do ar. Reativá-los como "sob consulta" preservaria as 21 páginas e
deixaria a loja abrir com 224 produtos visíveis em vez de 79.

**Não reativei nada.** É decisão comercial: ver "Decisões pendentes".

## Pagamento

### Testado, e o que cada teste prova

11 testes automatizados novos em
`packages/checkout/src/providers/mercadopago-webhook.test.ts` e 10 em
`lojas.avilaops.com/src/lib/pedidos-webhook.test.ts`. **Todos locais, sem
rede.** O provedor do Mercado Pago não tinha teste nenhum: PayPal e Éfi tinham.

| O que se queria saber | Como foi provado |
|---|---|
| Assinatura válida é aceita | HMAC-SHA256 do manifesto do MP; aceita |
| Assinatura de outra loja é recusada | segredo trocado devolve `null` |
| Corpo adulterado é recusado | assinatura de `111` com corpo `999` recusada |
| Confirma pelo gateway, não pelo corpo | a rota chama `consultar()` e usa a resposta |
| Assinatura inválida não consulta nem grava | 401, sem chamar consultar nem atualizar |
| Duplicado não baixa estoque duas vezes | `avancaDeAguardando` bloqueia |
| Evento fora de ordem não regride | pedido `ENVIADO` não volta a `PAGO` |
| Estorno vale mesmo depois de enviado | `ESTORNADO` é aplicado sempre |
| Pendente, recusado, cancelado, expirado | cada status chega sem tradução |
| Falha temporária não confirma às cegas | erro em `consultar()` devolve 200 e não altera |
| Isolamento entre lojas | busca filtra `tenantId`; segredo é por loja |
| Segredos não vazam | resposta não contém o token nem o segredo |

### O que foi corrigido, e é sério

**O valor não era conferido.** O webhook confirmava o pedido só pelo id do
pagamento: um pagamento de um real fecharia um pedido de quinhentos. Agora
`criarRotaWebhook` repassa `valorEmCentavos` vindo da consulta ao gateway, e
`atualizarStatusPagamento` recusa a confirmação quando ele diverge do total,
gravando `divergencia:<status>:<valor>` para aparecer na conciliação.

Estorno e cancelamento seguem valendo mesmo com valor divergente: o cliente não
pode ficar preso a um pedido que o gateway já desfez.

**Mudança compartilhada por todas as lojas**, com regressão nos 10 testes de
`pedidos-webhook.test.ts`.

### O que NÃO foi testado

- **Sandbox do Mercado Pago**: não usado. Trocar as credenciais de produção por
  credenciais de teste foi proibido nesta rodada, e a conta não tem par de
  teste configurado.
- **Pagamento real**: nenhum. Mostrar Pix, cartão e boleto na tela não prova
  que os três funcionam.
- **Webhook em produção com evento real**: o único evento que chegou foi o
  teste do painel do Mercado Pago, em 09/09, que respondeu 200.

### Roteiro da compra real — PARA APROVAÇÃO, não executado

| Item | Proposta |
|---|---|
| Produto | AROMINHA CARRO NOVO SCENT |
| Valor | R$ 15,00 (o menor do catálogo ativo) |
| Meios | um pedido em Pix, outro em cartão |
| Quem paga | Nicolas, conta pessoal |
| Recebedor | BRILHAXCAR (conta do cliente) |
| Estoque | o produto não controla estoque; nada a repor |
| Conferir | pedido `PAGO` no painel, valor idêntico, pagamento na conta MP |
| Estorno | pelo painel do MP, mesmo dia, **exige autorização à parte** |
| Risco | R$ 30 em dois pedidos, estornáveis |

## Conteúdo institucional (Fase 4)

| | Técnico | Aprovação |
|---|---|---|
| Sobre | pronto | conteúdo vem do cadastro |
| Contato | pronto | idem |
| Envio e retirada | pronto | gerado do cadastro |
| Trocas e devoluções | pronto | base no art. 49 do CDC |
| Privacidade | pronto | base na LGPD |
| **Termos de uso** | **publicado** | **NÃO REVISADO** |
| Canonical, sitemap, robots | pronto | — |

**Os termos estão implementados e publicados, não revisados.** Texto gerado e
referência ao CDC não são adequação jurídica. Quem responde pela Brilhax
precisa ler antes de a loja vender no domínio da marca, e decidir sobre o que
não está lá: prazo de garantia próprio, política de erro de preço além do
mínimo legal e foro.

## SEO: pré e pós virada

`urlDaLoja()` usa `dominioPrincipal` quando existe. Hoje é nulo, então
canonical, sitemap e feed apontam para o subdomínio; ao definir
`dominioPrincipal = "brilhax.com"`, os três passam a apontar para o domínio
final sozinhos. **Conferir depois da virada, não presumir.**

**Corrigido nesta rodada:** loja com domínio próprio servida por outro endereço
passa a devolver `noindex, follow`. Sem isso o subdomínio da plataforma
competiria com o domínio da marca — a Vedashow está nessa situação hoje.
`follow` fica ligado, e o robots.txt **não** bloqueia essas URLs de propósito:
página bloqueada não é rastreada, e sem rastrear o Google não lê o `noindex`.
Isso não substitui autenticação: carrinho, checkout e API seguem com as
próprias barreiras.

Antes da virada a homologação continua indexável, porque ali o subdomínio é o
endereço oficial da loja. Oito testes em `endereco-oficial.test.ts` cobrem os
dois sentidos: marcar a loja de verdade como `noindex` a tiraria do Google
inteira.

## Dados além do catálogo

Levantado no banco do Medusa:

| | Quantos | O que são |
|---|---|---|
| Pedidos | 3 | todos de teste: `teste.deploy@`, `nicolasrosaab@`, `ecommerce@` |
| Pagamentos | 3 | todos `pp_system_default` ("combinar com a loja"), **nenhum capturado** |
| Clientes | 21 | 6 internos e 15 `@storebotmail.joonix.net`, que é robô de teste do Google |
| Carrinhos abertos | 28 | do período de testes |

**A loja nunca vendeu.** Não há pedido, pagamento nem cliente real para migrar,
e é isso que torna a virada de baixo risco. Se alguma venda acontecer entre
hoje e a virada, este levantamento precisa ser refeito.

**Estoque:** duas variantes controlam estoque no Medusa; na plataforma nenhum
produto controla (`estoque: null`). Enquanto o legado não vender, não há
divergência possível. Depois da virada só uma operação vende, porque o domínio
aponta para um lugar só.

## O dia da virada

1. **Backup, com restauração verificada**
   - [ ] Dump do banco `lojas` e **restaurar num banco descartável** para
         provar que o dump presta. Dump não testado não é backup.
   - [ ] Dump de `medusa_store`, idem.
   - [ ] `/opt/brilhax-stack/.env` e `/opt/lojas/.env`.
   - [ ] Guardar o `standalone.tgz` no ar hoje.

2. **DNS e TLS**
   - [ ] `brilhax.com` e `www` para o servidor da plataforma, sem proxy laranja.
   - [ ] `PATCH` no tenant com `dominioPrincipal` e `dominios`.
   - [ ] **Certificado emitido antes de mandar tráfego.**
   - [ ] Conferir que o domínio serve a loja certa (e não outra do servidor).
   - [ ] **Não tocar no MX.** O e-mail da Brilhax fica onde está.

3. **Redirects**
   - [ ] Aplicar as 12 regras no bloco do domínio.
   - [ ] Conferir a tabela acima, incluindo os casos que **não** redirecionam.

4. **Depois de virar, conferir o que só existe no domínio final**
   - [ ] Canonical apontando para `brilhax.com`.
   - [ ] Sitemap e feed com URLs de `brilhax.com`.
   - [ ] Subdomínio de homologação servindo `noindex`.
   - [ ] Search Console: mudança de endereço e sitemap novo.

## Monitorar por 14 dias

404 vindo de URL antiga · 5xx · pedidos e pagamentos conferidos um a um contra
o painel do MP · páginas indexadas.

**Os 14 dias são janela de observação, não autorização automática para
desligar.**

## Voltar atrás

Enquanto o stack antigo estiver de pé, a volta é DNS. **Mas pedido recebido
depois da virada mora na plataforma**: voltar o DNS não os apaga, e eles
precisam continuar sendo atendidos de lá. O rollback é do site, nunca dos
pedidos.

## Desligar o legado

Só com todos: 14 dias completos · zero 404 de URL antiga · indexação estável ·
ao menos um pedido pago conferido · cliente ciente de que a volta deixa de ser
rápida.

**Desligar o Medusa não remove os redirects.** As 12 regras ficam na
infraestrutura nova, por pelo menos um ano, que é a orientação do Google.

## Decisões pendentes (comerciais e de conteúdo)

1. **Os 145 inativos.** Manter fora (loja abre com 79) ou reativar como "sob
   consulta" (abre com 224, preserva 21 URLs). A plataforma suporta os dois; a
   escolha é de quem vende.
2. **Boleto.** Está habilitado no cadastro (`meiosPagamento: pix, cartao,
   boleto`), não só na tela. Compensa em até 3 dias úteis, e nesse intervalo o
   produto sai do estoque sem o dinheiro ter entrado — hoje sem impacto,
   porque nenhum produto controla estoque. Manter ou desligar é decisão do
   cliente; **não mexi**.
3. **Termos de uso**: revisão de quem responde pela Brilhax.
4. **Merchant Center**: não existe conta no CNPJ da Brilhax até onde consigo
   verificar, e não criei nenhuma. Sem ela o feed não é lido.
5. **17 produtos sem foto** e **142 sem preço**: trabalho de catálogo.

## Bloqueadores da virada

| # | Bloqueador | Quem resolve |
|---|---|---|
| 1 | Nenhum pagamento real testado | autorização para a compra de teste |
| 2 | Termos não revisados juridicamente | Brilhax |
| 3 | Destino dos 145 inativos não decidido | Brilhax |
| 4 | Correção do valor no webhook ainda **não publicada** | autorização de deploy |
| 5 | Indexação no Google não verificável | acesso ao Search Console de brilhax.com |
