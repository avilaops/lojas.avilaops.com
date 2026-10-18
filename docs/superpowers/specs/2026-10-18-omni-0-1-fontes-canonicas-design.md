# OMNI-0.1 — Fontes Canônicas e Propriedade dos Dados

<!-- markdownlint-disable MD013 -->

## Intenção

Estabelecer, antes das próximas integrações omnicanal, quem pode criar e alterar cada grupo de dados e qual estado prevalece quando Lojas, ERP, canais, transportadoras, pagamentos ou fiscal divergem.

## Objetivo

Manter uma matriz versionada que cubra catálogo, preço, estoque, pedido, cliente, fiscal, financeiro, atendimento e logística. Cada linha deve declarar fonte canônica, escritores autorizados, réplicas, regra de precedência, detecção do conflito e resposta operacional.

## Não objetivos

- Implementar o motor de sincronização, a Central de Conexões ou a Central de Conciliação.
- Alterar banco, APIs ou telas neste recorte.
- Declarar uma integração completa apenas porque existe conexão OAuth.
- Substituir contratos detalhados já documentados por domínio.

## Decisões

- O Lojas é a fonte canônica do domínio operacional que ele próprio mantém; provedores continuam canônicos para fatos que somente eles podem afirmar, como autorização de pagamento, rastreio transportador, validade fiscal e políticas/estado de anúncios externos.
- Dados derivados nunca vencem seus fatos de origem. Eles devem ser recalculados ou marcados como desatualizados.
- Eventos externos entram como fatos identificados pela chave do provedor e são aplicados idempotentemente; não sobrescrevem silenciosamente decisões humanas locais.
- Conflito irreversível, destrutivo, financeiro, fiscal ou de identidade exige revisão humana. A automação pode sugerir, mas não escolher silenciosamente.
- Toda exceção deve preservar último estado conhecido, origem, instante da observação e ação necessária.

## Critérios de aceite

- Os nove domínios exigidos pelo roadmap aparecem explicitamente.
- Catálogo e preço distinguem dado mestre, regra comercial, projeção por canal e estado observado.
- Estoque distingue razão, saldo derivado, reserva e quantidade publicada.
- Pedido distingue identidade local, identidade externa, linha do tempo e estado de pagamento/entrega.
- Fiscal e financeiro preservam fatos externos imutáveis e não confundem conciliação com edição.
- Atendimento e logística deixam explícitas as limitações impostas pelo canal/provedor.
- Cada domínio contém conflitos e exceções acionáveis.

## Evidência

O artefato final é `docs/OMNI-FONTES-CANONICAS.md`. A validação local confere a presença dos nove domínios, das colunas obrigatórias e das políticas globais. Como este recorte não altera apresentação, prints não se aplicam.
