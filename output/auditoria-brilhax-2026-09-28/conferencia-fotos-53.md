# Conferência das fotos dos 53 produtos restantes (28/09/2026)

Feita depois do deploy do PR #34, quando `/uploads` voltou a responder. Foram baixadas e vistas as 216 imagens dos 53 produtos que estavam com "foto pendente". As pranchas estão em `fotos-conferidas/depois-do-deploy-*.webp`.

## Problemas confirmados

**Fotos principais geradas ou redesenhadas, com texto de rótulo errado (7).** Não são a embalagem oficial: o nome ou os textos do rótulo saem trocados. Ver `fotos-conferidas/principais-geradas.webp`.

| # | Produto | O que está errado | Substituto disponível |
|---|---|---|---|
| 16 | Delet 5 L | "LIMPA PEHUS E BORRACHAS", texto ilegível | obter foto oficial |
| 18 | Extractus 1 L | "EXRACTUS", "INMUNDEZAL" | obter foto oficial |
| 70 | Hydrox Fast 500 ml | "EFFETTO IDROFOBICO", "Psicó automático" | adicional 1 |
| 75 | Revox 500 ml | "REYOX" | adicional 2 |
| 76 | Sinergy Paint 500 ml | "SNERGY", texto ilegível | obter foto oficial |
| 77 | Tryon 500 ml | textos de outro produto ("Repele a água", "Brilho pneus") | adicional 1 |
| 79 | SiO2-Pro 500 ml | "BILHO INTENS", "PROTECCO DURADOURA" | obter foto oficial |

**Marca de outra loja na imagem (3 produtos novos, além de Lamax e Massa de Polir 1,8 kg já apontados):**
- #33 V-Floc 1,5 L: adicional 2 com etiqueta "Vonixx Mossoró" e moldura de outra loja; adicional 3 com selo "E".
- #56 Massa de Polir 1,8 kg: a **foto principal** tem a mesma etiqueta "Vonixx Mossoró".
- #71 Intense 500 ml: adicional 1 com logo de outra loja; adicional 2 com marca d'água "@POLIBOX".
- #18 Extractus: adicional 4 com trechos de texto apagados a borrão.

## Suspeitas a confirmar com o lojista
- #2 Aplicador Vintex: título diz pacote com 2, todas as fotos mostram 1 unidade.
- #8 Arominha: rótulo mostra a marca "aromas city", 100 ml. Resolve a pendência da marca, se confirmada.
- #30 Strike 1,5 L: adicional 1 é arte de rede social ("Mais um pedido realizado").
- #67 Darker 500 ml: adicional 2 tem selo circular "3" de origem desconhecida.

## Observações sem ação obrigatória
- Baixa resolução na principal: #37 (450×420), #65 (379×496), #66 (346×721; a adicional 1 é a mesma embalagem em 922×1920). #76 tem adicionais de 300 px.
- Rótulo em versões diferentes dentro da mesma galeria: #13, #20, #21.
- Os outros 34 produtos conferem com título, marca e apresentação.

Todas as trocas de imagem estão em `alteracoes-propostas.json` com `aplicado: false`. Nada foi alterado no banco.
