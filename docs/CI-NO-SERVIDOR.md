# CI no servidor

Conferir e publicar a plataforma **sem gastar minuto de GitHub Actions**.

Existe por causa de 19/09/2026: a conta parou de alocar runner às 05:12. Os
jobs morriam em um a cinco segundos, antes da primeira etapa, sem produzir log
nenhum — e não foi um PR, foi **tudo**: três PRs abertos, três branches e a
própria `main`. O GitHub estava operacional; a condição era da conta.

Um caminho de publicação que depende inteiramente de um recurso de terceiro
tem um dia por ano em que ele não está lá. Este é o caminho para esse dia.

## Não é um pipeline novo

É o mesmo, nos mesmos passos. O que o Actions faz em dois workflows
reutilizáveis, o script faz em sequência:

| Etapa | No Actions | No servidor |
|---|---|---|
| Portão (typecheck, testes, build) | dentro do `docker build` do `Dockerfile` | **o mesmo** `docker build` |
| Publicar a imagem | `container.yml` → `ghcr.io/avilaops/lojas.avilaops.com:sha-<sha>` | `docker push`, mesma tag |
| Implantar | `deploy-ssh.yml` → `ssh host 'deploy <app> <imagem@digest>'` | `deploy <app> <imagem@digest>`, local |

O portão mora no `Dockerfile`, não no script nem no workflow — é por isso que
os dois não podem divergir sem alguém editar o `Dockerfile`. Quem troca a
versão, confere saúde e desfaz continua sendo o `deploy` do host: o script não
reimplementa nada disso.

A imagem vai por **digest**, não por tag, porque tag se move e digest não — é o
mesmo formato que o `deploy-ssh.yml` exige.

## Usando

No servidor, dentro do checkout do repositório:

```bash
bash deploy/ci-servidor.sh                     # portão + publica + implanta
bash deploy/ci-servidor.sh --somente-portao    # só confere; não publica nada
bash deploy/ci-servidor.sh --ref claude/minha-branch
```

`--somente-portao` é o substituto do check de PR enquanto o Actions não volta:
roda typecheck, testes e build da branch e não toca em produção.

### O que precisa estar no servidor

- `docker` e `git`
- `docker login ghcr.io` feito **uma vez**, com um token clássico que tenha
  `write:packages`. O `deploy` do host puxa do GHCR, então publicar continua
  sendo necessário mesmo construindo local.
- O comando `deploy` no `PATH` — o mesmo que o `deploy-ssh.yml` chama. Sem ele
  o script publica a imagem e imprime a linha exata para implantar à mão, em
  vez de inventar um caminho próprio.

## A máquina cabe? Confira antes de contar com isto

O README diz, desde 24/08/2026, que **o servidor não builda**: um CX23 de 4 GB
com o disco do Docker sempre perto de 95%. Foi decisão de projeto — o build sai
pronto de fora justamente para a máquina de produção não precisar de folga.

Este script contraria essa decisão de propósito, para o dia em que não houver
"fora". Mas contrariar não faz caber: `next build` sozinho passa de 2 GB, e as
camadas intermediárias de uma imagem Node com `node_modules` passam de 3 GB.

Por isso ele **confere antes de começar** e recusa com o número na tela, em vez
de descobrir no meio. Encher um disco que já está em 95% não dá erro limpo: dá
camada corrompida e container que não sobe — o pior momento possível para
descobrir qualquer coisa.

Pisos padrão: **8 GB** livres no diretório do Docker e **3000 MB** de memória
útil (disponível + swap; `next build` sobrevive em swap, só devagar).

Se a recusa aparecer, o caminho barato quase sempre é liberar espaço:

```bash
docker system df                  # de onde vem o que está ocupando
docker builder prune -af          # cache de build acumulado
docker image prune -f             # órfãs; sem -a, que apagaria a lojas-base
```

Havendo folga de verdade, os pisos são ajustáveis:

```bash
CI_PISO_DISCO_GB=6 CI_PISO_MEMORIA_MB=2500 bash deploy/ci-servidor.sh
```

Se nem assim couber, o problema não é o script: é que essa máquina não tem
tamanho para construir. As saídas reais são aumentar o CX23, adicionar swap, ou
construir em outro host e manter só a implantação aqui.

## Por que ele limpa o disco

Porque o servidor não é um runner descartável. O disco do Docker são 40 GB
compartilhados com todos os projetos do host; já chegou a 100% e corrompeu o
snapshot de um container em recriação (a história está em `deploy/deploy.sh`).

O `trap` é armado **antes** do build, não depois: build que falha no meio é
justamente quando sobra camada órfã.

E a limpeza usa `docker image prune` sem `-a`. Com `-a` ela apagaria imagem sem
container — que é exatamente o caso da `lojas-base`. Já sumiu assim uma vez, e
o deploy passou a falhar sem ninguém entender por quê.

## Se preferirem runner próprio

Limite de gasto do GitHub afeta minuto **hospedado**; runner auto-hospedado não
consome minuto e não é barrado por ele. Registrando um runner no servidor, dá
para voltar a ter check automático em PR sem mudar a lógica: o workflow chama
este mesmo script, que continua sendo o único lugar onde os passos moram.

Vale só depois de confirmar que a causa é limite de gasto. Se o Actions estiver
desligado por outro motivo, o runner não ajuda — e o script continua servindo,
porque ele não depende do GitHub para nada além do `git fetch`.

## Aviso: a trilha antiga de deploy está desatualizada

`scripts/empacotar.sh`, `deploy/deploy.sh`, `deploy/docker-compose.producao.yml`
e a receita manual do README esperam o standalone **aninhado** em
`.next/standalone/lojas.avilaops.com/`. Com o `outputFileTracingRoot:
process.cwd()` do `next.config.ts` atual, o standalone sai **plano**
(`.next/standalone/server.js`) — que é o que `deploy/runtime.github.yml` usa
(`command: ["node", "server.js"]`), contra o `node lojas.avilaops.com/server.js`
do compose antigo.

Ou seja: aquela trilha não roda como está escrita. Não foi mexida aqui porque
consertá-la é outra decisão — ou atualizar, ou remover. Este documento existe
para ninguém pegar o caminho errado achando que é o atual.
