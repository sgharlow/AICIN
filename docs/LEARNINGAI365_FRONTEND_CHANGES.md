# LearningAI365 Frontend Changes for AICIN Integration

**Purpose:** Update learningai365.com frontend to use AICIN instead of AWS Lambda.

**Date:** November 6, 2025
**Status:** Required for production cutover
**Estimated Time:** 30 minutes

---

## Overview

This document lists ALL changes needed in your learningai365.com frontend to switch from AWS Lambda to AICIN.

**Current Setup:**
- AWS Lambda Endpoint: `https://9ho7j9p1m3.execute-api.us-west-2.amazonaws.com`
- Monolithic serverless function

**New Setup:**
- AICIN Endpoint: `https://orchestrator-239116109469.us-west1.run.app`
- 6-microservice multi-agent system
- Response time: 2.5s average (2-3s warm)

---

## Part 1: Environment Variables

### **File:** `.env.local` (for local development)

```bash
# AICIN Configuration (NEW)
NEXT_PUBLIC_AICIN_API_URL=https://orchestrator-239116109469.us-west1.run.app

# Keep existing variables unchanged
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-dev-secret
# ... other variables
```

### **File:** `.env.production` (for production)

```bash
# AICIN Configuration (UPDATED)
NEXT_PUBLIC_AICIN_API_URL=https://orchestrator-239116109469.us-west1.run.app

# Previous AWS Lambda endpoint (BACKUP - keep commented for rollback)
# NEXT_PUBLIC_QUIZ_API_URL=https://9ho7j9p1m3.execute-api.us-west-2.amazonaws.com

# Keep existing variables unchanged
NEXTAUTH_URL=https://learningai365.com
# ... other variables
```

### **Vercel Environment Variables**

Update via Vercel CLI:

```bash
# Remove old variable
vercel env rm NEXT_PUBLIC_QUIZ_API_URL production

# Add AICIN endpoint
echo "https://orchestrator-239116109469.us-west1.run.app" | \
  vercel env add NEXT_PUBLIC_AICIN_API_URL production

# Verify
vercel env ls
```

Or via Vercel Dashboard:
1. Go to: https://vercel.com/your-team/learningai365/settings/environment-variables
2. Find `NEXT_PUBLIC_QUIZ_API_URL` → Change to `NEXT_PUBLIC_AICIN_API_URL`
3. Set value: `https://orchestrator-239116109469.us-west1.run.app`
4. Enable for: Production, Preview, Development
5. Save

---

## Part 2: Code Changes

### **Change 1: Quiz Submission Handler**

**File:** `src/app/quiz/page.tsx` (or wherever quiz submission happens)

#### **Before (AWS Lambda):**

```typescript
const response = await fetch(`${process.env.NEXT_PUBLIC_QUIZ_API_URL}/quiz/score`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    answers: backendAnswers,
  }),
});
```

#### **After (AICIN):**

```typescript
// Option A: Use new environment variable (recommended)
const AICIN_URL = process.env.NEXT_PUBLIC_AICIN_API_URL || 'https://orchestrator-239116109469.us-west1.run.app';

const response = await fetch(`${AICIN_URL}/api/v1/quiz/score`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.aicinToken}`,  // Use AICIN-specific token
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    answers: backendAnswers,
  }),
});

// Option B: Keep backward compatible (fallback to old API if AICIN fails)
const AICIN_URL = process.env.NEXT_PUBLIC_AICIN_API_URL;
const LAMBDA_URL = process.env.NEXT_PUBLIC_QUIZ_API_URL;

