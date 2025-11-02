#!/bin/bash
# AICIN - GCP Project Setup
# Automated setup with error handling and monitoring

set -e  # Exit on error

PROJECT_ID="aicin-477004"
REGION="us-west1"

echo "=========================================="
echo "AICIN - GCP Project Setup"
echo "=========================================="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Set project
echo "Step 1/6: Setting GCP project..."
gcloud config set project $PROJECT_ID
if [ $? -eq 0 ]; then
    echo "✓ Project set successfully"
else
    echo "✗ Failed to set project"
    exit 1
fi

# Enable required APIs
echo ""
echo "Step 2/6: Enabling required APIs (this may take 2-3 minutes)..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  cloudtrace.googleapis.com

if [ $? -eq 0 ]; then
    echo "✓ APIs enabled successfully"
else
    echo "✗ Failed to enable APIs"
    exit 1
fi

# Create Artifact Registry repository
echo ""
echo "Step 3/6: Creating Artifact Registry repository..."
gcloud artifacts repositories describe aicin-agents \
  --location=$REGION 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✓ Repository already exists"
else
    gcloud artifacts repositories create aicin-agents \
      --repository-format=docker \
      --location=$REGION \
      --description="AICIN multi-agent system containers"

    if [ $? -eq 0 ]; then
        echo "✓ Repository created successfully"
    else
        echo "✗ Failed to create repository"
        exit 1
    fi
fi

# Configure Docker authentication
echo ""
echo "Step 4/6: Configuring Docker authentication..."
gcloud auth configure-docker us-west1-docker.pkg.dev --quiet
if [ $? -eq 0 ]; then
    echo "✓ Docker authentication configured"
else
    echo "✗ Failed to configure Docker"
    exit 1
fi

# Create secrets
echo ""
echo "Step 5/6: Creating Google Secret Manager secrets..."

# Validate environment variables
if [ -z "$DATABASE_PASSWORD" ]; then
  echo "❌ ERROR: DATABASE_PASSWORD environment variable is required"
  echo "Set it with: export DATABASE_PASSWORD='your-database-password'"
  exit 1
fi

if [ -z "$JWT_SECRET" ]; then
  echo "❌ ERROR: JWT_SECRET environment variable is required"
  echo "Set it with: export JWT_SECRET='your-jwt-secret'"
  echo "Generate a secret: openssl rand -base64 32"
  exit 1
fi

# Database password
echo -n "$DATABASE_PASSWORD" | \
  gcloud secrets create database-password --data-file=- 2>/dev/null || \
  echo "✓ database-password secret already exists"

# JWT secret
echo -n "$JWT_SECRET" | \
  gcloud secrets create jwt-secret --data-file=- 2>/dev/null || \
  echo "✓ jwt-secret already exists"

echo "✓ Secrets configured"

# Grant Cloud Run service account access to secrets
echo ""
echo "Step 6/6: Granting service account permissions..."
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
SERVICE_ACCOUNT="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding database-password \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet

gcloud secrets add-iam-policy-binding jwt-secret \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet

echo "✓ Permissions granted"

echo ""
echo "=========================================="
echo "✓ GCP Setup Complete!"
echo "=========================================="
echo ""
echo "Next step: Run ./scripts/deploy-all.sh"
