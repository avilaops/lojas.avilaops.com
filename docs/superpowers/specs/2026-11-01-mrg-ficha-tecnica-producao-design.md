# MRG — prévia e ficha técnica de produção — design

**Ticket:** AVL-403

## Intenção

Dar à equipe da MRG uma ficha operacional estável para analisar cada solicitação do configurador, acompanhada de uma prévia visual coerente com o mesmo snapshot técnico. A saída auxilia orçamento e preparação; não é desenho CAD nem liberação automática para fabricação.

## Objetivos

- Congelar uma ficha técnica versionada no momento da criação da solicitação.
- Gerar uma prévia SVG determinística somente a partir da ficha validada.
- Exibir ficha e prévia em uma página autenticada e isolada pelo tenant.
- Oferecer uma impressão limpa para conferência humana.
- Manter solicitações antigas legíveis sem reescrever seu histórico.

## Não objetivos

- Gerar DXF, STEP, G-code ou qualquer arquivo para máquina.
- Calcular preço, capacidade útil, peso, desempenho térmico ou viabilidade fabril.
- Aceitar imagem, SVG ou HTML enviados pelo navegador.
- Tornar a ficha ou a prévia públicas por referência.

## Abordagens consideradas

### Escolhida: snapshot imutável e SVG no servidor

Cada solicitação nova guarda um JSON de ficha técnica, a versão desse contrato e a versão do desenho. O SVG é regenerado no servidor a partir do snapshot e servido por rota autenticada. Essa abordagem é leve, auditável, nítida na impressão e não depende do navegador que enviou o pedido.

### Recusada: derivar tudo do JSON original sob demanda

É menor, mas futuras mudanças no mapeamento poderiam alterar silenciosamente a apresentação de pedidos antigos. O snapshot explícito deixa claro qual contrato operacional foi usado.

### Recusada: captura da cena CSS no navegador

Produziria algo parecido com a tela, porém varia entre navegadores e exigiria confiar e validar um arquivo enviado pelo cliente. A evidência operacional não deve depender disso.

## Contrato da ficha

A ficha versão 1 contém apenas dados técnicos já aceitos pelo configurador:

- dimensões externas em centímetros;
- material externo e acabamento, com código e rótulo conhecidos;
- tipo de abertura e base, com código e rótulo conhecidos;
- quantidade de divisórias e de unidades;
- observações técnicas normalizadas;
- referência da solicitação e, quando houver, referência de origem;
- versão do configurador e data de criação.

Nome, e-mail, telefone e chave de retomada não fazem parte da ficha nem do SVG. O painel continua exibindo contato separadamente, dentro da sessão autenticada.

## Persistência e compatibilidade

`SolicitacaoSobMedida` recebe `fichaTecnica`, `fichaTecnicaVersao` e `previaVersao`, todos opcionais para compatibilidade com registros antigos. Uma restrição de banco exige que os três estejam juntos e tenham versões positivas. Solicitações novas sempre gravam os três campos na mesma inserção da configuração e do contato.

Registros antigos permanecem imutáveis. Ao abri-los, o servidor valida o JSON histórico e monta uma ficha compatível em memória usando a versão do configurador registrada; não grava backfill silencioso.

## Prévia SVG

O gerador recebe somente uma ficha validada e produz SVG com caixa em projeção isométrica simples, cotas externas, referência, material, acabamento, abertura, base, divisórias e quantidade. A escala visual é limitada para manter legibilidade; as medidas escritas são os valores canônicos.

O SVG não contém scripts, links externos, HTML embutido, contato nem observações livres. A resposta usa `image/svg+xml`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff` e CSP que bloqueia scripts.

## Painel e autorização

A lista de projetos passa a ligar cada item a `/plataforma/painel/sob-medida/[id]`. A página resolve a sessão, exige o recurso `configurador_sob_medida` e consulta por `{ id, tenantId }`. Ausência, tenant diferente, recurso desligado ou ficha inválida resultam em `notFound` sem revelar existência.

O detalhe apresenta prévia, referência, versões, origem, ficha completa, observações e contato. O layout de impressão remove navegação e ações, preserva cotas e identificação e deixa explícito: “Sujeito à validação da fábrica; não é desenho liberado para fabricação”.

## Segurança e privacidade

- Toda consulta privada inclui `tenantId` da sessão.
- A rota da imagem aceita somente ID interno e nunca chave ou PII na URL.
- O navegador público não envia artefato renderizado.
- O SVG deriva de enums e números validados; texto exibido é escapado.
- Chaves de retomada e hashes não entram no snapshot, no painel ou no SVG.

## Critérios de conclusão

- Novas solicitações persistem ficha e versões de forma atômica.
- O mesmo snapshot sempre gera o mesmo SVG.
- Alterar dimensões ou opções altera a geometria ou os rótulos correspondentes.
- PII e observações livres não aparecem no SVG.
- Painel e rota SVG não atravessam tenants.
- Solicitações antigas válidas continuam abrindo por fallback sem mutação.
- Página de detalhe funciona em desktop, celular e impressão.
- Testes, integração PostgreSQL, TypeScript, lint e build passam antes da publicação.
