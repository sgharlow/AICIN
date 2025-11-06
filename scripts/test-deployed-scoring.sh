#!/bin/bash
# Test deployed orchestrator scoring with Computer Vision quiz

ORCHESTRATOR_URL="https://orchestrator-239116109469.us-west1.run.app"

echo "Testing deployed orchestrator scoring..."
echo "==========================================="
echo ""

# Submit quiz with Computer Vision interest
RESPONSE=$(curl --insecure -s -X POST "$ORCHESTRATOR_URL/quiz/score" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-deployment",
    "answers": {
      "experienceLevel": "intermediate",
      "interests": ["computer-vision"],
      "learningGoal": "career-switch",
      "preferredLearningStyle": "hands-on",
      "weeklyHours": 15,
      "timeline": 12,
      "programmingExperience": "intermediate",
      "maxBudget": 500,
      "wantsCertification": false
    }
  }')

echo "Response from deployed orchestrator:"
echo "$RESPONSE" | jq '.'

echo ""
echo "Top 5 Recommendations:"
echo "$RESPONSE" | jq -r '.recommendations[:5] | .[] | "  \(.rank). \(.title) - \(.matchPercentage)% (exp: \(.categoryBreakdown.experience * 100 | round)%, int: \(.categoryBreakdown.interests * 100 | round)%)"'

echo ""
echo "Checking if timeline and budget scoring are active:"
TIMELINE_CHECK=$(echo "$RESPONSE" | jq -r '.recommendations[0].categoryBreakdown.timeline')
BUDGET_CHECK=$(echo "$RESPONSE" | jq -r '.recommendations[0].categoryBreakdown.budget')

if [ "$TIMELINE_CHECK" != "null" ]; then
  echo "✅ Timeline scoring is active (value: $TIMELINE_CHECK)"
else
  echo "❌ Timeline scoring is NOT in response"
fi

if [ "$BUDGET_CHECK" != "null" ]; then
  echo "✅ Budget scoring is active (value: $BUDGET_CHECK)"
else
  echo "❌ Budget scoring is NOT in response"
fi

echo ""
echo "==========================================="
echo "Deployment verification complete!"
