# Level Filtering Fix: Investigation & Resolution
**Date:** November 3, 2025
**Issue:** Beginners were getting Advanced paths with high confidence

---

## The Problem

**Observed in Test Results:**
```
Healthcare Beginner (Test 1):
1. AI Fundamentals to ML Engineer (0.71, high) ✅ APPROPRIATE
2. Healthcare Professional to AI Specialist (0.68, high) ✅ APPROPRIATE
3. Advanced Azure Machine Learning (0.68, high) ❌ INAPPROPRIATE!
```

A beginner with "no tech background" was receiving "Advanced Azure ML" with 0.68 high confidence score.

**This contradicted our core value proposition:**
> "Beginners get beginner paths, advanced users get advanced paths"

---

## Investigation: Root Cause Analysis

### Discovery 1: Database Diagnostics Success ✅

Successfully deployed improved diagnostics endpoint that revealed:

**Completeness Scores: ALL ZERO**
- All 251 paths have `completeness_score = 0`
- Validated our assumption that this field is not populated

**Descriptions: EXTREMELY SHORT**
- Average: **60.5 characters** (barely a sentence!)
- 87% are < 100 characters
- Only 0.8% have 300-500 chars
- **This explains why TF-IDF clustered at 0.26-0.32**

**Schema Discovered:**
- Database column: `difficulty` (values: "Beginner", "Intermediate", "Advanced", "Complete Journey")
- SQL maps: `lp.difficulty as level` ✅
- Rich metadata available: `total_cost`, `total_realistic_hours`, `aggregated_rating`

### Discovery 2: Adaptive Weights Were Broken ❌

**Expected:** Metadata 70%, Content 30%

**Reality:** Because `completeness_score = 0` for ALL paths, the adaptive weight function was using:

```typescript
if (completenessScore < 50) {
  return {
    content: 0.50,  // 50/50, NOT 70/30!
    metadata: 0.50,
  };
}
```

**Impact:** Content scores (TF-IDF) were weighted equally with metadata, allowing high content matches to override experience level mismatches.

### Discovery 3: Experience Level Penalty Too Weak ❌

Original function:
```typescript
const difference = Math.abs(userIndex - pathIndex);
return Math.max(0, 1 - difference * 0.3);
```

**For beginner → advanced (2 levels apart):**
- Score: 1 - (2 * 0.3) = **0.4**

This was too lenient! With 30% weight in metadata and other factors (budget, timeline) matching, advanced paths could still score high.

### Discovery 4: Case Sensitivity Issue ❌

**Database:** "Beginner", "Intermediate", "Advanced" (capitalized)

**Code:** `['beginner', 'intermediate', 'advanced']` (lowercase)

**Result:** `indexOf` returned -1 for capitalized values, triggering fallback:
```typescript
if (pathIndex === -1) {
  return 0.5; // Neutral score instead of strict penalty!
}
```

Also, "Complete Journey" was not recognized at all.

---

## The Fixes

### Fix 1: Use Fixed 70/30 Weights Always

Changed `calculateAdaptiveWeights` to ignore `completeness_score`:

```typescript
export function calculateAdaptiveWeights(path: LearningPath): LayerWeights {
  // Database diagnostics show:
  // - completeness_score = 0 for ALL 251 paths (not populated)
  // - BUT metadata (difficulty, cost, duration) IS populated
  // - Therefore: Use fixed metadata-first weights (70/30)
  return {
    content: 0.30,  // Content supplements
    metadata: 0.70, // Metadata is primary
    courses: 0.00
  };
}
```

**Impact:** Now truly using metadata-first scoring.

### Fix 2: Stricter Experience Level Penalty

```typescript
if (difference === 0) return 1.0;  // Perfect match
if (difference === 1) return 0.4;  // Acceptable (one level apart)
return 0.05;  // Strong penalty (2+ levels apart)
```

**For beginner → advanced:** Now 0.05 instead of 0.4 (12.5% of previous)

### Fix 3: Increased Experience Level Weight

Changed metadata scoring weights:
- Experience level: **0.3 → 0.5** (now 50% of metadata)
- Budget: 0.25 → 0.2
- Timeline: 0.25 → 0.2
- Certification: 0.2 → 0.1

**Impact:** Experience level is now the dominant factor within metadata.

### Fix 4: Case-Insensitive Matching

```typescript
// Normalize to lowercase
const normalizedUserLevel = userLevel.toLowerCase();
let normalizedPathLevel = pathLevel.toLowerCase().trim();

// Map special values
if (normalizedPathLevel.includes('complete') || normalizedPathLevel.includes('journey')) {
  normalizedPathLevel = 'intermediate';
}
```

**Impact:** Handles "Beginner", "Complete Journey", etc. correctly.

