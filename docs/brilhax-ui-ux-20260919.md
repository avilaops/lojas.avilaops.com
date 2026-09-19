# Brilhax — revisão de UI/UX em 19/09/2026

Inspeção do domínio público, código da plataforma e cadastro atual consultado em modo somente leitura. A pasta `Websites/brilhax.com` é legado; a loja atual usa Lojas Ávila Ops.

## Correções desta entrega

| Problema observado | Alteração |
| --- | --- |
| Fotos cortam tampa, embalagem e rótulo | Cards e galeria usam imagem inteira, com espaço ao redor |
| Zoom dependia de mouse | Ampliação por toque/clique, miniaturas, navegação por setas, Escape e foco contido no diálogo |
| Botões quebram em duas linhas nos cards | Ação compacta “Adicionar”, com nome completo do produto para leitores de tela |
| Home perde navegação ao rolar | Categorias permanecem no cabeçalho |
| Minha conta desaparece no celular | Ícone de conta disponível junto do carrinho |
| Filtro por marca limitado a outro template | Marcas reais disponíveis no catálogo; filtros podem ser limpos sem esvaziar a busca manualmente |
| Filtros apertados e controle inacessível por teclado | Campos quebram linha no desktop; abertura dos filtros recebe foco no celular; preços têm rótulos acessíveis |
| Descrição importada aparece como parede de texto | Preservação de parágrafos, separação de marcadores e divisão de textos longos sem reescrever instruções |
| Texto de pagamento anuncia opções fixas | Exibe somente meios habilitados na loja |
| WhatsApp flutuante cobre compra na ficha | Atendimento contextual com nome e link do produto, junto de “Entrega e retirada”; flutuante oculto nessa página |

As correções são componentes compartilhados, sem condições específicas para o slug Brilhax. Não alteram preços, estoque, instruções de aplicação nem credenciais.

## Catálogo atual

79 produtos ativos. Todos possuem imagem cadastrada, descrição, marca e preço positivo. Isso verifica preenchimento, não certifica a exatidão de cada foto ou instrução técnica.

Três produtos não possuem descrição curta:

- MASSA DE POLIR VINTEX 1.8K;
- ESCOVA CAIXA DE RODA CABO CURTO DETAILER;
- ESCOVA GRANDE MICROFIBRA ANGULAR PARA LIMPEZA DE RODA VONIXX.

Nenhum produto está marcado como destaque.

## Próximas melhorias recomendadas

1. **Organizar a seleção da home:** escolher itens de entrada, manutenção e uso profissional; a lista atual começa por ordem automática. Usar “Destaques” apenas para seleção real, sem inventar “mais vendidos”.
2. **Alinhar banner e destino:** a arte diz “Encontre seu kit”, mas abre `/produtos`. Direcionar para kits quando houver uma seleção adequada, ou mudar a chamada para catálogo. A mensagem hoje está incorporada na imagem.
3. **Melhorar a marca no cabeçalho:** a imagem atual parece uma fotografia pequena da marca. Substituir por um arquivo limpo e legível, preservando a identidade aprovada.
4. **Padronizar títulos e fichas:** volume/unidade, capitalização e grafia variam; “Blende Blck 500ml” é um exemplo que precisa de conferência com a embalagem. Completar os três resumos acima com dados da ficha/fabricante.
5. **Dar previsibilidade de entrega:** evoluir para simulação por CEP na ficha, reutilizando a mesma regra do checkout. O link de entrega desta rodada facilita acesso às condições, mas não é uma cotação.
6. **Evoluir fotografia:** todos têm imagem, mas há mistura de packshot e arte promocional. Priorizar produto isolado na primeira foto e aplicação/benefícios nas seguintes.

## Validação e publicação

- TypeScript estrito e ESLint dos arquivos alterados.
- Testes da formatação da descrição, incluindo preservação de diluição e remoção de marcação executável.
- Prévia com catálogo real e conexão PostgreSQL somente leitura; agendador desligado.
- Ficha e catálogo em 390 px sem transbordamento horizontal; galeria abre e fecha com retorno de foco.
- Filtro Vintex confirmado e inclusão de ALUMAX CONCENTRADO 5L no carrinho local: uma unidade, R$ 60,33. Nenhum pedido ou pagamento realizado.
- Build: compilação e TypeScript passaram, mas a geração da imagem Open Graph de `/plataforma/opengraph-image` falhou no Sharp/libvips do ambiente Windows (`colourspace: parameter space not set`). Build completo não aprovado; essa rota não foi alterada nesta entrega.

A produção contém personalizações de campanha em `Automotivo.tsx`/tema que não estão em `origin/main`. Esta entrega não substitui essas personalizações nem declara publicação: precisa ser integrada à versão que as preserva. Há também trabalho simultâneo na plataforma para a Vedashow; não sobrescrever o pacote compartilhado sem conciliar as versões.
