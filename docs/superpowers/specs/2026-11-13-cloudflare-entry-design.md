# Entrada Cloudflare para Lojas recuperado

O proprietário escolheu a entrada pelo Cloudflare em 13/11/2026, após a API
Render recusar novos domínios sem forma de pagamento. O backend Next.js e o
PostgreSQL recuperados permanecem no Render; uploads, releases e backups no R2.

## Contrato

- Worker encaminha HTTPS à origem fixa `lojas-avilaops-emergency.onrender.com`.
- Host público vem da URL recebida; sobrescrever cabeçalhos de encaminhamento
  do cliente. Aceitar somente domínio-base, um nível de slug e domínios próprios
  explicitamente configurados. Não oferecer proxy aberto nem seguir redirects.
- Preservar método, query, corpo, cookies e streaming. Reescrever Location que
  volte à origem técnica para o host público, sem alterar destinos OAuth externos.
- Nunca colocar resposta autenticada ou de API em cache compartilhado. Não
  registrar cookies, corpos, tokens OAuth ou credenciais.
- O proxy Next deve encaminhar o host lógico também aos handlers de autenticação,
  preservando as verificações de origem e as regras de acesso existentes.
- Cloudflare Custom Domains registra o domínio-base e domínios próprios exatos.
  A API do canário emitiu certificado Advanced com SAN do hostname e seu wildcard.
  Conferir esse SAN e certificado ativo no domínio-base antes de associar DNS
  wildcard proxied e rota Workers `*.lojas.avilaops.com/*`. Validar um slug novo
  sem Custom Domain individual antes de afirmar que novos slugs estão cobertos.
  Se o certificado-base não cobrir wildcard, manter provisionamento por hostname.
- Salvar DNS anterior, validar Worker e runtime aprovado antes de associar domínios.
  Não alterar MX/TXT ou ativar lojas canceladas/provisionando.
- PK usa DNS externo; não é possível mudar seus registros por esta conexão.

## Backup

Três execuções reais excederam um minuto na exportação sequencial. Telemetria
read-only identificou COPY de HistoricoCatalogo (relação de 244 MB), com 145 MB
processados após 22 segundos, além das outras tabelas. Medir pg_dump directory
com quatro workers e compressão leve, mantendo o snapshot sincronizado nativo.
Só publicar manifesto após exportação, validação por pg_restore e partes completas.
Documentar o formato e a restauração. Não excluir histórico, alterar dados ou
afrouxar o gate de backup/migração para publicar a aplicação.

## Verificação e limites

Builds/testes exclusivamente no GitHub CI. O proprietário autorizou até cinco
minutos somente para backup e confirmação do deploy, após medições reais
excederem um minuto. Demais limites existentes preservados.
Regressões: headers forjados, POST/cookies/redirect externo, SSO no host lógico,
falha de upstream, backup íntegro e entrega real no Render. Revisar antes de merge.
Depois conferir DNS/TLS, plataforma, sete vitrines ativas, login e upload sintético.
Mídias antigas continuam ausentes; PostgreSQL Free expira em 13/12/2026.