try {
  const response = await fetch(`${AICIN_URL}/api/v1/quiz/score`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.aicinToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ answers: backendAnswers }),
  });

  if (!response.ok) {
    throw new Error(`AICIN failed: ${response.status}`);
  }

  return await response.json();

} catch (error) {
  console.error('AICIN failed, trying Lambda fallback:', error);

  // Fallback to AWS Lambda
  const response = await fetch(`${LAMBDA_URL}/quiz/score`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ answers: backendAnswers }),
  });

  return await response.json();
}
```

---

### **Change 2: Results Page Handler**

**File:** `src/app/quiz/results/[submissionId]/page.tsx` (or wherever results are fetched)

#### **Before (AWS Lambda):**

```typescript
const response = await fetch(`${process.env.NEXT_PUBLIC_QUIZ_API_URL}/quiz/results/${submissionId}`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${session.accessToken}`,
  },
});
```

#### **After (AICIN):**

```typescript
const AICIN_URL = process.env.NEXT_PUBLIC_AICIN_API_URL || 'https://orchestrator-239116109469.us-west1.run.app';

const response = await fetch(`${AICIN_URL}/api/v1/quiz/results/${submissionId}`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${session.aicinToken}`,
  },
});

if (!response.ok) {
  throw new Error(`Failed to fetch results: ${response.status}`);
}

const data = await response.json();
```

---

### **Change 3: Error Handling (Optional but Recommended)**

Add better error handling for AICIN responses:

```typescript
async function submitQuizToAICIN(answers: QuizAnswers) {
  const AICIN_URL = process.env.NEXT_PUBLIC_AICIN_API_URL;

  try {
    const response = await fetch(`${AICIN_URL}/api/v1/quiz/score`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getAICINToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ answers }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('AICIN Error:', error);

      // Handle specific error cases
      if (response.status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      } else if (response.status === 500) {
        throw new Error('Our recommendation system is temporarily unavailable. Please try again in a moment.');
      } else {
        throw new Error(`Failed to submit quiz: ${response.status}`);
      }
    }

    const data = await response.json();

    // Log performance metrics (optional)
    console.log(`AICIN processing time: ${data.processingTimeMs}ms`);
    if (data.fromCache) {
      console.log('Results served from cache (instant!)');
    }

    return data;

  } catch (error) {
    console.error('Quiz submission failed:', error);
    throw error;  // Re-throw to let caller handle
  }
}
```

---

### **Change 4: Response Format Handling**

AICIN returns enhanced data. Update your type definitions:

#### **File:** `src/types/quiz.ts` (or similar)

```typescript
// AWS Lambda Response Format (old)
interface LambdaQuizResponse {
  submissionId: number;
  recommendations: Array<{
    pathId: number;
    title: string;
    description: string;
    url: string;
  }>;
}

// AICIN Response Format (new, enhanced)
interface AICINQuizResponse {
  submissionId: number;
  recommendations: Array<{
    pathId: number;
    pathTitle: string;
    pathSlug: string;
    matchScore: number;          // NEW: 0-1 score
    confidence: 'low' | 'medium' | 'high';  // NEW
    matchReasons: Array<{        // NEW: Explainability
      reason: string;
      weight: number;
      category: string;
      evidence?: string;
    }>;
    categoryBreakdown?: {        // NEW: Score breakdown
      contentScore: number;
      metadataScore: number;
      courseScore: number;
    };
  }>;
  processingTimeMs: number;      // NEW: Performance metric
  fromCache: boolean;            // NEW: Cache indicator
}

// Unified response type (backward compatible)
interface QuizResponse extends AICINQuizResponse {
  // All AICIN fields are available
  // Legacy Lambda fields are compatible
}
```

---

### **Change 5: Display Enhancements (Optional)**

Take advantage of AICIN's richer data:

```typescript
// Display match scores
<div className="recommendation-card">
  <h3>{rec.pathTitle}</h3>

  {/* NEW: Show match score */}
  <div className="match-score">
    Match: {(rec.matchScore * 100).toFixed(0)}%
    <span className={`confidence-${rec.confidence}`}>
      {rec.confidence} confidence
    </span>
  </div>

  {/* NEW: Show top 3 reasons */}
  <ul className="match-reasons">
    {rec.matchReasons.slice(0, 3).map((reason, i) => (
      <li key={i}>{reason.reason}</li>
    ))}
  </ul>

  {/* Existing fields */}
  <p>{rec.description}</p>
  <a href={rec.url}>Learn More</a>
