#!/bin/bash
# AICIN - Master Deployment Script
# Runs complete deployment from start to finish with monitoring

set -e

echo "=========================================="
echo "AICIN - Complete Deployment Pipeline"
echo "=========================================="
echo ""
echo "This will:"
echo "  1. Setup GCP project and services"
echo "  2. Build all Docker images"
echo "  3. Deploy all agents to Cloud Run"
echo "  4. Run health checks"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 0
fi

# Change to project directory
cd ~/CascadeProjects/AICIN

# Step 1: GCP Setup
echo ""
echo "=========================================="
echo "STEP 1/3: GCP Project Setup"
echo "=========================================="
./scripts/setup-gcp.sh
if [ $? -ne 0 ]; then
    echo "✗ GCP setup failed"
    exit 1
fi

# Step 2: Build and Deploy
echo ""
echo "=========================================="
echo "STEP 2/3: Build & Deploy All Agents"
echo "=========================================="
./scripts/build-and-deploy.sh
if [ $? -ne 0 ]; then
    echo "✗ Build/deployment failed"
    exit 1
fi

# Step 3: Health Checks
echo ""
echo "=========================================="
echo "STEP 3/3: Health Checks"
echo "=========================================="
sleep 10  # Wait for services to warm up
./scripts/test-health.sh
if [ $? -ne 0 ]; then
    echo "⚠ Some health checks failed, but deployment completed"
    echo "Check logs with: ./scripts/monitor-logs.sh orchestrator"
fi

echo ""
echo "=========================================="
echo "✓ DEPLOYMENT COMPLETE!"
echo "=========================================="
echo ""
echo "Service URLs saved to: deployed-urls.txt"
echo ""
echo "Next steps:"
echo "  - View logs: ./scripts/monitor-logs.sh orchestrator"
echo "  - Test API: See QUICKSTART.md for test commands"
echo "  - Monitor: https://console.cloud.google.com/run?project=aicin-477004"
