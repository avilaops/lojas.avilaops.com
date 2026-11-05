#!/usr/bin/env bash
set -euo pipefail

[[ "$DEPLOY_OPERATION" == prepare || "$DEPLOY_OPERATION" == deploy ]]
[[ "$APPLICATION" == lojas.avilaops.com ]]
[[ "$GITHUB_EVENT_NAME" != pull_request* ]]
[[ "$GITHUB_REF" == "refs/heads/$DEFAULT_BRANCH" ]]
[[ "$GITHUB_RUN_ID" =~ ^[0-9]+$ ]]
[[ "$IMAGE" =~ ^ghcr\.io/avilaops/lojas\.avilaops\.com@sha256:[a-f0-9]{64}$ ]]
[[ "$DEPLOY_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]]
[[ "$DEPLOY_USER" =~ ^[a-z_][a-z0-9_-]*$ ]]
[[ "$DEPLOY_PORT" =~ ^[0-9]{1,5}$ ]]
(( DEPLOY_PORT > 0 && DEPLOY_PORT < 65536 ))

# A trava serializa operações; a consulta impede um run antigo de publicar
# depois de um mais novo. Conferir em prepare E deploy: outro run pode surgir
# entre os dois jobs. Um commit com skip-ci não impede a entrega aprovada.
criado=$(gh api "repos/${GITHUB_REPOSITORY}/actions/runs/$GITHUB_RUN_ID" --jq '.created_at')
[[ "$criado" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]]
contagens=$(gh api --paginate \
  "repos/${GITHUB_REPOSITORY}/actions/workflows/deploy-production.yml/runs?branch=${DEFAULT_BRANCH}&created=%3E%3D${criado}&per_page=100" \
  --jq "[.workflow_runs[] | select(.id > ${GITHUB_RUN_ID} and .event != \"pull_request\" and .event != \"pull_request_target\" and (.conclusion == null or .conclusion == \"success\"))] | length")
mais_novos=0
while IFS= read -r contagem; do
  [[ "$contagem" =~ ^[0-9]+$ ]]
  mais_novos=$((mais_novos + contagem))
done <<< "$contagens"
if (( mais_novos > 0 )); then
  echo '::notice::Execução superada por uma publicação mais nova; operação remota dispensada.'
  echo 'publicar=false' >> "$GITHUB_OUTPUT"
  exit 0
fi

temporary_ssh=$(mktemp -d)
trap 'rm -rf "$temporary_ssh"' EXIT
chmod 700 "$temporary_ssh"
printf '%s\n' "$SSH_KEY" > "$temporary_ssh/key"
printf '%s\n' "$KNOWN_HOSTS" > "$temporary_ssh/known_hosts"
chmod 600 "$temporary_ssh/key" "$temporary_ssh/known_hosts"
printf '%s\n' "$GHCR_TOKEN" | ssh -T -i "$temporary_ssh/key" -p "$DEPLOY_PORT" \
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$temporary_ssh/known_hosts" \
  -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=3 \
  "$DEPLOY_USER@$DEPLOY_HOST" "$DEPLOY_OPERATION $APPLICATION $IMAGE"
echo 'publicar=true' >> "$GITHUB_OUTPUT"
