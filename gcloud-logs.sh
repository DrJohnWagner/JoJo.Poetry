#! /bin/bash

PROJECT_ID="jojo-poetry"
REGION="us-east1"
REPO="jojo-poetry"
SERVICE="jojo-poetry"
DOCKERFILE="Dockerfile-gcloud"

REVISION="$(gcloud run services describe "$SERVICE" \
    --region "$REGION" \
    --format 'value(status.latestReadyRevisionName)')"

echo "$REVISION"

gcloud run services logs read "$SERVICE" \
    --region "$REGION" \
    --limit 100 \
    --freshness 10m

gcloud run services describe "$SERVICE" \
    --region "$REGION" \
    --format 'value(status.latestCreatedRevisionName,status.latestReadyRevisionName)'

gcloud run services describe "$SERVICE" \
    --region "$REGION" \
    --format 'table(status.traffic.revisionName,status.traffic.percent)'

# gcloud run services update-traffic "$SERVICE" \
#     --region "$REGION" \
#     --to-latest

REVISION="$(gcloud run services describe "$SERVICE" \
    --region "$REGION" \
    --format 'value(status.latestReadyRevisionName)')"

gcloud logging read \
    "resource.type=cloud_run_revision AND resource.labels.revision_name=$REVISION" \
    --limit=200 \
    --format="value(textPayload)"