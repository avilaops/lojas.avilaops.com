# Correções da auditoria da PK Vedações

## Implementação

- A busca por medidas valida todos os campos preenchidos. Um valor inválido bloqueia a navegação e identifica o campo, mesmo quando outra medida é válida.
- Vírgula e ponto decimal mantêm a mesma faixa de busca. Campos vazios continuam permitidos.
- Home e catálogo esclarecem que proximidade dimensional não comprova compatibilidade. A tabela apresenta perfil, material e aplicação quando cadastrados.
- O pedido mínimo cadastrado aparece antes do carrinho em todas as lojas que possuem essa regra.
- Políticas padrão de envio, termos e privacidade acompanham a disponibilidade real do checkout. Textos próprios do lojista são preservados.
- O checklist distingue vitrine publicada, configuração de venda e homologação do recebimento.
- Sugestões do carrinho deixam de sugerir que os itens são complementares ou compatíveis.
- A home industrial possui somente o marco principal do layout e uma descrição de busca baseada nas categorias cadastradas.

As correções compartilhadas são aplicadas pela plataforma; não alteram preços, estoque, credenciais ou especificações cadastradas.

## Dados e decisões necessários da PK

| Item da auditoria | Dependência para concluir |
| --- | --- |
| Compra autônoma e feed Merchant | Conta de recebimento autorizada, modalidade comercial e entrega configuradas; homologação pelo responsável sem cobrança feita pelo auditor. |
| Fotos B, BS, STD e demais perfis | Fotos reais identificadas por SKU/perfil, incluindo vista lateral e detalhes dos lábios. A fotografia de família não comprova geometria individual. |
| Disponibilidade física | Posição de estoque e reservas confirmadas pela operação. |
| Itens sob consulta | Preços aprovados e referências corretas; não copiar preços de outras medidas. |
| Unidade de venda e especificações ausentes | Fonte técnica do fabricante ou responsável da PK. |
| Rótulo “Seção do cordão” | Confirmação do significado do atributo por família antes de mudar nomenclatura. |
| Atendimento | Horários e prazo de resposta aprovados. |

Não é possível resolver essas dependências inventando dados ou ativando uma credencial financeira alheia.
