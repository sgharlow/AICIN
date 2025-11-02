#!/bin/bash
# AICIN - Build and Deploy All Agents
# Automated deployment with error handling

set -e

PROJECT_ID="aicin-477004"
REGION="us-west1"
REGISTRY="us-west1-docker.pkg.dev"
REPOSITORY="aicin-agents"

echo "=========================================="
echo "AICIN - Build & Deploy All Agents"
echo "=========================================="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Verify project is set
CURRENT_PROJECT=$(gcloud config get-value project)
if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
    echo "Setting project to $PROJECT_ID..."
    gcloud config set project $PROJECT_ID
fi

# List of agents
AGENTS=(
  "orchestrator"
  "profile-analyzer"
  "content-matcher"
  "path-optimizer"
  "course-validator"
  "recommendation-builder"
)

# Track deployment URLs
declare -A AGENT_URLS

# Build and deploy each agent
for agent in "${AGENTS[@]}"; do
  echo ""
  echo "=========================================="
  echo "Building & Deploying: $agent"
  echo "=========================================="

  IMAGE_NAME="$REGISTRY/$PROJECT_ID/$REPOSITORY/$agent:latest"

  # Build with Cloud Build
  echo "Building image..."
  # Create temporary cloudbuild.yaml for this agent
  cat > /tmp/cloudbuild-$agent.yaml <<EOF
steps:
- name: 'gcr.io/cloud-builders/docker'
  args: ['build', '-t', '$IMAGE_NAME', '-f', 'agents/$agent/Dockerfile', '.']
images: ['$IMAGE_NAME']
EOF

  gcloud builds submit \
    --config /tmp/cloudbuild-$agent.yaml \
    --timeout=20m \
    --quiet \
    .

  if [ $? -ne 0 ]; then
    echo "✗ Build failed for $agent"
    exit 1
  fi
  echo "✓ Image built: $IMAGE_NAME"

  # Deploy to Cloud Run
  echo "Deploying to Cloud Run..."

  if [ "$agent" == "orchestrator" ]; then
    # Orchestrator needs secrets and environment variables
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
      --set-env-vars="NODE_ENV=production,DATABASE_HOST=learningai365-postgres.cqdxs05ukdwt.us-west-2.rds.amazonaws.com,DATABASE_PORT=5432,DATABASE_NAME=learningai365,DATABASE_USERNAME=learningai_admin,DATABASE_SSL=true" \
      --set-secrets="DATABASE_PASSWORD=database-password:latest,JWT_SECRET=jwt-secret:latest" \
      --quiet
  else
    # Other agents - standard deployment
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
      --set-env-vars="NODE_ENV=production" \
      --quiet
  fi

  if [ $? -ne 0 ]; then
    echo "✗ Deployment failed for $agent"
    exit 1
  fi

  # Get service URL
  SERVICE_URL=$(gcloud run services describe $agent --region $REGION --format 'value(status.url)')
  AGENT_URLS[$agent]=$SERVICE_URL

  echo "✓ $agent deployed: $SERVICE_URL"
done

echo ""
echo "=========================================="
echo "All Agents Deployed Successfully!"
echo "=========================================="
echo ""
echo "Service URLs:"
for agent in "${AGENTS[@]}"; do
  echo "  $agent: ${AGENT_URLS[$agent]}"
done

# Update orchestrator with agent URLs
echo ""
echo "=========================================="
echo "Updating Orchestrator with Agent URLs"
echo "=========================================="

gcloud run services update orchestrator \
  --region $REGION \
  --set-env-vars="PROFILE_ANALYZER_URL=${AGENT_URLS[profile-analyzer]},CONTENT_MATCHER_URL=${AGENT_URLS[content-matcher]},PATH_OPTIMIZER_URL=${AGENT_URLS[path-optimizer]},COURSE_VALIDATOR_URL=${AGENT_URLS[course-validator]},RECOMMENDATION_BUILDER_URL=${AGENT_URLS[recommendation-builder]}" \
  --quiet

echo "✓ Orchestrator updated with agent URLs"

# Save URLs to file
echo ""
echo "Saving URLs to deployed-urls.txt..."
cat > deployed-urls.txt << EOF
# AICIN Deployed Service URLs
# Generated: $(date)

ORCHESTRATOR_URL=${AGENT_URLS[orchestrator]}
PROFILE_ANALYZER_URL=${AGENT_URLS[profile-analyzer]}
CONTENT_MATCHER_URL=${AGENT_URLS[content-matcher]}
PATH_OPTIMIZER_URL=${AGENT_URLS[path-optimizer]}
COURSE_VALIDATOR_URL=${AGENT_URLS[course-validator]}
RECOMMENDATION_BUILDER_URL=${AGENT_URLS[recommendation-builder]}
EOF

echo ""
echo "=========================================="
echo "✓ Deployment Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Test health: ./scripts/test-health.sh"
echo "2. View URLs: cat deployed-urls.txt"
echo "3. Monitor logs: gcloud run logs read orchestrator --region $REGION"
