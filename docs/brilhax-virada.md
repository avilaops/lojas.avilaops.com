# Brilhax: checklist da virada de domínio

Complementa `migracao-brilhax.md`, que tem o plano. Este documento é a lista do
dia da troca. Escrito em 10/09/2026.

**Nada aqui foi executado.** A loja antiga (`brilhax.com`) segue no ar,
intocada, e os redirects estão prontos mas **não aplicados**.

## Onde estamos

| Fase | Situação | Evidência |
|---|---|---|
| 1. Layout automotivo | pronto e no ar | trilha com 3 passos em desktop e celular |
| 2. Loja em paralelo | pronta | 224 produtos, 79 ativos, 126 imagens |
| 3. Pagamento | configurado | gateway lê as chaves; access token não sai pela API |
| 4. Conteúdo institucional | pronto | 4 políticas, canonical em todas |
| 5. Redirects | preparados e validados, **não aplicados** | 117/117, 0 falhas, 0 loops |
| 6. Desligar o antigo | não iniciado, e só depois de duas semanas | — |

## Pré-requisitos para virar

Nenhum destes depende de mim; todos precisam de decisão ou de conteúdo da
Brilhax.

- [ ] **Uma compra de verdade, de valor baixo, na loja nova**, com Pix e com
      cartão, conferindo o dinheiro na conta Mercado Pago e o pedido no painel.
      É o único teste que prova o caminho inteiro, e não foi feito: não realizo
      pagamento real sem autorização.
- [ ] **Cliente aprova a loja nova** lado a lado com a atual.
- [ ] **Revisar os termos de uso.** O texto novo descreve a loja que vende
      online. O da loja antiga afirma o contrário e não pode ser reaproveitado
      (ver "Riscos").
- [ ] **Decidir sobre os 145 produtos inativos** (ver "Pendências").
- [ ] **Conta Google Merchant Center** no CNPJ da Brilhax, para o feed ser lido.

## O dia da virada, em ordem

1. **Backup antes de tudo**
   - [ ] Dump do banco da plataforma (`lojas`), com a Brilhax dentro.
   - [ ] Dump do banco do Medusa (`medusa_store`) no stack antigo.
   - [ ] Cópia do `/opt/brilhax-stack/.env` e do `/opt/lojas/.env`.
   - [ ] Guardar o `standalone.tgz` da versão que está no ar, para voltar.

2. **DNS**
   - [ ] `brilhax.com` e `www.brilhax.com` apontando para o servidor da
         plataforma, **sem proxy laranja** no Cloudflare.
   - [ ] `PATCH` no tenant com `dominioPrincipal` e `dominios`, que é o que
         alimenta o Caddy.
   - [ ] Conferir que o certificado TLS foi emitido para o domínio antes de
         mandar tráfego.
   - [ ] **Não tocar no MX.** O e-mail da Brilhax fica onde está; mexer no MX
         ao trocar o site é o erro clássico e derruba a caixa do cliente.

3. **Redirects**
   - [ ] Aplicar `deploy/brilhax/redirects.caddy` no bloco do domínio.
   - [ ] Conferir por amostragem: um produto ativo, um inativo, uma categoria,
         uma política e a home. Todos 301, destino 200.
   - [ ] Conferir que `www` responde 308 para o apex.

4. **Search Console**
   - [ ] Ferramenta de mudança de endereço, do domínio antigo para o novo.
   - [ ] Enviar o sitemap novo.
   - [ ] Guardar o número de páginas indexadas do dia, para comparar depois.

## Monitorar, nas duas semanas seguintes

- [ ] **404 no domínio novo**: qualquer URL antiga que apareça aqui é redirect
      que faltou. Conferir diariamente na primeira semana.
- [ ] **5xx**: erro de aplicação sob tráfego real, que o teste não pega.
- [ ] **Pedidos**: comparar o volume com o do site antigo no mesmo período.
- [ ] **Pagamentos**: todo pedido `PAGO` tem correspondente no painel do
      Mercado Pago. Divergência aqui é o pior tipo de problema.
