#!/bin/bash
# AICIN - Setup Static IP for Cloud Run via Cloud NAT
# This provides a predictable egress IP for AWS RDS whitelisting

PROJECT_ID="aicin-477004"
REGION="us-west1"
ROUTER_NAME="aicin-router"
NAT_NAME="aicin-nat"
STATIC_IP_NAME="aicin-egress-ip"

echo "Setting up Cloud NAT with static IP..."

# 1. Reserve a static external IP
echo "Reserving static IP..."
gcloud compute addresses create $STATIC_IP_NAME \
  --region=$REGION \
  --project=$PROJECT_ID

# Get the IP address
STATIC_IP=$(gcloud compute addresses describe $STATIC_IP_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format='value(address)')

echo "✓ Static IP reserved: $STATIC_IP"

# 2. Create Cloud Router
echo "Creating Cloud Router..."
gcloud compute routers create $ROUTER_NAME \
  --network=default \
  --region=$REGION \
  --project=$PROJECT_ID

echo "✓ Cloud Router created"

# 3. Create Cloud NAT configuration
echo "Creating Cloud NAT..."
gcloud compute routers nats create $NAT_NAME \
  --router=$ROUTER_NAME \
  --region=$REGION \
  --nat-custom-subnet-ip-ranges=LIST \
  --nat-external-ip-pool=$STATIC_IP_NAME \
  --project=$PROJECT_ID

echo "✓ Cloud NAT created"

# 4. Configure Cloud Run to use VPC connector (already done, but verify)
echo "Verifying orchestrator uses VPC connector..."
gcloud run services describe orchestrator \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format='value(spec.template.metadata.annotations.run.googleapis.com/vpc-access-connector)'

echo ""
echo "=========================================="
echo "✅ Static IP Setup Complete"
echo "=========================================="
echo ""
echo "STATIC IP TO WHITELIST IN AWS RDS:"
echo "    $STATIC_IP"
echo ""
echo "Add this IP to your AWS RDS Security Group:"
echo "  1. Go to AWS Console → RDS → Security Groups"
echo "  2. Find security group for: learningai365-postgres.cqdxs05ukdwt.us-west-2.rds.amazonaws.com"
echo "  3. Add inbound rule:"
echo "     - Type: PostgreSQL"
echo "     - Port: 5432"
echo "     - Source: $STATIC_IP/32"
echo ""
echo "Monthly Cost: ~$7.50 for Cloud NAT + static IP"
echo ""
