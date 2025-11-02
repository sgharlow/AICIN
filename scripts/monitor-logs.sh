#!/bin/bash
# AICIN - Monitor Logs
# Real-time log monitoring for all services

PROJECT_ID="aicin-477004"
REGION="us-west1"

# Check if service name is provided
if [ -z "$1" ]; then
    echo "Usage: ./scripts/monitor-logs.sh [service-name]"
    echo ""
    echo "Available services:"
    echo "  orchestrator"
    echo "  profile-analyzer"
    echo "  content-matcher"
    echo "  path-optimizer"
    echo "  course-validator"
    echo "  recommendation-builder"
    echo "  all (monitors orchestrator)"
    echo ""
    echo "Example: ./scripts/monitor-logs.sh orchestrator"
    exit 1
fi

SERVICE=$1

if [ "$SERVICE" == "all" ]; then
    SERVICE="orchestrator"
fi

echo "=========================================="
echo "Monitoring logs for: $SERVICE"
echo "=========================================="
echo "Press Ctrl+C to stop"
echo ""

# Follow logs in real-time
gcloud run logs tail $SERVICE \
  --region $REGION \
  --project $PROJECT_ID
