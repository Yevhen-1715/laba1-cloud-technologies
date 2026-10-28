#!/usr/bin/env bash
# Перший push образу в ECR (до або одразу після terraform apply).
# Потрібні: AWS CLI, Docker, jq. Запускати з кореня репозиторію.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v terraform >/dev/null; then
  echo "terraform не знайдено" >&2
  exit 1
fi

ECR_URL="$(terraform -chdir=terraform output -raw ecr_repository_url)"
REGION="$(terraform -chdir=terraform output -json 2>/dev/null | jq -r '.ecr_repository_url.value' | cut -d. -f4)"
# Надійніше взяти регіон з URI: ACCOUNT.dkr.ecr.REGION.amazonaws.com/NAME
REGION="$(echo "$ECR_URL" | sed -E 's|^[0-9]+\.dkr\.ecr\.([^.]+)\.amazonaws\.com/.*|\1|')"
ACCOUNT="$(echo "$ECR_URL" | cut -d. -f1)"
TAG="${1:-$(git rev-parse HEAD)}"
IMAGE_URI="${ECR_URL}:${TAG}"

echo "Logging into ECR ${ACCOUNT} (${REGION})..."
aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com"

echo "Building ${IMAGE_URI}..."
docker build -t "$IMAGE_URI" .

echo "Pushing..."
docker push "$IMAGE_URI"

# також latest — зручно для першого запуску ECS
docker tag "$IMAGE_URI" "${ECR_URL}:latest"
docker push "${ECR_URL}:latest"

echo "Done: ${IMAGE_URI}"
echo "Force new ECS deployment:"
CLUSTER="$(terraform -chdir=terraform output -raw ecs_cluster_name)"
SERVICE="$(terraform -chdir=terraform output -raw ecs_service_name)"
aws ecs update-service --cluster "$CLUSTER" --service "$SERVICE" --force-new-deployment --region "$REGION" >/dev/null
echo "ECS service update requested."