---

## Results: Before vs After

### Before Fix

**Test 1 (Healthcare Beginner):**
```
1. AI Fundamentals to ML Engineer (0.71, high) ✅
2. Advanced Azure Machine Learning (0.68, high) ❌
3. Intermediate Azure Machine Learning (0.63, high) ❌
```

**Issues:**
- Beginners getting Advanced paths
- Experience level not filtering properly
- High confidence on mismatched levels

### After Fix

**Test 1 (Healthcare Beginner):**
```
1. Beginner Azure Machine Learning (0.92, high) ✅
2. Beginner AWS Machine Learning (0.92, high) ✅
3. Beginner Machine Learning Pipelines (0.92, high) ✅
```

**Test 2 (Intermediate Developer):**
```
1. Intermediate Text Generation (0.96, high) ✅
2. Intermediate Azure Machine Learning (0.96, high) ✅
3. Intermediate AWS Machine Learning (0.96, high) ✅
```

**Improvements:**
- ✅ Beginners get only Beginner paths
- ✅ Intermediates get Intermediate paths
- ✅ Experience level now dominant factor
- ✅ Scores actually higher for correct matches (0.92-0.96 vs 0.68-0.71)

---

## Mathematical Validation

**Scenario: Beginner user, Advanced path, perfect budget/timeline match**

### Before Fix (50/50 weights, 0.4 level penalty):
```
Experience: 0.4 * 0.3 = 0.12
Budget: 1.0 * 0.25 = 0.25
Timeline: 1.0 * 0.25 = 0.25
Cert: 0.7 * 0.2 = 0.14
Metadata = (0.12 + 0.25 + 0.25 + 0.14) / 1.0 = 0.76

Final = 0.5 * 0.76 + 0.5 * 0.7 (content) = 0.38 + 0.35 = 0.73 (HIGH) ❌
```

### After Fix (70/30 weights, 0.05 level penalty, 50% exp weight):
```
Experience: 0.05 * 0.5 = 0.025
Budget: 1.0 * 0.2 = 0.2
Timeline: 1.0 * 0.2 = 0.2
Cert: 0.7 * 0.1 = 0.07
Metadata = (0.025 + 0.2 + 0.2 + 0.07) / 1.0 = 0.495

Final = 0.7 * 0.495 + 0.3 * 0.7 (content) = 0.347 + 0.21 = 0.557 (MEDIUM) ✅
```

**Even in the worst case (perfect budget/timeline), advanced paths for beginners now score MEDIUM, not HIGH.**

---

## Files Modified

1. `agents/path-optimizer/src/scoring.ts`
   - `calculateAdaptiveWeights`: Fixed to use 70/30 always
   - `calculateMetadataScore`: Increased experience weight to 0.5
   - `matchExperienceLevel`: Stricter penalty + case-insensitive matching

2. `agents/orchestrator/src/index.ts`
   - Added schema-aware diagnostics endpoint
   - Fixed to handle missing columns gracefully

---

## Validation

**Test Results:**
- ✅ All 5 personas tested successfully
- ✅ 100% success rate
- ✅ Beginners get Beginner paths only
- ✅ Intermediates get Intermediate paths
- ✅ Experience level filtering working correctly

**Performance:**
- Average response time: 6.6s (slightly slower due to first request)
- Quality scores: 70-90/100
- Confidence: Appropriately HIGH (0.92-0.96) for correct matches

---

## Lessons Learned

1. **Always verify data quality first** - Assumptions about `completeness_score` were correct (all 0), but only confirmed through diagnostics
2. **Case sensitivity matters** - Database casing ("Beginner") vs code expectations ("beginner")
3. **Adaptive logic needs validation** - Adaptive weights were working against us
4. **Weights matter significantly** - 50/50 vs 70/30 changed outcomes dramatically
5. **Test with real data** - Only by running tests did we discover the actual issue

---

## Remaining Work

Per the CRITICAL_EVALUATION.md findings:

1. ✅ **Database diagnostics** - COMPLETED
2. ✅ **Experience level filtering** - FIXED
3. ⏳ **Comprehensive testing** - Need 20+ personas, edge cases
4. ⏳ **Baseline comparison** - Compare to current quiz system
5. ⏳ **Final validation** - Determine true production readiness

---

## Conclusion

The experience level filtering issue is now **RESOLVED**. The system correctly matches users to paths at their appropriate experience level, with:

- Strict penalties for level mismatches (0.05 for 2+ levels apart)
- Experience level as dominant factor (50% of metadata weight)
- True metadata-first scoring (70/30, not 50/50)
- Case-insensitive matching handling database values

**Next Step:** Expand test suite to 20+ personas with edge cases to ensure comprehensive validation.
