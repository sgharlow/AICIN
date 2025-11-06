#!/bin/bash
TOKEN=$(curl -s http://localhost:3001/api/demo-token | python -c "import sys, json; print(json.load(sys.stdin)['token'])")

curl -X POST https://orchestrator-239116109469.us-west1.run.app/api/v1/quiz/score \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "answers": {
      "experienceLevel": "intermediate",
      "interests": ["computer-vision"],
      "availability": "10-20h",
      "budget": "$100-500",
      "timeline": "3-6-months",
      "certification": "nice-to-have",
      "learningGoal": "career-switch",
      "programming": "intermediate"
    }
  }' | python -m json.tool
