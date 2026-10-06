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

- `src/lib/validacao-templates.ts`: a matriz (`casosDeValidacao`) e o julgamento
  (`avaliarMedida`). Puro, preso em `src/lib/validacao-templates.test.ts`, que
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
   que não carrega, como imagem quebrada, entra aqui).
5. **Contraste AA do texto base.** Cor do `body` sobre o fundo do `body`, no
   mínimo 4,5:1 (`contraste` de `src/lib/tema.ts`).
6. **Movimento reduzido de verdade** (só nos casos `reduzido`): nenhuma animação
   ativa (`document.getAnimations()`) e nenhum elemento, `::before` ou `::after`
   do template com `transition-duration` maior que zero.

A regra 6 é o que a regra geral de `src/app/globals.css`
(`[data-layout] *` dentro de `@media (prefers-reduced-motion: reduce)`) atende
para os onze layouts comuns; o Automotivo Premium tem a sua em `premium.css`.

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
real.

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
