# Backup, migração e rollback do Lojas

Como a plataforma sai de uma versão para outra, o que protege o banco no
caminho e como voltar. Tudo aqui foi conferido em produção em 08/10/2026; o
que ainda não vale está marcado.

## Quem faz o deploy

**Não é o `deploy/deploy.sh` deste repositório.** Ele é da época em que o
build subia como `standalone.tgz`; no servidor está parado desde 28/09/2026.

O deploy é do repositório `avilaops/infra`:

1. `Build e deploy` (`.github/workflows/deploy-production.yml`) constrói a
   imagem. Tipos, testes e build rodam dentro do `Dockerfile`.
2. O job `deploy` entra por SSH no servidor `applications` com uma chave presa
   a um comando: `avila-deploy lojas.avilaops.com <imagem>`.
3. `/usr/local/sbin/avila-deploy` (fonte: `scripts/deploy-container.sh` no
   `infra`) lê `/etc/avilaops/deploy/lojas.avilaops.com.conf` e faz o resto.

Só o run mais novo publica: o job confere se outro run do mesmo workflow
passou na frente antes de enviar a imagem. Sem isso, dois pushes seguidos
podiam terminar com a versão mais antiga em produção (aconteceu em 08/10/2026).

## O que o `avila-deploy` garante

| Passo | O que faz | Se falhar |
|---|---|---|
| Migração | `prisma migrate deploy` contra o banco, com o schema tirado da imagem nova, **antes** de trocar o container | o deploy para; o container atual segue no ar |
| Troca | sobe a imagem nova | segue para a saúde |
| Saúde | `GET /api/health` (banco incluído) | **rollback automático** para a imagem anterior |
| Fumaça | job `fumaca`: saúde, `/v1/health` e a folha de estilo seguida do HTML | o run fica vermelho; a versão nova continua no ar |

O rollback troca a imagem. **Ele não desfaz migração**: a tabela alterada
continua alterada. Por isso migração do Lojas só acrescenta (tabela, coluna
nula, índice), e o que remove coluna vai em deploy separado, depois de o
código que a usava ter saído.

## Backup do banco

- **Diário, 3h30 UTC**: `/usr/local/bin/backup-todos-bancos.sh` grava
  `/opt/backups/db/host-lojas-<data>.sql.gz`. Cada dump só assume o nome final
  depois de conferido (gzip íntegro, com conteúdo, com o marcador de fim do
  `pg_dump`). Rotação às 3h40: fica o mais recente de cada família, os outros 7
  dias.
- **Antes de migração pendente**: `pre-migracao-lojas.avilaops.com-<data>-<hora>.sql.gz`,
  no mesmo diretório e com a mesma conferência. Só existe quando há o que
  migrar, e se o dump falhar o deploy para antes de tocar no banco.
  **Ainda não vale em produção**: está em `avilaops/infra#8`, e o `avila-deploy`
  instalado no servidor está atrás do repositório. Instalar é decisão do
  Nicolas, porque o script é o mesmo para dez aplicações.

Enquanto o dump pré-migração não está instalado, quem sobe migração que mexe em
dado existente faz o dump à mão antes (regra do `AGENTS.md`). Migração que só
cria tabela ou coluna nula não precisa: o dump do dia cobre.

## Como conferir

```bash
ssh applications 'ls -la --time-style=long-iso /opt/backups/db | grep lojas | tail -5'
```

Tem de haver um `host-lojas-<hoje>` com alguns megabytes. Para saber qual foi a
última migração aplicada e quando:

```bash
ssh applications "sudo -u postgres psql -d lojas -At -c 'select migration_name, finished_at from _prisma_migrations order by started_at desc limit 3'"
```

## Como restaurar

O teste de restauração foi feito de verdade em 30/08/2026 (`docs/ROTINAS.md`,
"Backup e restauração"): o dump restaurado num banco descartável bateu com o
vivo. O caminho é o mesmo para um desastre:

1. Parar o container (`docker stop lojas-avilaops`), para ninguém escrever.
2. Restaurar o dump num banco novo, conferir contagens (`Tenant`, `Produto`,
   `Pedido`, `_prisma_migrations`) e só então trocar o nome dos bancos.
3. Publicar o commit cuja última migração é a do dump (ver abaixo).

Não restaure por cima do banco vivo: o estado ruim é a única evidência do que
aconteceu.

## Como voltar uma versão

Voltar versão é **publicar o commit de novo**, não copiar pasta no servidor:

```bash
gh workflow run deploy-production.yml --ref <commit ou branch>
```

Se a versão a que se quer voltar é anterior a uma migração, o código antigo
roda contra o schema novo. Com migração que só acrescenta, isso funciona: o
código antigo não conhece a coluna nova e não a usa. É mais um motivo para a
regra acima.
