# Plugin no Claude Directory

Guia de envio e manutenção do plugin `lojas-avilaops` no diretório do Claude
(claude.ai > Personalização > Plugins > Enviar ao directory > Pacote de
plugins).

## O que é enviado

O pacote mora em `plugin/` e não leva código do app. O diretório lê só essa
pasta.

| Arquivo | Para que serve |
|---|---|
| `plugin/.claude-plugin/plugin.json` | Manifesto: nome, versão, descrição, autor, licença, ícone e links da listagem. |
| `plugin/.mcp.json` | Declara o conector remoto `https://lojas.avilaops.com/api/mcp` (`type: http`). |
| `plugin/skills/operar-loja/SKILL.md` | Habilidade que orienta o Claude a confirmar antes de alterar e a tratar dados de clientes com cuidado. |
| `plugin/README.md` | Vira a descrição da listagem. Precisa de pelo menos 40 palavras. |
| `plugin/LICENSE` | Licença MIT do pacote. Sem licença o envio é bloqueado. |
| `plugin/icon.png` | Ícone 512x512 da listagem, gerado de `public/lojas-mark.svg`. |

O conector em si (`src/app/api/mcp/route.ts`, OAuth em `src/app/oauth/` e
`src/app/.well-known/`) está descrito em `docs/MCP.md`.

## Antes de enviar

1. O pacote precisa estar na branch padrão (`main`). O diretório só lê a branch
   acompanhada.
2. Valide localmente:

   ```bash
   claude plugin validate --strict plugin
   ```

3. Confira que o conector responde:

   ```bash
   curl -s https://lojas.avilaops.com/.well-known/oauth-protected-resource/api/mcp
   ```

   Deve devolver `resource`, `authorization_servers` e `scopes_supported`.

## Passo a passo do formulário

### 1. Origem

- **Repositório:** `avilaops/lojas.avilaops.com`
- Abra **Plugin in a subfolder or on another branch?** e preencha o caminho
  `plugin`. Deixe a branch em branco (usa `main`).
- Clique em **Validar**. Resultado esperado: nenhum item "Blocks".
  - "Policy hold" não é reprovação: um revisor da Anthropic olha antes de
    publicar.
  - "Warning" e "Note" não impedem o envio.

### 2. Detalhes da listagem

Não tem nada para digitar. A tela mostra o que veio do `plugin.json` e do
`README.md`:

| Campo na listagem | De onde vem |
|---|---|
| Nome | `displayName`: Lojas por Avila Ops |
| Descrição curta | `description` |
| Ícone | `icon`: `plugin/icon.png` |
| Descrição longa | `plugin/README.md` |
| Links | `homepage`, `documentationUrl`, `supportUrl`, `privacyPolicyUrl` |

Para mudar qualquer coisa: edite o arquivo, faça merge na `main` e use
**Re-validate**.

### 3. Tratamento de dados

| Pergunta | Resposta | Por quê |
|---|---|---|
| Lê ou guarda dados pessoais? | **Reads only** | `listar_clientes`, `obter_cliente` e as ferramentas de pedidos leem nome, e-mail e endereço. O histórico (`ChamadaMcp`) não guarda argumentos nem resultados (`src/lib/mcp-historico.ts`). |
| Alguma habilidade envia dados a serviço além dos conectores declarados? | **Não** | A habilidade `operar-loja` só orienta o uso do conector declarado. |
| Por quanto tempo o serviço retém dados recebidos do Claude? | **Longer** | O histórico some em 90 dias, mas o que o Claude cria ou altera (produtos, preços, cupons) vira dado da loja e fica enquanto ela existir. "Not retained" ou "Under 30 days" seria falso. |
| É destinado a menores de 18? | **Não** | Ferramenta para lojistas. |

### 4. Conformidade

- **E-mail de contato:** `nicolas@avilaops.com` (não é público; recebe o
  resultado da varredura e as perguntas da revisão).
- As quatro caixas são declarações em nome da organização:
  1. Aceite dos Software Directory Terms e da Directory Policy. Leia os dois
     links antes de marcar.
  2. A política de privacidade descreve com precisão os dados tratados. Ver
     [Pendência da política de privacidade](#pendência-da-política-de-privacidade).
  3. O plugin não exfiltra credenciais nem executa código fora dos servidores
     MCP declarados. Verdadeiro: o pacote não tem hooks, scripts nem binários;
     só o conector declarado e uma habilidade em texto.
  4. A Anthropic pode contatar o e-mail sobre o envio e mudanças de política.

### 5. Revisar e enviar

- **Auto-publish passing versions:** ligado. Versões novas que passarem na
  varredura entram sem clique. A primeira versão é publicada por você ou por
  um revisor; a página do plugin mostra o próximo passo.
- **Como versões novas chegam:** **GitHub push webhook** (recomendado).
  Depois do envio, o portal mostra uma URL e um segredo. No GitHub:
  1. Repositório > Settings > Webhooks > Add webhook.
  2. **Payload URL:** a URL do portal.
  3. **Content type:** `application/json`.
  4. **Secret:** o segredo do portal. Não coloque esse segredo em arquivo do
     repositório.
  5. **Which events:** Just the push event.
  6. Add webhook. Exige acesso de administrador ao repositório.
- Clique em **Enviar para revisão**. A varredura de segurança e de política
  roda primeiro; o que ficar retido vai para um revisor. Aprovação não é
  garantida.

## Depois de publicado

- **Nova versão:** altere o que precisar em `plugin/`, aumente `version` em
  `plugin.json` (ex.: `1.1.0` para `1.2.0`) e faça merge na `main`. Com o
  webhook, a versão é lida em minutos; sem ele, em até 6 horas.
- **Nome e descrição curta** seguem a versão publicada. Mudar exige versão nova.
- **Não renomeie `name`** (`lojas-avilaops`): quebra as instalações existentes.
- **Ferramenta nova no conector:** aparece sozinha para quem já instalou,
  porque o plugin só aponta para a URL. Atualize a tabela do `README.md` e a
  habilidade quando a ferramenta mudar o jeito de operar.

## Bloqueios comuns e como evitar

| Bloqueio | Como evitar |
|---|---|
| README com menos de 40 palavras | Manter a descrição completa em `plugin/README.md`. |
| Sem licença | Manter `plugin/LICENSE` e o campo `license`. |
| Credencial em arquivo ou em header do `.mcp.json` | Nunca. O login é OAuth; o plugin não carrega segredo. |
| Arquivo de sistema (`.DS_Store`, `Thumbs.db`), symlink, arquivo acima de 5 MiB | Não colocar em `plugin/`. |
| Binário que não seja PNG, JPEG, GIF, WebP, SVG ou fonte | Ícone só em PNG ou SVG. |
| Lockfile na raiz do plugin | Não criar `package.json` nem lockfile em `plugin/`. |

## Pendência da política de privacidade

`privacyPolicyUrl` aponta para <https://avilaops.com/politica-de-privacidade/>,
a política geral da Avila Ops. Em 09/10/2026 ela não citava o conector, o
Claude nem o histórico de 90 dias. A política do diretório pede que a
política de privacidade explique coleta, uso e retenção. Antes de marcar a
segunda caixa da etapa 4, inclua na política uma seção sobre o conector com o
conteúdo da seção "Privacidade e tratamento de dados" de `plugin/README.md`.
