#!/bin/bash
# AICIN - Health Check All Services
# Tests all deployed services

set -e

PROJECT_ID="aicin-477004"
REGION="us-west1"

echo "=========================================="
echo "AICIN - Health Check"
echo "=========================================="
echo ""

# Check if deployed-urls.txt exists
if [ ! -f "deployed-urls.txt" ]; then
    echo "✗ deployed-urls.txt not found. Run ./scripts/build-and-deploy.sh first"
    exit 1
fi

# Source URLs
source deployed-urls.txt

# List of services to check
declare -A SERVICES=(
  ["Orchestrator"]=$ORCHESTRATOR_URL
  ["Profile Analyzer"]=$PROFILE_ANALYZER_URL
  ["Content Matcher"]=$CONTENT_MATCHER_URL
  ["Path Optimizer"]=$PATH_OPTIMIZER_URL
  ["Course Validator"]=$COURSE_VALIDATOR_URL
  ["Recommendation Builder"]=$RECOMMENDATION_BUILDER_URL
)

FAILED=0
PASSED=0

# Test each service
for service in "${!SERVICES[@]}"; do
  url="${SERVICES[$service]}"

  echo "Testing $service..."
  echo "  URL: $url/health"

  response=$(curl -s -w "\n%{http_code}" "$url/health" 2>&1)
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)

  if [ "$http_code" == "200" ]; then
    echo "  ✓ Status: $http_code"
    echo "  ✓ Response: $body" | head -c 100
    echo ""
    ((PASSED++))
  else
    echo "  ✗ Status: $http_code"
    echo "  ✗ Error: $body"
    echo ""
    ((FAILED++))
  fi
done

echo ""
echo "=========================================="
echo "Health Check Summary"
echo "=========================================="
echo "Passed: $PASSED"
echo "Failed: $FAILED"

if [ $FAILED -eq 0 ]; then
    echo ""
    echo "✓ All services are healthy!"
    exit 0
else
    echo ""
    echo "✗ Some services failed health check"
    exit 1
fi
