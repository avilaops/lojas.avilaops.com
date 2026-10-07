# VedaShow — acabamento e validação em produção

Rodada iniciada em 27/09/2026 e concluída em 28/09/2026. Publicação pelo fluxo existente via SSH.

## Entrega visual

- Fotos originais recuperadas dos SKUs 5465 (6204 2RSC3 GBR) e 1576 (P207 GBR). A foto do P207 tem 900 × 900 px. A ficha dimensional do rolamento permanece na galeria dos detalhes, sem substituir a foto na vitrine.
- Associação comprovada pelo manifesto local `D:/avilaops.com/vedashow/data/fotos.psv`: SKU 5465 → imagens/5398/9cb20d8347ff.png; SKU 1576 → imagens/1573/bfb9d2120605.png.
- Medidas recuperadas das fichas originais: 6204 com diâmetros 20/47 mm e altura 14 mm; P207 com eixo 35 mm, largura 48 mm e comprimento 167 mm. Não foi confundida medida de eixo com diâmetro do alojamento.
- Alterações registradas por `salvarProdutoNoCatalogo`, a mesma camada oficial usada pela API, com histórico e versão do produto. Preços e estoques comparados antes/depois e preservados.
- Nome e medidas em destaque. SKU e marca em segundo plano; referências de ERP continuam nos detalhes.
- Foto sem alternância por hover no catálogo técnico: ficha dimensional não reaparece no lugar da foto.
- Logo ampliada, sem repetição do nome. Banner menor, cards mais compactos, preços e botões alinhados em cada linha.
- WhatsApp flutuante oculto onde os cards técnicos já oferecem o pedido, inclusive no desktop.

## Medidas verificadas no navegador

Viewport de 390 × 844 px:

| Medição | Antes | Depois |
| --- | ---: | ---: |
| Primeiro card | 494 px | 351 px |
| Banner | 563 px | 400 px |
| Espaço entre “Ver todos” e rodapé | 112 px | 32 px |

Sem rolagem horizontal em 390 e 1366 px. Desktop: os quatro botões de cada linha compartilham a mesma posição vertical. Oito fotos dos cards carregadas corretamente em 480 px. WhatsApp flutuante com `display: none` nas duas larguras.

## Testes

- 419 testes aprovados, zero falhas; TypeScript, ESLint dos componentes alterados e build de produção aprovados.
- Quinze cenários HTTP repetidos em produção: código, nome, medida com vírgula/ponto, ordem invertida, filtros combinados, nenhuma correspondência, perfis, paginação, página inexistente e detalhe.
- Sugestões corretas e 48 produtos por página sem sobreposição nas páginas 1 e 2 de Rolamentos.
- Oito mensagens dos cards verificadas com nome, código e URL oficial da peça.
- Navegador: busca por código, abertura da ficha e retorno; botão do WhatsApp abriu o perfil correto com SKU 5465 e link oficial, sem envio de mensagem.
- Produção: busca `35x52x8,5`, seleção de categoria Retentores e marca Sav, botão Filtrar: um resultado, SKU 2328, R$ 7,00. Evidência em `filtros-publicados.json` e `busca-com-filtros.png`.
- A verificação de Limpar encontrou selects persistindo após a navegação do Next. Corrigido no PR 31 com navegação completa. No navegador em produção, dois fluxos aprovados: limpar filtros aplicados e limpar seleções ainda não enviadas na mesma URL. Ambos restauraram busca vazia, todas as marcas/categorias, ordem por relevância e 48 cards. Evidência em `limpar-filtros-publicado.json` e `limpar-filtros-publicado.png`; nenhum erro de console.
- Smoke oficial repetido após o último deploy e aprovado em https://vedashow.com.br e https://brilhax.com: saúde, CSS e imagem real servidos. Banco em 2,48 ms e 2,86 ms, respectivamente. Logs `smoke-final-vedashow.log` e `smoke-final-brilhax.log`.
- Prévia Linux: Brilhax com 12 cards e identidade preservada; Demo com dois cards e FX Eletrodos com dez.

## Publicação e recuperação

PR 30: https://github.com/avilaops/lojas.avilaops.com/pull/30, integrado à main `fe9961876601e074ee4f17290ca25c65f74ab6f3`.

Acabamento publicado inicialmente no commit `f7c28ee7295041f3112db73838749b6e54eb35b0`, build `JNsm9Q0-f9dGDre7xfpZw`.

PR 31: https://github.com/avilaops/lojas.avilaops.com/pull/31, integrado à main `6195b6ff1aed1b5e205ac93e94fc3f96c3ccfa86`. Correção final publicada: commit `923034b104fccb985356e5594e88a42e59d29389`, build `1slv8FynMN7xjyyTgT0sR`, confirmados em https://vedashow.com.br/versao.json. SHA-256 do pacote comparado local/servidor: `ce2cbffc2cb51bc26ddbd2ba021252f9c5f321eb133986d49b5aa8db73308736`.

No PR 31, ESLint, TypeScript e build foram repetidos e aprovados; a suíte de 419 testes e os 15 cenários HTTP pertencem ao PR 30. A validação adicional foi focada no comportamento de limpar, única alteração do PR 31.

Backup de dados: `/opt/lojas/rollback/vedashow-acabamento-dados-antes.json`.
Pacote anterior ao acabamento: `/opt/lojas/rollback/standalone-antes-acabamento-20260927.tgz`.
Pacote imediatamente anterior à correção de Limpar: `/opt/lojas/rollback/standalone-antes-limpar-20260928.tgz`.
A versão anterior também é preservada pelo deploy em `/opt/lojas/app.anterior`.

GitHub Actions não iniciou por falha de pagamento/limite da conta, conforme anotação da execução. A branch principal não possui checks obrigatórios; a entrega foi validada localmente e via SSH.

As lacunas de medidas nos demais produtos do catálogo continuam sendo trabalho de cadastro. O atendimento comercial existente segue pelo WhatsApp.

