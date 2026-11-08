# PK: benefícios, seleção e aplicações

Responsável: codex. PR: #232. Escopo exclusivo do tenant pkvedacoes.

## Entrega

- Seis guias e dez segmentos em MDX, com benefícios por função e condições de seleção.
- Esquema dimensional com cotas do cadastro, sem representar CAD ou perfil exato.
- Comparação de até três produtos ativos, incluindo itens sob consulta.
- Cotação por CSV/lista, até 100 itens, sem criar pedido nem prometer disponibilidade.
- Códigos relacionados visíveis de forma compacta; atribuição documental recolhida.
- Demandas sem resultado agregadas diariamente, somente gramática técnica aceita e consentimento analítico; retenção de 90 dias, sem busca bruta, IP ou sessão persistidos.

## Fontes e limites

Conteúdo técnico: cinco famílias do catálogo PK (B, BS, STD, raspador D, anel guia), atributos existentes e conteúdo técnico previamente extraído de pkvedacoes.com.br/produtos. Os segmentos descrevem pontos de seleção, não certificações ou compatibilidade irrestrita. Não foram inventados limites de pressão, temperatura ou aprovação sanitária.

Fotos próprias copiadas integralmente de `pkvedacoes/Fotos`:

| Original | Destino público | Critério |
| --- | --- | --- |
| WhatsApp Image 2026-11-06 at 3.47.54 PM.jpeg | /media/pkvedacoes/perfis-azuis.jpg | Perfis visíveis, sem associação a SKU |
| WhatsApp Image 2026-11-06 at 3.47.56 PM (2).jpeg | /media/pkvedacoes/perfis-coloridos.jpg | Formatos variados, sem inferir material pela cor |

As fotos não substituem imagens exatas de produto e não alteram cadastro, preço, estoque ou fabricante.

## Verificação

Somente GitHub CI, conforme AGENTS.md. Primeira etapa vermelha: run 42491462606 confirmou ausência dos módulos antes da implementação. Testes de domínio são descobertos pelo glob src/lib/*.test.ts; integração PostgreSQL pelo glob tests/integration/*.test.ts. CI também verifica TypeScript, ESLint, build e navegador. Publicação depende de CI e implantação aprovadas.
