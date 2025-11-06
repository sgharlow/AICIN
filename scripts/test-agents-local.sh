#!/bin/bash
# Start all AICIN agents locally for testing
# Usage: bash test-agents-local.sh

echo "🚀 Starting AICIN agents locally for testing..."
echo ""

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Kill any existing node processes on agent ports
echo "Cleaning up existing processes..."
lsof -ti:8081 | xargs kill -9 2>/dev/null || true  # Profile Analyzer
lsof -ti:8082 | xargs kill -9 2>/dev/null || true  # Content Matcher
lsof -ti:8083 | xargs kill -9 2>/dev/null || true  # Path Optimizer
lsof -ti:8084 | xargs kill -9 2>/dev/null || true  # Recommendation Builder
lsof -ti:8080 | xargs kill -9 2>/dev/null || true  # Orchestrator

sleep 2

# Start agents in background
echo "Starting Profile Analyzer (port 8081)..."
cd agents/profile-analyzer && npm start > ../../logs/profile-analyzer.log 2>&1 &
PROFILE_PID=$!

echo "Starting Content Matcher (port 8082)..."
cd ../content-matcher && npm start > ../../logs/content-matcher.log 2>&1 &
CONTENT_PID=$!

echo "Starting Path Optimizer (port 8083)..."
cd ../path-optimizer && npm start > ../../logs/path-optimizer.log 2>&1 &
OPTIMIZER_PID=$!

echo "Starting Recommendation Builder (port 8084)..."
cd ../recommendation-builder && npm start > ../../logs/recommendation-builder.log 2>&1 &
RECOMMENDER_PID=$!

sleep 3

# Start orchestrator
echo "Starting Orchestrator (port 8080)..."
cd ../orchestrator && \
  PORT=8080 \
  PROFILE_ANALYZER_URL=http://localhost:8081/invoke \
  CONTENT_MATCHER_URL=http://localhost:8082/invoke \
  PATH_OPTIMIZER_URL=http://localhost:8083/invoke \
  RECOMMENDATION_BUILDER_URL=http://localhost:8084/invoke \
  npm start > ../../logs/orchestrator.log 2>&1 &
ORCHESTRATOR_PID=$!

cd ../..

echo ""
echo "✅ All agents started!"
echo ""
echo "Process IDs:"
echo "  Profile Analyzer: $PROFILE_PID"
echo "  Content Matcher: $CONTENT_PID"
echo "  Path Optimizer: $OPTIMIZER_PID"
echo "  Recommendation Builder: $RECOMMENDER_PID"
echo "  Orchestrator: $ORCHESTRATOR_PID"
echo ""
echo "Logs:"
echo "  tail -f logs/*.log"
echo ""
echo "Health checks:"
echo "  curl http://localhost:8081/health  # Profile Analyzer"
echo "  curl http://localhost:8082/health  # Content Matcher"
echo "  curl http://localhost:8083/health  # Path Optimizer"
echo "  curl http://localhost:8084/health  # Recommendation Builder"
echo "  curl http://localhost:8080/health  # Orchestrator"
echo ""
echo "Demo URL: http://localhost:3001"
echo ""
echo "To stop all agents: killall node"