- [ ] **Páginas indexadas** no Search Console: queda além de 20% na primeira
      semana pede investigação, não espera.

## Voltar atrás

Enquanto os cinco containers do stack antigo estiverem de pé, a volta é DNS:
apontar `brilhax.com` de novo para o servidor antigo e remover os redirects. Em
minutos.

Depois de desligados, a volta passa a exigir subir os containers de novo a
partir do backup, o que leva horas. **É por isso que o desligamento espera duas
semanas**, e não porque o prazo seja bonito.

## Critérios para desligar a loja antiga

Só depois de **todos**:

- [ ] Duas semanas completas com o domínio novo no ar.
- [ ] Zero 404 vindo de URL que existia na loja antiga.
- [ ] Páginas indexadas estáveis ou em recuperação no Search Console.
- [ ] Pelo menos um pedido pago de verdade, conferido na conta Mercado Pago.
- [ ] Cliente ciente de que a volta deixa de ser rápida.

Aí sim: backup final, `docker compose down`, imagens removidas, e o repositório
`avilaops/brilhax.com` arquivado.

## Pendências que dependem da Brilhax

**145 produtos inativos.** Vieram sem preço do Medusa e entraram desativados,
porque produto a R$ 0,00 na vitrine é pior que produto ausente. Desses, 19
estavam indexados no Google e hoje o redirect os manda para a categoria. Assim
que o preço for cadastrado, cada um volta com um clique. **A loja abre com 79
produtos à venda, não 224** — isso precisa estar claro para o cliente.

**17 produtos sem foto** (boinas e espumas de polimento). Ficam fora do feed do
Google de propósito, porque item sem imagem é reprovado pelo Merchant Center.

**Termos de uso.** O texto publicado descreve a loja como ela é hoje: com
carrinho, checkout e pagamento online. Precisa da leitura de quem responde pela
Brilhax antes de valer como documento. Não inclui prazo de garantia próprio,
política de erro de preço além do mínimo legal, nem foro: se a Brilhax tiver
regra própria nesses pontos, ela precisa ser dita.

**Boleto.** Hoje o checkout aceita cartão e Pix. Boleto leva de um a três dias
úteis para compensar e nesse meio tempo o produto sai do estoque sem o dinheiro
entrar. É decisão comercial.

## Riscos antes da virada

**O texto antigo dos termos contradiz a loja nova.** Os termos publicados em
`brilhax.com/termos-de-uso/` dizem, com todas as letras, que o site "não tem
carrinho nem checkout: o pedido é fechado no atendimento". Isso era verdade
quando o site era catálogo. Hoje a loja cobra cartão e Pix. Reaproveitar aquele
texto publicaria informação falsa justamente na página que existe para dar
segurança jurídica, e é o tipo de contradição que um cliente insatisfeito usa.
Por isso os termos foram reescritos e **não** copiados.

**Dois slugs de categoria mudaram na importação.** `kits` virou
`kits-completos` e `moto` virou `produtos-para-moto`, porque a plataforma gera o
slug a partir do nome. As duas URLs antigas estão indexadas e são tratadas por
regra específica no mapa. Sem ela, seriam dois 404.

**19 URLs de produto indexadas apontam para item que não está à venda.** O
redirect as manda para a categoria, que é a recomendação do Google para item
fora de linha. Se os preços forem cadastrados antes da virada, essas 19 voltam a
apontar para o produto e o mapa precisa ser gerado de novo.

**Nenhum pagamento real foi testado.** O fluxo foi validado até o ponto seguro:
o gateway está configurado, o checkout monta, e no site antigo o mesmo provedor
recusou corretamente um pedido sem pagamento. Mas dinheiro de verdade entrando
na conta da Brilhax, ninguém viu ainda.
