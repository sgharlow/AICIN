#!/bin/bash
# Quick health check for all deployed agents

SERVICES=(
  "orchestrator"
  "profile-analyzer"
  "content-matcher"
  "path-optimizer"
  "course-validator"
  "recommendation-builder"
)

echo "Testing Cloud Run Service Health..."
echo ""

for service in "${SERVICES[@]}"; do
  # Get service URL
  URL=$(gcloud run services describe $service \
    --region=us-west1 \
    --project=aicin-477004 \
    --format='value(status.url)' 2>/dev/null)

  if [ -z "$URL" ]; then
    echo "✗ $service: NOT DEPLOYED"
    continue
  fi

  # Test health endpoint
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL/health" 2>/dev/null)

  if [ "$HTTP_CODE" == "200" ]; then
    echo "✓ $service: HEALTHY ($URL)"
  else
    echo "✗ $service: UNHEALTHY (HTTP $HTTP_CODE)"
  fi
done

echo ""
echo "Health check complete!"
