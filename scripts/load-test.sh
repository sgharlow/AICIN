#!/bin/bash
# AICIN - Load Testing Script
# Tests Cloud Run auto-scaling and performance

PROJECT_ID="aicin-477004"
REGION="us-west1"
SERVICE_NAME=${1:-orchestrator}
CONCURRENT_REQUESTS=${2:-10}
TOTAL_REQUESTS=${3:-100}

echo "=========================================="
echo "AICIN - Load Test"
echo "=========================================="
echo "Service: $SERVICE_NAME"
echo "Concurrent: $CONCURRENT_REQUESTS"
echo "Total Requests: $TOTAL_REQUESTS"
echo ""

# Get service URL
URL=$(gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format='value(status.url)')

if [ -z "$URL" ]; then
  echo "Service not found: $SERVICE_NAME"
  exit 1
fi

echo "Target URL: $URL/health"
echo ""
echo "Starting load test..."
echo ""

# Check if Apache Bench is installed
if ! command -v ab &> /dev/null; then
  echo "Apache Bench (ab) is not installed."
  echo "Install it with:"
  echo "  Windows (via Chocolatey): choco install apache-httpd"
  echo "  Linux: sudo apt-get install apache2-utils"
  echo "  Mac: brew install httpd"
  echo ""
  echo "Falling back to simple curl loop..."
  echo ""

  # Simple load test with curl
  START_TIME=$(date +%s)
  SUCCESS_COUNT=0
  FAIL_COUNT=0
  TOTAL_TIME=0

  for i in $(seq 1 $TOTAL_REQUESTS); do
    RESPONSE_TIME=$(curl -s -w "%{time_total}" -o /dev/null "$URL/health")
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL/health")

    if [ "$HTTP_CODE" == "200" ]; then
      SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
      FAIL_COUNT=$((FAIL_COUNT + 1))
    fi

    TOTAL_TIME=$(echo "$TOTAL_TIME + $RESPONSE_TIME" | bc)

    if [ $((i % 10)) -eq 0 ]; then
      echo "Completed $i/$TOTAL_REQUESTS requests..."
    fi
  done

  END_TIME=$(date +%s)
  DURATION=$((END_TIME - START_TIME))
  AVG_TIME=$(echo "scale=3; $TOTAL_TIME / $TOTAL_REQUESTS" | bc)

  echo ""
  echo "=========================================="
  echo "Load Test Results"
  echo "=========================================="
  echo "Total Requests: $TOTAL_REQUESTS"
  echo "Successful: $SUCCESS_COUNT"
  echo "Failed: $FAIL_COUNT"
  echo "Duration: ${DURATION}s"
  echo "Avg Response Time: ${AVG_TIME}s"
  echo "Requests/sec: $(echo "scale=2; $TOTAL_REQUESTS / $DURATION" | bc)"

else
  # Use Apache Bench for proper load testing
  ab -n $TOTAL_REQUESTS -c $CONCURRENT_REQUESTS "$URL/health"
fi

echo ""
echo "=========================================="
echo "Check Cloud Run metrics:"
echo "https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME/metrics?project=$PROJECT_ID"
echo "=========================================="
