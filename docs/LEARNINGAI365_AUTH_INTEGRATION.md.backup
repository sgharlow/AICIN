# LearningAI365 Authentication Integration Guide

**Purpose:** Integrate learningai365.com's existing authentication system with AICIN's JWT requirements.

**Date:** November 6, 2025
**Status:** Required for production cutover

---

## Overview

AICIN expects JWT Bearer tokens in the `Authorization` header. Your learningai365.com backend needs to generate JWT tokens that AICIN can validate.

---

## Required JWT Format

### **Token Structure:**

```javascript
{
  "userId": 12345,  // REQUIRED: User's unique ID
  "iat": 1762496326  // Issued at timestamp (auto-generated)
}
```

### **JWT Configuration:**

- **Algorithm:** HS256
- **Secret:** `tgJoQnBPwHxccxWwYdx15g==` (must match AICIN's `.env` JWT_SECRET)
- **Header:** `Authorization: Bearer <token>`

---

## Implementation Steps

### **Step 1: Install JWT Library (if not already installed)**

```bash
npm install jsonwebtoken
```

### **Step 2: Add JWT Generation to Your Auth Middleware**

**Location:** Your learningai365.com backend authentication layer

```javascript
const jwt = require('jsonwebtoken');

// MUST match AICIN's secret from .env
const JWT_SECRET = 'tgJoQnBPwHxccxWwYdx15g==';

// In your login/session handler:
function generateAICINToken(user) {
  const token = jwt.sign(
    {
      userId: user.id  // AICIN expects this exact claim name
    },
    JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: '24h'  // Optional: token expiration
    }
  );

  return token;
}

// Example usage in login handler:
app.post('/api/auth/login', async (req, res) => {
  const user = await authenticateUser(req.body);

  if (user) {
    // Generate AICIN-compatible JWT
    const aicinToken = generateAICINToken(user);

    // Store in session or return to client
    res.json({
      success: true,
      user: user,
      aicinToken: aicinToken  // Frontend will use this for AICIN API calls
    });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});
```

### **Step 3: Update Frontend to Use AICIN Token**

**File:** Your learningai365.com frontend (likely Next.js)

```javascript
// When making AICIN API calls:
async function submitQuiz(answers) {
  // Get AICIN token from session/state
  const aicinToken = getAICINTokenFromSession();

  const response = await fetch('https://orchestrator-239116109469.us-west1.run.app/api/v1/quiz/score', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${aicinToken}`,  // CRITICAL: Include Bearer token
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ answers })
  });

  if (!response.ok) {
    throw new Error(`Quiz submission failed: ${response.status}`);
  }

  return await response.json();
}
```

---

## Testing Your Integration

### **Test 1: Generate Token Manually**

```javascript
const jwt = require('jsonwebtoken');
const JWT_SECRET = 'tgJoQnBPwHxccxWwYdx15g==';

// Test token for user ID 123
const testToken = jwt.sign({ userId: 123 }, JWT_SECRET, { algorithm: 'HS256' });
console.log('Test Token:', testToken);
```

### **Test 2: Validate Token Works with AICIN**

```bash
# Replace TEST_TOKEN with the token generated above
curl -X POST https://orchestrator-239116109469.us-west1.run.app/api/v1/quiz/score \
  -H "Authorization: Bearer TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "answers": {
      "learningGoal": "career-switch",
      "experienceLevel": "beginner",
      "interests": ["machine-learning"],
      "availability": "5-10h",
      "budget": "$0-100",
      "learningStyle": "hands-on",
      "industry": "healthcare",
      "background": "non-tech",
      "programming": "beginner",
      "specialization": "generalist",
      "certification": "required",
      "timeline": "6-12-months",
      "priorProjects": "0",
      "mathBackground": "basic",
      "teamPreference": "solo"
    }
  }'

# Should return 200 OK with recommendations
```

### **Test 3: Check Token Expiration**

```javascript
// Verify token hasn't expired
const jwt = require('jsonwebtoken');
const JWT_SECRET = 'tgJoQnBPwHxccxWwYdx15g==';

try {
  const decoded = jwt.verify(yourToken, JWT_SECRET);
  console.log('Token valid for user:', decoded.userId);
} catch (error) {
  console.error('Token invalid:', error.message);
}
```

---

## Security Considerations

### **⚠️ CRITICAL: Keep JWT_SECRET Secure**

- **DO NOT** commit `JWT_SECRET` to version control
- Store in environment variables (`.env` file)
- Use the same secret across learningai365.com and AICIN
- If secret is compromised, regenerate and redeploy both systems

### **Recommended: Use Environment Variables**

```javascript
// In learningai365.com backend:
const JWT_SECRET = process.env.AICIN_JWT_SECRET || 'tgJoQnBPwHxccxWwYdx15g==';

// In .env file:
AICIN_JWT_SECRET=tgJoQnBPwHxccxWwYdx15g==
```

### **Token Expiration**

- Recommend: 24-hour expiration for quiz tokens
- Longer expiration = convenience, but security risk if token is stolen
- Shorter expiration = more secure, but users may need to re-login mid-quiz

---

## Troubleshooting

### **Error: 401 Unauthorized**

**Causes:**
1. JWT secret mismatch (learningai365.com using different secret than AICIN)
2. Token not included in `Authorization` header
3. Missing `Bearer` prefix
4. Token expired

**Solution:**
```bash
# Verify token format:
curl -X POST https://orchestrator-239116109469.us-west1.run.app/api/v1/quiz/score \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -v  # Verbose mode shows auth headers
```

### **Error: 500 Internal Server Error**

**Causes:**
1. Invalid `userId` claim (not a number)
2. Malformed JWT structure

**Solution:**
```javascript
// Ensure userId is an integer
const token = jwt.sign({ userId: parseInt(user.id) }, JWT_SECRET, { algorithm: 'HS256' });
```

---

## Environment Variables Summary

### **learningai365.com Backend:**

```bash
# Add to .env file:
AICIN_JWT_SECRET=tgJoQnBPwHxccxWwYdx15g==
AICIN_API_URL=https://orchestrator-239116109469.us-west1.run.app
```

### **learningai365.com Frontend:**

```bash
# Add to .env.production:
NEXT_PUBLIC_AICIN_API_URL=https://orchestrator-239116109469.us-west1.run.app
```

---

## Checklist

**Before production cutover:**

- [ ] JWT generation added to learningai365.com backend
- [ ] JWT secret matches AICIN's secret (`tgJoQnBPwHxccxWwYdx15g==`)
- [ ] Frontend updated to include `Authorization: Bearer <token>` header
- [ ] Test token generation working
- [ ] Test AICIN API call with real token succeeds
- [ ] Token expiration configured (recommend 24h)
- [ ] Error handling added for 401/500 responses

---

## Next Steps

1. **Implement auth integration** in learningai365.com (30 minutes)
2. **Test in staging environment** (30 minutes)
3. **Deploy to production** with monitoring

---

**Contact:** sgharlow@gmail.com
**AICIN Orchestrator:** https://orchestrator-239116109469.us-west1.run.app
**GitHub:** https://github.com/sgharlow/AICIN