</div>
```

**CSS for confidence badges:**

```css
.confidence-high {
  background: #10b981;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}
.confidence-medium {
  background: #f59e0b;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}
.confidence-low {
  background: #ef4444;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.match-reasons {
  margin-top: 8px;
  font-size: 14px;
  color: #6b7280;
}
```

---

## Part 3: Testing Checklist

### **Local Testing:**

1. **Start development server:**
   ```bash
   cd /path/to/learningai365/frontend
   npm run dev
   ```

2. **Test quiz submission:**
   - Navigate to http://localhost:3000/quiz
   - Fill out quiz
   - Submit
   - Verify response time < 3 seconds
   - Check browser console for errors

3. **Test results page:**
   - After quiz submission, navigate to results
   - Verify recommendations load
   - Check match scores display correctly

### **Staging Testing:**

1. **Deploy to Vercel preview:**
   ```bash
   git checkout -b aicin-integration
   git add .
   git commit -m "Integrate AICIN multi-agent system"
   vercel  # Deploy to preview
   ```

2. **Test on preview URL:**
   - Complete full quiz flow
   - Test with multiple personas
   - Verify no console errors
   - Check mobile responsiveness

3. **Performance validation:**
   - Open DevTools → Network tab
   - Submit quiz
   - Verify response time < 3 seconds
   - Check for any failed requests

---

## Part 4: Rollback Plan

If AICIN fails in production, you can quickly rollback:

### **Option A: Environment Variable Revert (5 minutes)**

```bash
# Revert to AWS Lambda
vercel env rm NEXT_PUBLIC_AICIN_API_URL production
echo "https://9ho7j9p1m3.execute-api.us-west-2.amazonaws.com" | \
  vercel env add NEXT_PUBLIC_QUIZ_API_URL production

# Trigger redeploy
vercel --prod --force
```

### **Option B: Git Revert (2 minutes)**

```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Vercel will auto-deploy
```

### **Option C: Vercel Dashboard Rollback (30 seconds)**

1. Go to Vercel Dashboard → Deployments
2. Find last known good deployment
3. Click "Promote to Production"

---

## Part 5: Production Deployment

### **Step-by-Step:**

1. **Merge changes to main:**
   ```bash
   git checkout main
   git merge aicin-integration
   git push origin main
   ```

2. **Vercel auto-deploys:**
   - Vercel detects push to main
   - Builds and deploys automatically
   - Watch deployment status in dashboard

3. **Monitor for 1 hour:**
   - Check Vercel logs for errors
   - Monitor AICIN orchestrator logs (GCP Console)
   - Watch for user complaints

4. **Verify metrics:**
   - Average response time < 3s
   - Error rate < 1%
   - User satisfaction maintained

---

## Summary Checklist

**Before Production Cutover:**

- [ ] Environment variables updated in `.env.local`, `.env.production`, Vercel
- [ ] Quiz submission handler updated to use `/api/v1/quiz/score`
- [ ] Results page handler updated to use `/api/v1/quiz/results/:id`
- [ ] Error handling added for 401/500 responses
- [ ] Type definitions updated for AICIN response format
- [ ] Tested locally with demo JWT token
- [ ] Tested in staging/preview environment
- [ ] Rollback plan documented and ready
- [ ] Team notified of cutover schedule

**After Production Cutover:**

- [ ] Verify quiz submissions working
- [ ] Check response times < 3s
- [ ] Monitor error rates
- [ ] Watch for user complaints
- [ ] Declare success or rollback after 1 hour

---

**Contact:** sgharlow@gmail.com
**AICIN GitHub:** https://github.com/sgharlow/AICIN
**AICIN Orchestrator:** https://orchestrator-239116109469.us-west1.run.app
