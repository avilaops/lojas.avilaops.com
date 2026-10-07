# VedaShow — validação de 27/09/2026

## Resultado publicado

A loja está publicada em https://vedashow.com.br pelo fluxo existente de SSH e Docker. PRs 28 e 29 integrados à main `346989539548c99cc90b585b30c721be08f6b37b`.

- Artefato: commit `428d2154d16cbb5e7dc1f9ce4167fec980059570`, incluído na main acima.
- Next build: `prHZ29FhoPH0aV4qdNy7K`.
- Manifesto público: https://vedashow.com.br/versao.json.
- SHA256 do pacote: `36bba9a07976193dabdc8c59ab4ec3c1a8524d82a035315c1d40c0fbd2c6ee61`.
- Republicação integral aprovada: migrações sem pendências, container ativo, saúde e CSS corretos.
- Rollback da versão imediatamente anterior preservado em `/opt/lojas/rollback/vedashow-20260927-rx`; script anterior também preservado.

## Causa e correções

O build original `92RTppYHRALFeiWUPGZGL` selecionava `somenteImagem` em Distribuidora e nos atalhos. Produção tinha código e imagens ainda não registrados na branch principal. `antes.png` documenta a grade sem informações.

Categorias agora têm nomes. A home apresenta seções, ajuda para busca técnica e oito produtos com nome, código, atributos existentes, preço e ação comercial. A busca prioriza códigos exatos e compara medidas mantendo sua ordem; filtros combinam categoria, marca e especificações disponíveis. Não foram inventadas medidas nem convertidas medidas imperiais por suposição.

As publicações simultâneas da Brilhax `91ONMw6C_SUm0nR5_GQHV` e `rx-99AgFSYjaMlK64rKiK`, suas artes e fotos foram preservadas. A republicação também corrige o empacotamento do binding Linux do ONNX; o deploy passa a validar ONNX e Sharp antes de substituir a aplicação.

## Validação

- TypeScript, build de produção e ESLint dos componentes alterados e da busca aprovados.
- 417 testes aprovados, zero falhas.
- Quinze cenários HTTP/conteúdo aprovados na prévia e novamente em produção, além de sugestões e paginação. Evidência: `producao-http.log`.
- SKU 5465 retorna rolamento GBR 6204, R$ 5,50; Correia 3L300 retorna o item GBR.
- `35 x 52 x 8,5` e `35 mm × 52 mm × 8.5 mm` retornam retentor SAV SKU 2328, R$ 7,00. Ordem invertida não retorna correspondência indevida.
- Pares explícitos no nome mantêm a ordem; não são inferidos a partir de três dimensões.
- Categoria Retentores + Sav + medidas combinadas retorna o produto correto.
- Paginação: 48 itens por página, sem sobreposição entre páginas 1 e 2; página fora do limite retorna 404.
- Smoke oficial de publicação aprovado em VedaShow e Brilhax após a republicação final.
- Vinte imagens da home responderam com HTTP 200, conteúdo de imagem e tamanho válido. URLs e tamanhos em `publicacao.json`.
- Inspeção visual de produção em desktop e celular: sem rolagem horizontal; cards legíveis; WhatsApp flutuante não cobre os cards no celular. Console sem erros ou avisos registrados.
- Busca por medida com categoria e marca conferida no DOM e na captura de produção `busca-medida.png`.

Interações verificadas na prévia: busca por código, abertura de produto, retorno preservando consulta, filtros e limpeza, abertura do perfil WhatsApp com o item correto. Nenhuma mensagem enviada. Estados sem imagem, sem preço e sem estoque foram conferidos no catálogo.

## Evidências visuais

- `antes.png`: home original.
- `depois-desktop.png`: home publicada.
- `depois-mobile.png`: cards publicados em 390 px.
- `busca-medida.png`: resultado publicado com filtros.
- `orcamento.png`: abertura do orçamento no WhatsApp durante a prévia.

## Pendências específicas

O-rings: 741 ativos, só uma seção de cordão explicitamente cadastrada. Rolamentos: 1.290 ativos, apenas 50–55 com medidas estruturadas. Correias: 95 ativos, 73 referências e dois perfis preenchidos. Os filtros usam apenas atributos presentes.

GitHub Actions impedido de iniciar por faturamento/limite da conta; a main não tinha checks obrigatórios configurados. As validações locais e de produção foram executadas independentemente.

O atendimento público continua por WhatsApp, conforme o estado comercial existente. Nenhum preço, estoque, pagamento ou pedido real foi alterado. Checkout de pagamento não foi ativado nesta entrega.
