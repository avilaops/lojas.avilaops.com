# Validação dos templates

Rotina que abre a prévia do painel (`/painel/previa?t=…`) para cada template e
mede, em vez de olhar e achar. São **96 casos**: 12 layouts × 2 viewports × 2
modos × 2 preferências de movimento.

| Eixo | Valores |
| --- | --- |
| Layout | os 12 de `VALORES_LAYOUT` (`src/lib/tema.ts`) |
| Viewport | `movel` 390×844 e `desktop` 1280×800 |
| Modo | `claro` e `escuro` (o `modo` do tema, gravado em `data-modo`) |
| Movimento | `normal` e `reduzido` (`prefers-reduced-motion: reduce`) |

- `src/lib/validacao-templates.ts`: a matriz (`casosDeValidacao`), o julgamento
  (`avaliarMedida`) e o filtro de erro de console (`ePreCarregamentoDeLink`). Puro, preso em `src/lib/validacao-templates.test.ts`, que
  entra em `npm test`.
- `scripts/validar-templates.mts`: abre cada caso no Chromium, mede e sai com
  `1` se algum falhar.

## O que cada caso mede

Um caso passa quando nenhuma destas regras dispara:

1. **Desenhou.** O contêiner `div[data-layout]` existe e traz o layout do caso.
   Rascunho recusado, sessão que caiu e redirecionamento para `/entrar` falham
   aqui.
2. **Modo aplicado.** `data-modo` do `<html>` é o modo do caso.
3. **Não vaza de lado.** A página não passa da largura da tela; a falha traz o
   primeiro elemento culpado. A faixa fixa da prévia não conta.
4. **Sem erro de página.** Nenhuma exceção e nenhum `console.error` (recurso
   que não carrega, como imagem quebrada, entra aqui). Fica de fora uma coisa
   só: requisição de pré-carregamento de link (`?_rsc=`) que voltou **404**. A
   home aponta para páginas da loja, que não existem no domínio do painel, e
   isso é da prévia, não do template. Qualquer outro status no `_rsc` (500, 403)
   ou falha de rede reprova, assim como 404 em recurso sem `_rsc` e em
   `/painel/previa`. Quem decide é `ePreCarregamentoDeLink`
   (`src/lib/validacao-templates.ts`), presa em `npm test`. O resultado guarda
   quantos foram ignorados em `preCarregamentosIgnorados`.
5. **Contraste AA do texto base.** Cor do `body` sobre o fundo do `body`, no
   mínimo 4,5:1 (`contraste` de `src/lib/tema.ts`).
6. **Movimento reduzido de verdade** (só nos casos `reduzido`): nenhuma animação
   ativa (`document.getAnimations()`) e nenhum elemento, `::before` ou `::after`
   do template com `transition-duration` maior que zero.

A regra 6 é o que a regra geral de `src/app/globals.css`
(`[data-layout] *` dentro de `@media (prefers-reduced-motion: reduce)`) atende
para os onze layouts comuns; o Automotivo Premium tem a sua em `premium.css`.

## Como o script espera e o que ele substitui

- **Espera `load`, fontes e imagens do palco, mais 1,5 s.** Não espera
  `networkidle`: o Next não lê o corpo do 404 dos pré-carregamentos, a
  requisição fica aberta e a rede nunca sossega (a primeira rodada estourou os
  60 s em todos os casos por isso).
- **Imagens do tema de teste.** As duas de
  `tests/fixtures/tema-premium-completo.json` não existem (`exemplo.test` e
  `/media/automotivo-premium/…`); o script responde as duas com uma imagem
  cinza, para o Automotivo Premium não falhar por endereço de teste. A troca é
  por **endereço exato**, sem curinga (`IMAGENS_DO_FIXTURE` no script): outra
  imagem quebrada, mesmo no mesmo host ou na mesma pasta, vai à rede e reprova.
- **Só `localhost` ou `127.0.0.1`.** Qualquer outra base é recusada, com ou sem
  `SESSAO`.

## Limites

