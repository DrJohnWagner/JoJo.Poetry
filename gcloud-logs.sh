#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="jojo-poetry"
REGION="us-east1"
SERVICE="jojo-poetry"

gcloud config set project "$PROJECT_ID"

gcloud run services describe "$SERVICE" \
    --region "$REGION" \
    --format 'table(status.traffic.revisionName,status.traffic.percent)'

echo

gcloud run services logs read "$SERVICE" \
    --region "$REGION" \
    --limit 100 \
    --freshness 10m
