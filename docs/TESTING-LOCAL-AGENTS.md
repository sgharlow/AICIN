# Testing AICIN Agents Locally

This guide helps you test the full multi-agent system locally to debug the scoring issues.

## Problem
The deployed agents are giving all learning paths identical scores (96%), making recommendations unhelpful:
- "Generative 3D Models" recommended for NLP interests
- All paths show: contentScore: 100%, metadataScore: 95%
- No differentiation between relevant and irrelevant paths

## Solution: Test Locally

### Step 1: Start All Agents Locally

Run the batch script to start all 5 services:

```bash
./test-agents-local.bat
```

This will start in separate windows:
- **Profile Analyzer** (port 8081)
- **Content Matcher** (port 8082)
- **Path Optimizer** (port 8083)
- **Recommendation Builder** (port 8084)
- **Orchestrator** (port 8080) - configured to use local agents

### Step 2: Verify All Services Are Running

```bash
curl http://localhost:8081/health  # Profile Analyzer
curl http://localhost:8082/health  # Content Matcher
curl http://localhost:8083/health  # Path Optimizer
curl http://localhost:8084/health  # Recommendation Builder
curl http://localhost:8080/health  # Orchestrator
```

All should return `{"status":"healthy",...}`

### Step 3: Test the Demo Quiz

1. Open: http://localhost:3001
2. Fill out the quiz and select **NLP** as your interest
3. Submit and observe the recommendations

### Step 4: Review the Logs

The logs will show exactly what's happening with scoring:

```bash
# Content Matcher logs (shows TF-IDF scores)
type logs\content-matcher.log

# Path Optimizer logs (shows final scores and ranking)
type logs\path-optimizer.log

# Orchestrator logs (shows full workflow)
type logs\orchestrator.log
```

Look for:
- **Content Matcher**: "Top 5 TF-IDF scores" - should show varying scores, not all the same
- **Path Optimizer**: "Top score: X, Average: Y" - should show differentiation
- Any "DEBUG" messages about ID mismatches

### Step 5: Expected vs Actual

**Expected for NLP interest:**
```
Top 5 paths:
1. Beginner Natural Language Processing (95% match)
2. Intermediate NLP with Transformers (92% match)
3. Text Analysis Fundamentals (88% match)
4. Applied NLP Projects (85% match)
5. Machine Learning for NLP (82% match)
```

**Actual (broken):**
```
All paths: 96% match (no differentiation)
```

### Key Files to Check

If scores are still identical, the issue is likely in:

1. **Content Matcher** (`agents/content-matcher/src/content-analyzer-optimized.ts`)
   - Line 128-200: `calculateAllScores()` - TF-IDF calculation
   - Check if all scores are identical coming out of TF-IDF

2. **Path Optimizer** (`agents/path-optimizer/src/scoring.ts`)
   - Line 53-66: `getContentScore()` - Content score lookup
   - Line 80-121: `calculateMetadataScore()` - Metadata matching
   - Line 155-210: `scorePath()` - Final score calculation

3. **ID Mismatch**
   - Content Matcher uses `path.id` (number)
   - Path Optimizer looks up by `path.document_id` (string)
   - Check logs for "Content score lookup" messages

### Debugging Checklist

- [ ] All 5 services start without errors
- [ ] Health checks return 200 OK
- [ ] Content Matcher logs show varying TF-IDF scores (not all 1.0)
- [ ] Path Optimizer logs show varying final scores (not all 0.96)
- [ ] No ID mismatch errors in logs
- [ ] NLP paths rank higher than unrelated paths (e.g., 3D Models)

### Common Issues

**All TF-IDF scores are 1.0:**
- Problem: TF-IDF normalization is capping all scores
- Fix: Check `getContentScore()` in path-optimizer/src/scoring.ts line 65

**All metadata scores are 0.95:**
- Problem: All paths have same experience level and budget as user
- Fix: Check database - paths should have varying levels (beginner/intermediate/advanced)

**ID mismatch:**
- Problem: Content scores use different IDs than Path Optimizer expects
- Fix: Ensure consistent ID usage (either `id` or `document_id` throughout)

### Next Steps

Once you identify the issue in the logs:
1. Fix the relevant agent code
2. Rebuild: `npm run build` in the agent directory
3. Restart the agents: Re-run `test-agents-local.bat`
4. Retest the quiz
5. Once working, redeploy the fixed agents to Cloud Run

## Quick Reference

**Start agents:** `./test-agents-local.bat`
**View logs:** `type logs\*.log`
**Health checks:** `curl http://localhost:8080/health`
**Demo:** http://localhost:3001
**Stop agents:** Close the windows or Task Manager