- **Só a home.** A prévia não desenha produto, categoria, carrinho nem checkout.
- **Catálogo de demonstração** (`catalogoDeDemonstracao`), não o de uma loja. Nome
  técnico longo ou foto fora de proporção de um catálogo real não aparecem aqui.
- **Só Chromium.** WebKit e Firefox ficam de fora.
- **Não compara imagem.** `--retratos` grava um PNG por caso para conferência a
  olho; nada é comparado com retrato anterior.
- **Julgamento estético fica de fora.** As regras são as mensuráveis.
- **Não roda no CI.** O pipeline constrói a imagem do `Dockerfile`, que não tem
  navegador. A rotina é manual; a matriz e o julgamento rodam em `npm test`.

## Como rodar

Precisa de Chromium (com as bibliotecas de sistema dele) e do banco de teste em
Docker. É trabalho pesado: um passo por vez.

```
# 1. navegador (uma vez)
npx playwright install --with-deps --only-shell chromium

# 2. banco de teste (container lojas-db-test, 127.0.0.1:5548)
npm run banco:teste

# 3. build e servidor local, só no loopback
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5548/lojas_test
export LOJAS_SECRET=$(openssl rand -hex 32)
export LOJAS_BASE_DOMAIN=localhost
npm run build
npx next start -p 3099 -H 127.0.0.1 &

# 4. validação
npx tsx scripts/validar-templates.mts http://localhost:3099 --retratos .work/engineer/retratos

# 5. limpar
kill %1
npm run banco:teste:parar
```

`LOJAS_BASE_DOMAIN=localhost` faz o `src/proxy.ts` tratar `localhost` como o
domínio-base, e é o que leva `/painel/previa` à prévia. O `LOJAS_SECRET` precisa
ser o mesmo no servidor e no script, por isso o `export`.

### Sessão

A prévia exige sessão de lojista. Há dois caminhos:

- **`SESSAO=<cookie lojas_sessao>`**: o script usa o cookie e não toca em banco.
- **Sem `SESSAO`**: o script cria (ou reativa) a loja `qa-validacao-templates` e
  emite o token. Só aceita `DATABASE_URL` em `127.0.0.1|localhost:5548/*_test`,
  a mesma guarda da suíte de integração; em qualquer outro banco ele sai com
  erro. É a única escrita da rotina.

Rodar só contra `localhost` e o banco de teste, nunca contra produção ou loja
real: o script recusa base que não seja `localhost` ou `127.0.0.1`.

### Opções

- `--so <layout>`: roda só os 8 casos de um layout.
- `--retratos <dir>`: grava `<id>.png` de cada caso.
- `CHROMIUM=/caminho/chrome`: usa um navegador já instalado.

## Como ler a saída

Uma linha por caso, com o id `<layout>.<viewport>.<modo>.<movimento>`:

```
ok      classico.movel.claro.normal
FALHOU  mercado.movel.escuro.reduzido
          · 14 elemento(s) com transição com movimento reduzido
```

No fim, a contagem (`96 casos · 95 passaram · 1 falharam`) e o caminho do
resultado completo, `.work/engineer/validacao-templates.json` (fora do git):
para cada caso, as falhas, a medida inteira e até seis exemplos de elemento com
transição. Código de saída `0` quando todos os casos rodados passam, `1` quando
algum falha ou quando o script não consegue rodar.

Falha que se resolve em CSS (`src/app/globals.css` ou
`src/components/templates/automotivo-premium/premium.css`) se corrige junto.
Falha que pede mudar componente vira item próprio, com layout, viewport e
culpado.

## Rodadas

- **2026-10-06, 96/96.** A primeira rodada deu 92/96: o Automotivo Premium
  vazava 45 px no celular em loja sem logo e com nome comprido, porque
  `.ap-marca` não encolhia e empurrava os botões do cabeçalho para fora da tela.
  Corrigido em `premium.css` (o nome encolhe e corta com reticências até
  767 px). `/carrinho` e `/checkout`, que a prévia não cobre, foram abertos à
  parte numa loja de teste com um item no carrinho, nos layouts Clássico e
  Automotivo Premium, com `prefers-reduced-motion: reduce`: conteúdo inteiro,
  nenhuma transição e nenhuma animação.
