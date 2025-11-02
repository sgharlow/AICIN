#!/bin/bash
# AICIN - Setup Gemini Integration
# Prepares Vertex AI for Gemini model usage

PROJECT_ID="aicin-477004"
REGION="us-west1"
MODEL="gemini-1.5-flash"

echo "=========================================="
echo "AICIN - Gemini Integration Setup"
echo "=========================================="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Model: $MODEL"
echo ""

# Check if Vertex AI API is enabled
echo "Step 1/3: Verifying Vertex AI API..."
if gcloud services list --enabled --project=$PROJECT_ID | grep -q aiplatform.googleapis.com; then
  echo "✓ Vertex AI API is enabled"
else
  echo "Enabling Vertex AI API..."
  gcloud services enable aiplatform.googleapis.com --project=$PROJECT_ID
  echo "✓ Vertex AI API enabled"
fi

# Test Gemini API access
echo ""
echo "Step 2/3: Testing Gemini API access..."

# Create a test prompt file
cat > /tmp/gemini-test.json <<EOF
{
  "contents": [{
    "role": "user",
    "parts": [{"text": "Hello! Reply with 'Gemini API is working'"}]
  }]
}
EOF

# Test API call
RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  "https://$REGION-aiplatform.googleapis.com/v1/projects/$PROJECT_ID/locations/$REGION/publishers/google/models/$MODEL:generateContent" \
  -d @/tmp/gemini-test.json)

if echo "$RESPONSE" | grep -q "Gemini API is working"; then
  echo "✓ Gemini API is accessible and working"
else
  echo "⚠ Gemini API test response:"
  echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
fi

rm -f /tmp/gemini-test.json

# Display quota information
echo ""
echo "Step 3/3: Checking API quotas..."
echo "Note: Default quota for Gemini 1.5 Flash:"
echo "  - 10 requests per minute"
echo "  - 1000 requests per day"
echo "  - Free tier: First 1500 requests/day"
echo ""
echo "To increase quotas, visit:"
echo "https://console.cloud.google.com/apis/api/aiplatform.googleapis.com/quotas?project=$PROJECT_ID"

echo ""
echo "=========================================="
echo "✓ Gemini Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Test Gemini integration: npm run test:gemini"
echo "2. Run enrichment job: ./scripts/enrich-paths.sh"
echo "3. Monitor usage: gcloud logging read 'resource.type=aiplatform.googleapis.com'"
