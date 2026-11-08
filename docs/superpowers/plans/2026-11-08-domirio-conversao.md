# Conversão comercial da Domi-Rio

**Objetivo:** facilitar descoberta, compra e cotação na loja Domi-Rio.
**Autorização:** proprietário aprovou a proposta de revisar home, fichas dos
produtos prioritários e fluxo de cotação; push direto na main já autorizado.
**Execução:** skill executing-plans, implementação pelo próprio Codex.

## Desenho

Home exclusiva para o tenant domi-rio, clara, com busca visível, navegação
por categorias ativas e 12 produtos distribuídos entre categorias e famílias.
A seleção usa disponibilidade, fotos e destaque cadastrado, sem alegar ranking
de vendas ou margem. Conteúdo comercial em MDX. Fichas mostram apresentação,
marca e fonte oficial cadastrada e oferecem formulário curto de cotação com
quantidade e apresentação, gerando mensagem para o WhatsApp configurado.
Artigos MDX passam a oferecer caminhos de pesquisa de categorias pertinentes,
sem tratar produtos saneantes como indicados para lavouras.

## Contratos e restrições

- Não alterar preços, estoque, descrições técnicas ou permissões de venda.
- Não criar descontos, prazos comerciais, depoimentos ou alegações de eficácia.
- Isolamento por tenant; outras lojas mantêm composição atual.
- Número inválido leva a contato; nenhuma mensagem é enviada automaticamente.
- Identificar apresentação e código corretos, inclusive nas variantes.
- Rastrear pesquisa e contato pelos eventos first-party existentes.
- Testes, lint, tipos e build somente na CI, conforme AGENTS.md.

## Tarefas

- [x] Regras e testes de seleção diversificada, fonte oficial e mensagem de cotação.
- [x] Home Domi-Rio com conteúdo MDX, busca, produtos e atendimento empresarial.
- [x] Fichas com resumo comercial, documentação cadastrada e cotação medida.
- [x] Conectar guias às categorias pertinentes e ao atendimento.
- [x] Revisar alterações, executar CI, publicar e conferir desktop/mobile.

## Evidência inicial

Leitura do catálogo de produção em 08/11/2026, sem escrita: 41 produtos ativos,
todos com fotos; seis categorias. Vitrine pública com repetição da família
Hora 2. Dados operacionais da análise ficam em .work, sem credenciais.

## Evidência final

Commit de implementação edde997; CI 42496618338 aprovada, incluindo deploy e
fumaça. Entrega repetida após o limite de um minuto no download da imagem.
Produção: 41/41 fichas HTTP 200 com resumo e cotação, 37 links oficiais
cadastrados, seis categorias e atendimento nos artigos. Revisão pública em
390/1440 px da home e fichas simples/com variante: sem overflow, fotos
quebradas ou erros de página. Navegação WhatsApp interceptada, sem envio:
12 unidades de Cypertryne 1 L, ISO015 e URL da variante correta.

A revisão pública identificou transformação de e-mail pela Cloudflare
causando hidratação divergente. `email_obfuscation` alterado de on para off
somente na zona domiriodistribuidora.com.br às 16:05 UTC de 08/11/2026.
HTML público deixou de conter data-cfemail e email-decode; revisão repetida
sem erros React. Fontes e limites documentados em docs/DOMIRIO-CONVERSAO.md.
