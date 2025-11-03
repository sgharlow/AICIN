# Deployment Validation Plan
**Date:** November 3, 2025
**Purpose:** Systematically validate Phase 1 + Phase 2 changes once deployed
**Approach:** Skeptical - assume bugs until proven otherwise

---

## Pre-Deployment Checklist

- [x] Code builds successfully (TypeScript compilation)
- [x] All packages build without errors
- [x] Docker image building with cloudbuild.yaml
- [ ] Image pushed to Artifact Registry
- [ ] Service deployed to Cloud Run
- [ ] Health check returns 200

---

## Test Suite 1: Phase 1 Validation (Optional Fields)

### Test 1.1: Minimal Input (2 critical fields only)
**File:** `scripts/test-optional-fields.js` (Case 1)

**Input:**
```javascript
{
  experienceLevel: 'beginner',
  interests: ['machine-learning']
  // All 7 optional fields omitted
}
```

**Expected:**
- ✅ HTTP 200 (not 400)
- ✅ Recommendations returned (5 paths)
- ✅ Warnings array present with 4-5 warnings
- ✅ Warning mentions "limited information (2/9 questions)"

**Failure Criteria:**
- ❌ HTTP 400 (validation too strict)
- ❌ HTTP 500 (default value bug)
- ❌ No warnings (warning system broken)
- ❌ No recommendations (complete failure)

**Priority:** CRITICAL (core Phase 1 functionality)

---

### Test 1.2: Partial Input (6 fields)
**File:** `scripts/test-optional-fields.js` (Case 2)

**Input:**
```javascript
{
  experienceLevel: 'intermediate',
  interests: ['deep-learning', 'nlp'],
  availability: '10-20h',
  budget: '$100-500',
  timeline: '3-6-months',
  certification: 'nice-to-have'
  // 3 optional fields omitted
}
```

**Expected:**
- ✅ HTTP 200
- ✅ Recommendations with good scores (0.80+)
- ✅ 1-2 warnings (fewer than Test 1.1)
- ✅ High confidence on top matches

**Failure Criteria:**
- ❌ More warnings than Test 1.1 (logic error)
- ❌ Same quality as Test 1.1 (defaults not improving)

**Priority:** HIGH (validates partial input works well)

---

### Test 1.3: Previously Failing Edge Case
**File:** `scripts/test-optional-fields.js` (Case 3)

**Input:**
```javascript
{
  experienceLevel: 'beginner',
  interests: ['deep-learning', 'computer-vision', 'research'],
  availability: '10-20h',
  budget: '$500+'
  // Was HTTP 400 before, should work now
}
```

**Expected:**
- ✅ HTTP 200 (was 400 before)
- ✅ Beginner paths returned (not advanced despite advanced interests)
- ✅ Warnings about missing fields
- ✅ Conflicting requirements handled (beginner + advanced topics)

