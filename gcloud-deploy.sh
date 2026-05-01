#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="jojo-poetry"
REGION="us-east1"
REPO="jojo-poetry"
SERVICE="jojo-poetry"
DOCKERFILE="Dockerfile-gcloud"
IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/$SERVICE:latest"

gcloud auth login --no-launch-browser

gcloud auth login
gcloud config set project "$PROJECT_ID"

gcloud services enable \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com

gcloud artifacts repositories create "$REPO" \
    --repository-format=docker \
    --location="$REGION" \
    || true

gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet

docker build \
    -f "$DOCKERFILE" \
    -t "$IMAGE" \
    .

docker push "$IMAGE"

gcloud run deploy "$SERVICE" \
    --image "$IMAGE" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --port 8080 \
    --set-env-vars READ_ONLY=true,NEXT_PUBLIC_READ_ONLY=true,API_BASE_URL_SERVER=http://127.0.0.1:8000,FASTAPI_PORT=8000

echo
echo "Service URL:"
gcloud run services describe "$SERVICE" \
    --region "$REGION" \
    --format 'value(status.url)'