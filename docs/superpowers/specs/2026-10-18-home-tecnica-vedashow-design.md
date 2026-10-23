# Homepage técnica da VedaShow

## Intenção

A VedaShow é um tenant do Lojas. A homepage deve ajudar oficinas, manutenção e compradores técnicos a identificar a peça certa antes de apresentar argumentos comerciais. A solução pertence ao layout genérico `industrial`; não haverá código condicionado ao nome ou slug do cliente.

## Experiência

O topo será um posto de identificação com dois caminhos equivalentes: busca livre por código, referência, aplicação ou medida e busca dimensional por diâmetro interno, diâmetro externo e altura. As buscas levam ao catálogo com URL compartilhável e registram eventos do funil já existente.

Depois do topo aparecem, somente quando houver dados reais:

- famílias do catálogo em ordem de relevância já calculada pela plataforma;
- marcas confirmadas em produtos ativos;
- condições logísticas derivadas do cadastro do tenant;
- produtos em destaque ou catálogo;
- diferenciais configurados no tema;
- apresentação da empresa e canais públicos validados.

Nenhum número, selo, marca, segmento ou promessa será inventado. Categorias e marcas vazias não geram blocos vazios.

## Direção visual

- **Cores:** `--foreground`, `--background`, `--primary`, `--brand-support` e `--muted` do tema do tenant; branco apenas como superfície de formulário sobre o topo escuro.
- **Tipografia:** fonte configurada pelo tenant, com escala compacta e leitura técnica; códigos, medidas e unidades usam algarismos tabulares.
- **Layout:** conteúdo alinhado à esquerda; o topo combina texto e uma bancada de busca com estrutura de régua, sem banner publicitário genérico.
- **Princípio:** a informação técnica é a decoração. Linhas, unidades e agrupamentos explicam o uso; não há métricas, gradientes ornamentais ou cartões repetitivos sem função.

```text
┌──────────────────────────────────────────────────────────┐
│ Marca        Título técnico                              │
│ Texto real   [ código / referência / aplicação ] [buscar]│
│              [ DI ] [ DE ] [ altura ] [buscar medida]    │
└──────────────────────────────────────────────────────────┘
  Famílias prioritárias        Marcas disponíveis
  Logística comprovada
  Produtos do catálogo
  Diferenciais cadastrados
  Empresa                      Atendimento validado
```

## Regras

- A busca livre registra `search`; a dimensional registra `filter_apply` apenas quando contém ao menos uma medida válida.
- O WhatsApp usa `technical_contact` e só aparece quando a identidade pública validada fornecer URL.
- Telefone e e-mail só aparecem após validação da projeção pública.
- O formulário e todos os links precisam de rótulo, foco visível e operação por teclado.
- Em telas estreitas, os controles empilham sem rolagem horizontal e a busca continua antes do conteúdo institucional.
- O comportamento existente dos demais layouts não muda.

## Não objetivos

- Alterar catálogo, preços ou dados do tenant.
- Criar conteúdo editorial ou promessas específicas da VedaShow.
- Publicar em produção.
- Adicionar dependências ou um novo sistema de eventos.

## Decisões do executor

O pedido contínuo autorizou início direto. A implementação preserva Next.js, React, Prisma, os tokens do tema e o contrato first-party já existentes. A recomendação antiga de não redesenhar a home foi superada pela issue explícita AVL-265 no roadmap atual.