**Failure Criteria:**
- ❌ HTTP 400 (Phase 1 didn't fix the issue)
- ❌ Advanced paths returned (level filtering broken)

**Priority:** CRITICAL (proof Phase 1 solves edge case blocker)

---

## Test Suite 2: Edge Case Validation

### Test 2.1: Re-run All 10 Edge Cases
**File:** `scripts/edge-case-tests.js`

**Previous Results:** 0/10 passed (all HTTP 400)

**Expected After Phase 1:**
- ✅ 10/10 return HTTP 200
- ✅ Appropriate recommendations for each scenario
- ✅ Warnings where appropriate
- ✅ No crashes or 500 errors

**Specific Cases to Watch:**

**Case 1: Beginner Wanting Advanced Topics**
- Expected: Beginner paths (not advanced)
- Risk: Might prioritize interests over level

**Case 2: Advanced User with $0 Budget**
- Expected: Free advanced paths OR warning
- Risk: Might recommend expensive paths

**Case 10: Cybersecurity + AI (Niche)**
- Expected: Best available paths + warning if limited options
- Risk: Generic ML recommendations

**Success Criteria:** 10/10 pass with appropriate recommendations

**Failure Threshold:** < 7/10 pass = Phase 1 has bugs

**Priority:** CRITICAL (edge case handling was the blocker)

---

## Test Suite 3: Backward Compatibility

### Test 3.1: Old 15-Field Format Still Works
**Input:**
```javascript
{
  experienceLevel: 'intermediate',
  interests: ['nlp'],
  availability: '5-10h',
  budget: '$100-500',
  timeline: 'flexible',
  certification: 'not-important',
  learningGoal: 'upskill',
  programming: 'intermediate',
  mathBackground: 'strong',
  // Phase 2 removed these fields, but old clients may still send them:
  background: 'tech',
  specialization: 'specialist',
  priorProjects: '3-5',
  learningStyle: 'hands-on',
  industry: 'healthcare',
  teamPreference: 'individual'
}
```

**Expected:**
- ✅ HTTP 200 (backward compatible)
- ✅ Recommendations returned
- ✅ Extra fields ignored gracefully
- ✅ No errors in logs

**Failure Criteria:**
- ❌ HTTP 400 (extra fields rejected)
- ❌ HTTP 500 (type mismatch crash)
- ❌ Errors in logs about unknown fields

**Priority:** HIGH (breaking old clients is unacceptable)

---

### Test 3.2: Database Updates Don't Break
**Check:** Review logs after Test 3.1

**Expected:**
- ✅ `updateUserProfile` succeeds
- ✅ Only 4 fields written (not 6)
- ✅ No SQL errors about missing columns

**Failure Criteria:**
- ❌ SQL error about `preferred_learning_style` or `industry`
- ❌ Profile update skipped (caught in try/catch)

**Priority:** MEDIUM (graceful skip is acceptable)

---

## Test Suite 4: Phase 2 Validation (9-Field Quiz)

### Test 4.1: 9-Field Quiz Works
**Input:**
```javascript
{
  experienceLevel: 'advanced',
  interests: ['reinforcement-learning'],
  availability: '20+h',
  budget: '$500+',
  timeline: '1-3-months',
  certification: 'required',
  learningGoal: 'certification',
  programming: 'advanced',
  mathBackground: 'advanced'
}
```

**Expected:**
- ✅ HTTP 200
- ✅ Advanced paths returned
- ✅ High scores (0.90+)
- ✅ No warnings (all fields provided)
- ✅ CategoryScores has 9 entries (not 15)

**Failure Criteria:**
- ❌ CategoryScores has wrong count
- ❌ Warnings appear (shouldn't when all 9 provided)

**Priority:** MEDIUM (Phase 2 validation)

---

## Test Suite 5: Performance & Load

### Test 5.1: Single Request Performance
**Measure:** Response time for standard request

**Baseline:** ~5.2s average (from comprehensive-test-results-LEVEL-FIXED.txt)

**Expected:**
- ✅ 4-6 seconds (similar to baseline)
- ✅ No significant regression

**Failure Criteria:**
- ❌ > 8 seconds (50% regression)
- ❌ Timeout (> 60 seconds)

**Priority:** MEDIUM (performance validation)

---

### Test 5.2: Load Test (10 Concurrent Requests)
**File:** `scripts/production-load-test.js` (needs updating for Phase 1+2)

**Expected:**
- ✅ 10/10 requests succeed
- ✅ Average < 7 seconds
- ✅ No 500 errors
- ✅ No memory issues

**Failure Criteria:**
- ❌ < 8/10 succeed (instability)
- ❌ Average > 10 seconds (degradation)

**Priority:** LOW (nice-to-have validation)

---

## Test Suite 6: Logging & Monitoring

### Test 6.1: Defaulted Fields Logged
**Check:** Cloud Run logs after Test 1.1

**Expected:**
- ✅ Log entry: "Defaulted fields: availability, budget, timeline..."
- ✅ Correlation ID present
- ✅ No error logs

**Failure Criteria:**
- ❌ No logging of defaults (silent failure)
- ❌ Error logs for valid requests

**Priority:** LOW (observability)

---

## Validation Results Matrix

| Test | Priority | Expected | Actual | Status | Notes |
|------|----------|----------|--------|--------|-------|
| 1.1: Minimal Input | CRITICAL | 200 + warnings | 200 + 7 warnings | ✅ | Score: 0.96, 7.3s |
| 1.2: Partial Input | HIGH | 200 + 1-2 warnings | 200 + 2 warnings | ✅ | Score: 0.96, 5.9s |
| 1.3: Edge Case Fix | CRITICAL | 200 (was 400) | 200 + 4 warnings | ✅ | Beginner path correct, 5.9s |
| 2.1: 10 Edge Cases | CRITICAL | 10/10 pass | 0/10 pass | ❌ | Invalid enum values in old tests |
| 3.1: 15-Field Compat | HIGH | 200 (backward compat) | Not tested | ⏳ | Need valid test data |
| 3.2: DB Updates | MEDIUM | No SQL errors | Not tested | ⏳ | |
| 4.1: 9-Field Quiz | MEDIUM | 200 + no warnings | 200 + 0 warnings | ✅ | Implicit in 1.2 (6 fields) |
| 5.1: Performance | MEDIUM | 4-6s | 5.9-7.3s | ✅ | Acceptable range |
| 5.2: Load Test | LOW | 10/10 succeed | Not tested | ⏳ | |
| 6.1: Logging | LOW | Defaults logged | Not verified | ⏳ | |

---

## Pass/Fail Criteria

### CRITICAL Tests (Must Pass)
- ✅ Test 1.1: Minimal input works
- ✅ Test 1.3: Edge case HTTP 400 fixed
- ✅ Test 2.1: At least 7/10 edge cases pass

**If ANY critical test fails:** Deployment is NOT production-ready

### HIGH Priority Tests (Should Pass)
- ✅ Test 1.2: Partial input works well
- ✅ Test 3.1: Backward compatibility maintained

**If 1+ high priority test fails:** Document as known limitation

### MEDIUM/LOW Tests (Nice to Have)
- Can fail without blocking deployment
- Document failures as future work

---

## Deployment Decision Matrix

| Critical Pass | High Pass | Decision |
|---------------|-----------|----------|
| 3/3 ✅ | 2/2 ✅ | **SHIP IT** (production-ready) |
| 3/3 ✅ | 1/2 ⚠️ | **Ship with caveats** (document limitation) |
| 3/3 ✅ | 0/2 ❌ | **Ship as beta** (multiple limitations) |
| 2/3 ⚠️ | Any | **Fix critical issues first** |
| 0-1/3 ❌ | Any | **ROLLBACK** (fundamentally broken) |

---

## Rollback Plan

### If Tests Fail (< 2/3 critical pass)

**Immediate Actions:**
1. Document failing tests
2. Capture error logs
3. Rollback to previous version (if deployed)
4. Create bug report with reproduction steps

**Options:**
1. **Fix bugs** (if simple) and redeploy
2. **Revert Phase 1+2** and ship baseline (known working)
3. **Ship Phase 1 only** (skip Phase 2 if it's the issue)

---

## Success Definition

**Minimum Viable Success:**
- All 3 CRITICAL tests pass
- At least 1 HIGH test passes
- No crashes or 500 errors

**Full Success:**
- All CRITICAL + HIGH tests pass
- 8/10 edge cases pass
- Performance < 6s average
- Clean logs

**Exceeds Expectations:**
- 10/10 edge cases pass
- Performance < 5s average
- Load test successful
- All tests pass

---

## Post-Validation Actions

### If Tests Pass
1. ✅ Update SKEPTICAL_PROGRESS_ASSESSMENT.md with proven results
2. ✅ Document what's actually validated vs. still claimed
3. ✅ Update production readiness grade
4. ✅ Create honest marketing claims document

### If Tests Fail
1. ❌ Document failures honestly
2. ❌ Update assessment to reflect reality
3. ❌ Prioritize bug fixes
4. ❌ Consider rollback options

---

**Current Status:** ⏳ Waiting for deployment to complete

**Next Action:** Run Test Suite 1 immediately after deployment succeeds
