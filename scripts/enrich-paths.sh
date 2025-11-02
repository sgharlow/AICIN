#!/bin/bash
# AICIN - Enrich Learning Paths with Gemini
# Generates AI-enhanced descriptions and metadata for all learning paths

PROJECT_ID="aicin-477004"
REGION="us-west1"
MODEL="gemini-1.5-flash"

echo "=========================================="
echo "AICIN - Path Enrichment with Gemini"
echo "=========================================="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Model: $MODEL"
echo ""

# Check if Vertex AI is enabled
if ! gcloud services list --enabled --project=$PROJECT_ID | grep -q aiplatform.googleapis.com; then
  echo "✗ Vertex AI API not enabled"
  echo "Run: ./scripts/setup-gemini.sh"
  exit 1
fi

echo "✓ Vertex AI API enabled"
echo ""

# This script would typically:
# 1. Fetch all learning paths from PostgreSQL
# 2. For each path, generate enriched description using Gemini
# 3. Extract key concepts, prerequisites, outcomes
# 4. Cache results in Redis or PostgreSQL
# 5. Update path embeddings for semantic search

echo "Enrichment Process:"
echo "1. Fetch learning paths from database"
echo "2. Generate Gemini enrichment for each path"
echo "3. Extract key concepts and prerequisites"
echo "4. Cache embeddings in Memorystore Redis"
echo "5. Update database with enriched metadata"
echo ""

# Example Gemini prompt for path enrichment
cat > /tmp/enrichment-prompt-example.txt <<'EOF'
You are an AI education expert analyzing learning paths for LearningAI365.com.

Given this learning path:
- Title: {path_title}
- Description: {path_description}
- Courses: {course_list}
- Provider: {provider}
- Level: {level}

Generate a JSON response with:
1. enhanced_description: A 2-3 sentence compelling overview
2. key_concepts: Top 5 concepts covered (array)
3. prerequisites: Required background knowledge (array)
4. learning_outcomes: What learners will achieve (array)
5. ideal_for: Types of learners who benefit most (string)
6. difficulty_level: 1-10 rating
7. estimated_hours: Total learning time estimate

Format: Valid JSON only, no markdown
EOF

echo "Example prompt saved to: /tmp/enrichment-prompt-example.txt"
echo ""

# Cost estimate
TOTAL_PATHS=251
COST_PER_ENRICHMENT=0.004
TOTAL_COST=$(echo "$TOTAL_PATHS * $COST_PER_ENRICHMENT" | bc -l)

echo "Cost Estimate:"
echo "  Total Paths: $TOTAL_PATHS"
echo "  Cost per enrichment: \$$(printf '%.4f' $COST_PER_ENRICHMENT)"
echo "  Total cost: \$$(printf '%.2f' $TOTAL_COST)"
echo ""

echo "=========================================="
echo "Ready to Enrich Paths"
echo "=========================================="
echo ""
echo "To run enrichment:"
echo "1. Ensure Redis is deployed (./scripts/deploy-redis.sh)"
echo "2. Ensure database is accessible"
echo "3. Run: npm run enrich:paths (in agents/content-matcher)"
echo ""
echo "Or manually test Gemini with:"
echo "  cat /tmp/enrichment-prompt-example.txt"
echo ""
