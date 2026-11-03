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
