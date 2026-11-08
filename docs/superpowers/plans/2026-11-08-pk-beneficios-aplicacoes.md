# PK: identificação técnica, cotação e aplicações

Objetivo: melhorar a identificação das vedações, a montagem de pedidos e a descoberta dos benefícios e segmentos atendidos, mantendo as referências de terceiros apenas como informação discreta na ficha.

Stack: Next.js, React, Prisma e MDX existentes. Escopo restrito ao tenant pkvedacoes, preservando as demais lojas. Testes e builds somente no GitHub CI. Desenvolvimento em checkout isolado para preservar os arquivos locais existentes.

- [ ] Ficha: desenho dimensional SVG a partir dos atributos validados, benefícios por família e referência cruzada compacta.
- [ ] Fotos: selecionar fotos próprias identificáveis por família, sem atribuir SKU ou medida não comprovada.
- [ ] Cotação em lote: colar lista ou importar CSV, resolver códigos com ambiguidade explícita, informar preço/disponibilidade atuais e enviar a lista pelo atendimento existente.
- [ ] Comparador: selecionar até três produtos do catálogo, comparar medidas, material, perfil e aplicação; preservar contexto da loja e permitir remover itens.
- [ ] Conteúdo MDX: guias de escolha e medição e páginas de aplicações por segmento, com benefícios específicos e limites de seleção, sem centralizar a comunicação na Agel.
- [ ] Descoberta: integrar as ferramentas e conteúdos à home, catálogo, ficha e navegação; publicar URLs canônicas e sitemap quando aplicável.
- [ ] Demanda: relatório autenticado das buscas sem resultado por loja, com frequência e ações úteis para revisão do catálogo.
- [ ] Verificação: testes de domínio e integrações, tipos, lint, build e navegação em CI; revisão e comprovação pública após a publicação.

Critérios: não inventar compatibilidade, homologação, disponibilidade, desconto, foto de SKU ou desempenho. Não criar pedido ou enviar mensagens automaticamente. Seleção considera perfil, fluido, pressão, temperatura e condições de trabalho; segmento é contexto de aplicação, não prova de compatibilidade.
