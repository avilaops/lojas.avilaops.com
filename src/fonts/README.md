# Fontes locais

## Playfair Display

`playfair-display-variable.ttf` é o arquivo original `PlayfairDisplay[wght].ttf`
do repositório oficial Google Fonts, commit
`8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5`, pasta `ofl/playfairdisplay`.
Git blob do arquivo: `7a09eb71f10622fd083134ac9ed46f59b21bee18`.
A licença original acompanha o arquivo em `OFL-playfair-display.txt`.

O arquivo variável completo preserva os glifos da família e é declarado nos
pesos 400 a 700 usados pelo tema. O Next o publica no mesmo domínio e a
pré-carga continua condicionada à família escolhida pela loja.

Foi incorporado após duas falhas de CI com
`next/font/google queries have exactly one entry`, no carregador Playfair.
O problema está registrado em <https://github.com/vercel/next.js/issues/99114>.
Não há download dessa família durante o build.

## DM Serif Display

O arquivo WOFF2 latino existente mantém sua licença em
`OFL-dm-serif-display.txt`.

## Montserrat

`montserrat-variable.ttf` é o arquivo original `Montserrat[wght].ttf`
do repositório oficial Google Fonts, commit
`eb20e9cf19d97cf579fa3867d729d4222d6c59e1`, pasta `ofl/montserrat`.
Git blob do arquivo: `c97aca18592834d8706549c279cb8d5ac5d85f69`.
SHA-256: `0f7b311b2f3279e4eef9b2f968bcdbab6e28f4daeb1f049f4f278a902bcd82f7`.
A licença original acompanha o arquivo em `OFL-montserrat.txt`.

O arquivo completo mantém os glifos e o eixo variável original 100–900.
O tema continua declarando os pesos 400, 600, 700 e 800 em faces normais,
com `display: swap`, sem pré-carga global. Todas apontam para o mesmo arquivo;
a pré-carga por loja continua deduplicando os pesos 400/700.

Foi incorporado após a CI de publicação `42066273513` falhar no carregador
Montserrat com `next/font/google queries have exactly one entry`, a mesma
classe de falha já tratada em Playfair Display. Não há download desta família
durante o build. Origem: <https://github.com/google/fonts/tree/eb20e9cf19d97cf579fa3867d729d4222d6c59e1/ofl/montserrat>.
