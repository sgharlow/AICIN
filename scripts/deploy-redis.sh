#!/bin/bash
# AICIN - Deploy Memorystore Redis
# Shared cache for all agents

PROJECT_ID="aicin-477004"
REGION="us-west1"
INSTANCE_NAME="aicin-cache"
TIER="BASIC"          # BASIC or STANDARD_HA
MEMORY_SIZE_GB=1      # 1GB minimum
NETWORK="default"

echo "=========================================="
echo "AICIN - Memorystore Redis Deployment"
echo "=========================================="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Instance: $INSTANCE_NAME"
echo "Tier: $TIER"
echo "Memory: ${MEMORY_SIZE_GB}GB"
echo ""

# Check if instance already exists
echo "Step 1/3: Checking for existing instance..."
EXISTING=$(gcloud redis instances describe $INSTANCE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format='value(name)' 2>/dev/null)

if [ -n "$EXISTING" ]; then
  echo "✓ Redis instance already exists: $INSTANCE_NAME"

  # Get connection info
  REDIS_HOST=$(gcloud redis instances describe $INSTANCE_NAME \
    --region=$REGION \
    --project=$PROJECT_ID \
    --format='value(host)')

  REDIS_PORT=$(gcloud redis instances describe $INSTANCE_NAME \
    --region=$REGION \
    --project=$PROJECT_ID \
    --format='value(port)')

  echo ""
  echo "Connection Details:"
  echo "  Host: $REDIS_HOST"
  echo "  Port: $REDIS_PORT"
  echo ""
  echo "Update your Cloud Run services with:"
  echo "  --set-env-vars=\"REDIS_HOST=$REDIS_HOST,REDIS_PORT=$REDIS_PORT\""

  exit 0
fi

# Enable Redis API
echo ""
echo "Step 2/3: Enabling Redis API..."
gcloud services enable redis.googleapis.com --project=$PROJECT_ID

# Create Redis instance
echo ""
echo "Step 3/3: Creating Redis instance..."
echo "Note: This takes 3-5 minutes..."

gcloud redis instances create $INSTANCE_NAME \
  --size=$MEMORY_SIZE_GB \
  --region=$REGION \
  --project=$PROJECT_ID \
  --tier=$TIER \
  --redis-version=redis_6_x \
  --network=projects/$PROJECT_ID/global/networks/$NETWORK

if [ $? -ne 0 ]; then
  echo "✗ Failed to create Redis instance"
  exit 1
fi

echo ""
echo "✓ Redis instance created successfully!"

# Get connection info
REDIS_HOST=$(gcloud redis instances describe $INSTANCE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format='value(host)')

REDIS_PORT=$(gcloud redis instances describe $INSTANCE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format='value(port)')

echo ""
echo "=========================================="
echo "✓ Memorystore Redis Deployed!"
echo "=========================================="
echo ""
echo "Connection Details:"
echo "  Host: $REDIS_HOST"
echo "  Port: $REDIS_PORT"
echo ""
echo "Next Steps:"
echo "1. Update Cloud Run services:"
echo "   gcloud run services update orchestrator \\"
echo "     --region=$REGION \\"
echo "     --set-env-vars=\"REDIS_HOST=$REDIS_HOST,REDIS_PORT=$REDIS_PORT\""
echo ""
echo "2. Test Redis connection:"
echo "   ./scripts/test-redis.sh"
echo ""
echo "Cost Estimate:"
echo "  Basic Tier (1GB): ~\$28/month"
echo "  IMPORTANT: Delete when not in use to save costs!"
echo ""
