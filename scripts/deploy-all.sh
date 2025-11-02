#!/bin/bash
# AICIN - Deploy All Agents to Google Cloud Run
# Usage: ./scripts/deploy-all.sh

set -e

# Configuration
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-your-project-id}"
REGION="us-west1"
REGISTRY="us-west1-docker.pkg.dev"
REPOSITORY="aicin-agents"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}AICIN - Google Cloud Run Deployment${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI not found. Please install Google Cloud SDK.${NC}"
    exit 1
fi

# Check if project is set
if [ "$PROJECT_ID" == "your-project-id" ]; then
    echo -e "${RED}Error: Please set GOOGLE_CLOUD_PROJECT environment variable${NC}"
    echo "export GOOGLE_CLOUD_PROJECT=your-actual-project-id"
    exit 1
fi

echo -e "${YELLOW}Project:${NC} $PROJECT_ID"
echo -e "${YELLOW}Region:${NC} $REGION"
echo -e "${YELLOW}Registry:${NC} $REGISTRY"
echo ""

# Confirm deployment
read -p "Deploy all agents? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

# Set project
echo -e "${GREEN}Setting GCP project...${NC}"
gcloud config set project $PROJECT_ID

# Enable required APIs
echo -e "${GREEN}Enabling required APIs...${NC}"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  redis.googleapis.com \
  pubsub.googleapis.com \
  secretmanager.googleapis.com

# Create Artifact Registry repository if it doesn't exist
echo -e "${GREEN}Creating Artifact Registry repository...${NC}"
gcloud artifacts repositories describe $REPOSITORY --location=$REGION 2>/dev/null || \
  gcloud artifacts repositories create $REPOSITORY \
    --repository-format=docker \
    --location=$REGION \
    --description="AICIN multi-agent system containers"

# Configure Docker to use gcloud credentials
echo -e "${GREEN}Configuring Docker authentication...${NC}"
gcloud auth configure-docker $REGISTRY

# List of agents to deploy
AGENTS=(
  "orchestrator"
  "profile-analyzer"
  "content-matcher"
  "path-optimizer"
  "course-validator"
  "recommendation-builder"
)

# Build and deploy each agent
for agent in "${AGENTS[@]}"; do
  echo ""
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}Deploying: $agent${NC}"
  echo -e "${GREEN}========================================${NC}"

  IMAGE_NAME="$REGISTRY/$PROJECT_ID/$REPOSITORY/$agent:latest"

  # Build image using Cloud Build
  echo -e "${YELLOW}Building image...${NC}"
  gcloud builds submit \
    --tag $IMAGE_NAME \
    --timeout=20m \
    -f agents/$agent/Dockerfile \
    .

  # Deploy to Cloud Run
  echo -e "${YELLOW}Deploying to Cloud Run...${NC}"
  gcloud run deploy $agent \
    --image $IMAGE_NAME \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --memory 512Mi \
    --cpu 1 \
    --timeout 60 \
    --max-instances 10 \
    --min-instances 0 \
    --set-env-vars="NODE_ENV=production"

  # Get service URL
  SERVICE_URL=$(gcloud run services describe $agent --region $REGION --format 'value(status.url)')
  echo -e "${GREEN}✓ $agent deployed: $SERVICE_URL${NC}"
done

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Summary${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Display all service URLs
for agent in "${AGENTS[@]}"; do
  SERVICE_URL=$(gcloud run services describe $agent --region $REGION --format 'value(status.url)')
  echo -e "${agent}: ${GREEN}$SERVICE_URL${NC}"
done

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Next Steps:${NC}"
echo -e "${GREEN}========================================${NC}"
echo "1. Update .env with service URLs:"
echo "   PROFILE_ANALYZER_URL=<url-from-above>"
echo "   CONTENT_MATCHER_URL=<url-from-above>"
echo "   etc."
echo ""
echo "2. Configure secrets in Google Secret Manager:"
echo "   gcloud secrets create database-password --data-file=- <<< \"your-password\""
echo "   gcloud secrets create jwt-secret --data-file=- <<< \"your-secret\""
echo ""
echo "3. Update orchestrator with secret access:"
echo "   gcloud run services update orchestrator \\"
echo "     --set-secrets=DATABASE_PASSWORD=database-password:latest,JWT_SECRET=jwt-secret:latest"
echo ""
echo -e "${GREEN}Deployment complete!${NC}"
