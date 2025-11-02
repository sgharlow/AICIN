#!/bin/bash
# AICIN - Test Deployed Cloud Run Services
# Tests health endpoints and basic functionality

PROJECT_ID="aicin-477004"
REGION="us-west1"

echo "=========================================="
echo "AICIN - Service Health Check"
echo "=========================================="
echo ""

# Get all deployed services
SERVICES=$(gcloud run services list \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format="value(metadata.name)")

if [ -z "$SERVICES" ]; then
  echo "No services found!"
  exit 1
fi

echo "Testing services:"
echo ""

for service in $SERVICES; do
  # Get service URL
  URL=$(gcloud run services describe $service \
    --region=$REGION \
    --project=$PROJECT_ID \
    --format='value(status.url)')

  echo "Testing: $service"
  echo "URL: $URL/health"

  # Test health endpoint
  RESPONSE=$(curl -s -w "\n%{http_code}" "$URL/health" 2>&1)
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | head -n -1)

  if [ "$HTTP_CODE" == "200" ]; then
    echo "✓ Status: HEALTHY (200 OK)"
    echo "  Response: $BODY"
  else
    echo "✗ Status: UNHEALTHY ($HTTP_CODE)"
    echo "  Response: $BODY"
  fi

  echo ""
done

echo "=========================================="
echo "Health Check Complete"
echo "=========================================="
