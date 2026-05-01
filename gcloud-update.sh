#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="jojo-poetry"
REGION="us-east1"
REPO="jojo-poetry"
SERVICE="jojo-poetry"
DOCKERFILE="Dockerfile-gcloud"

TAG="$(date +%Y%m%d-%H%M%S)"
IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/$SERVICE:$TAG"
LATEST_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/$SERVICE:latest"

gcloud config set project "$PROJECT_ID"

gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet

docker build \
    --no-cache \
    -f "$DOCKERFILE" \
    -t "$IMAGE" \
    -t "$LATEST_IMAGE" \
    .

echo
echo "Built image Python version:"
docker run --rm "$IMAGE" python --version

echo
echo "Built image sklearn path:"
docker run --rm "$IMAGE" python -c "import sklearn; print(sklearn.__file__)"

docker push "$IMAGE"
docker push "$LATEST_IMAGE"

gcloud run deploy "$SERVICE" \
    --image "$IMAGE" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --port 8080 \
    --set-env-vars READ_ONLY=true,NEXT_PUBLIC_READ_ONLY=true,API_BASE_URL_SERVER=http://127.0.0.1:8000,FASTAPI_PORT=8000

echo
echo "Deployed image:"
echo "$IMAGE"

echo
echo "Service URL:"
gcloud run services describe "$SERVICE" \
    --region "$REGION" \
    --format 'value(status.url)'