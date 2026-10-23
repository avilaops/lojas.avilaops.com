# Inventário de Integrações do Lojas 360

<!-- markdownlint-disable MD013 -->

Versão 1.0.0, observada em 18 de outubro de 2026. O contrato completo e validável está em [`integracoes/lojas-360.v1.json`](integracoes/lojas-360.v1.json).

## Como interpretar

- **Operacional:** possui operações de domínio implementadas; não significa que toda loja tenha credencial ou ativação.
- **Parcial:** atende parte do ciclo e mantém lacunas explícitas.
- **Somente conexão:** OAuth/conexão existe, mas catálogo, pedido, preço ou estoque ainda não operam.
- **Inativa:** artefato existe, mas não está habilitado.
- **Bloqueada:** depende de decisão, credencial, aprovação ou provedor externo.

## Resumo executivo

| Integração | Estado | Capacidade atual | Principal lacuna |
| --- | --- | --- | --- |
| Mercado Livre | Operacional | Anúncios, pedidos, catálogo, preço, estoque e notificações | Cotas por endpoint não consolidadas |
| Amazon | Somente conexão | OAuth e identificação | Operações SP-API e homologação |
| Shopee | Somente conexão | OAuth e identificação | Operações comerciais e homologação |
| Magalu | Somente conexão | OAuth e escopos declarados | Adaptadores dos domínios comerciais |
| Mercado Pago | Operacional | Pagamento, Pix e conciliação | Cotas e retenção contratual |
| Melhor Envio | Parcial | Cotação | Etiqueta e rastreio |
| CepCerto/ViaCEP | Parcial | Endereço e apoio ao frete | SLA e fallback contratados |
| ERP NF-e recebida | Parcial/em revisão | Nota, XML, DANFE e conferência | Homologação ponta a ponta |
| SEFAZ DF-e | Operacional/compatibilidade | Distribuição de NF-e por NSU | Sem manifestação, NFC-e ou NFS-e |
| Google | Parcial | Login, Merchant e Search | Matriz de quotas por API |
| Cloudflare | Operacional | DNS de lojas | Migrar para menor privilégio |
| Ávila Mail | Operacional | E-mail transacional | Retornos e limites não formalizados |
| Auth Ávila Ops | Operacional | Identidade, sessão e acesso | Contrato corporativo v2 em revisão |
| n8n Lojas Operação | Parcial/ativo | Eventos, mensagens, cobranças, relatórios e schedules | WhatsApp rompido, terminalidade e possível duplicação de schedules |
| n8n MCP Ávila Ops | Parcial/ativo | Ferramentas MCP | Adaptadores de CRM, Auth, TMS e ERP |

## n8n observado

A consulta somente leitura encontrou `Lojas - Operação Completa` (`p063yYJXt0dT6lK6`) e `MCP - Avila Ops` (`IwWSp6RA3SJ5eyhZ`) ativos. Também existem workflows de frete e auditoria inativos e um workflow `Ávila OS` ativo. O inventário não executou, editou ou publicou nenhum deles.

O Lojas passou a executar internamente rotinas críticas descritas em [`ROTINAS.md`](ROTINAS.md). Portanto, qualquer schedule equivalente no n8n deve ser reconciliado antes de mudança para evitar processamento duplicado. O workflow operacional também declara rotas sem encerramento registrado e uma dependência de WhatsApp inválida após remoção do aplicativo Meta.

## Regras de manutenção

1. Atualizar `observedAt` e elevar a versão ao mudar capacidade, estado ou contrato.
2. Citar evidência verificável e nunca copiar valores de credenciais.
3. Não promover `connection-only` para `partial` ou `operational` sem teste de uma operação de domínio.
4. Toda lacuna deve permanecer ligada a uma decisão ou dependência.
5. Revalidar documentação, quotas e ambientes dos provedores antes de implantação.

## Central de Conexões

A rota `/painel/conexoes` consolida, por loja, a conexão, os escopos, a última atividade, a validade da autorização, as rotinas e a situação dos webhooks. A leitura usa apenas o estado canônico já persistido e não consulta provedores externos ao abrir a página.

O botão **Testar** é uma ação explícita, restrita a quem possui a permissão de configurações. Cada teste cria uma reserva imutável por loja, canal e minuto, usa o cliente oficial da integração para preservar tokens rotativos e registra apenas código e mensagem sanitizados. Tokens, URLs, corpos e erros brutos não entram no histórico. Amazon, Shopee e Magalu continuam identificados como **somente conexão** até possuírem operações comerciais homologadas.

## Evidência e limites

O levantamento combina código e documentação do repositório com consultas somente leitura aos conectores Ávila Ops e n8n em 18/10/2026. Nomes de credenciais foram usados apenas para confirmar existência; nenhum segredo foi lido ou registrado. Não houve execução de workflow, alteração remota, build em servidor, deploy ou publicação. Como este item é documental e não modifica UI, prints não se aplicam.
