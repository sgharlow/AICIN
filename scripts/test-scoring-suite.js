/**
 * Automated Test Suite for Scoring Logic
 * Run: node test-scoring-suite.js
 */

const assert = require('assert');

// Import scoring functions (copy from local-scorer.ts for testing)
function matchExperienceLevel(userLevel, pathLevel) {
  const levelOrder = ['beginner', 'intermediate', 'advanced', 'expert'];
  const userIndex = levelOrder.indexOf(userLevel.toLowerCase());
  const pathIndex = levelOrder.indexOf(pathLevel.toLowerCase());

  if (userIndex === -1 || pathIndex === -1) return 0.5;

  const difference = Math.abs(userIndex - pathIndex);
  if (difference === 0) return 1.0;
  if (difference === 1) return 0.4;
  return 0.05;
}

function matchInterests(interests, path) {
  if (!interests || interests.length === 0) return 0.5;

  const normalize = (text) => text.toLowerCase().replace(/-/g, ' ');

  const pathTitle = normalize(path.title || '');
  const pathDescription = normalize(path.description || '');
  const pathSummary = normalize(path.summary || '');

  let matchCount = 0;

  for (const interest of interests) {
    const normalizedInterest = normalize(interest);

    if (pathTitle.includes(normalizedInterest)) {
      matchCount += 1.0;
    }
    else if (pathSummary.includes(normalizedInterest)) {
      matchCount += 0.8;
    }
    else if (pathDescription.includes(normalizedInterest)) {
      matchCount += 0.6;
    }
  }

  return Math.min(matchCount / interests.length, 1.0);
}

function matchBudget(userBudget, pathCost) {
  // Handle NULL costs - assume match for demo purposes
  if (pathCost === null || pathCost === undefined) return 1.0;
  if (pathCost <= userBudget) return 1.0;
  return Math.max(0, 1 - (pathCost - userBudget) / userBudget);
}

// Test suite
const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

function runTests() {
  console.log('Running Automated Test Suite...\n');
  console.log('='.repeat(80));

  tests.forEach(({ name, fn }) => {
    try {
      fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (error) {
      console.log(`❌ FAIL: ${name}`);
      console.log(`   ${error.message}`);
      failed++;
    }
  });

  console.log('='.repeat(80));
  console.log(`\nResults: ${passed} passed, ${failed} failed, ${tests.length} total`);

  if (failed > 0) {
    process.exit(1);
  }
}

// ============================================================================
// Experience Level Tests
// ============================================================================

test('Experience: Perfect match (intermediate-intermediate)', () => {
  const score = matchExperienceLevel('intermediate', 'Intermediate');
  assert.strictEqual(score, 1.0, 'Should return 1.0 for perfect match');
});

test('Experience: Case insensitive matching', () => {
  const score = matchExperienceLevel('beginner', 'BEGINNER');
  assert.strictEqual(score, 1.0, 'Should handle case differences');
});

test('Experience: One level apart (intermediate-beginner)', () => {
  const score = matchExperienceLevel('intermediate', 'beginner');
  assert.strictEqual(score, 0.4, 'Should return 0.4 for adjacent levels');
});

test('Experience: Two levels apart (beginner-advanced)', () => {
  const score = matchExperienceLevel('beginner', 'advanced');
  assert.strictEqual(score, 0.05, 'Should return 0.05 for 2+ level gap');
});

test('Experience: Unknown level handling', () => {
  const score = matchExperienceLevel('intermediate', 'unknown');
  assert.strictEqual(score, 0.5, 'Should return 0.5 for unknown levels');
});

// ============================================================================
// Interest Matching Tests
// ============================================================================

test('Interest: Exact title match with hyphen', () => {
  const path = { title: 'Computer Vision Fundamentals', description: '' };
  const score = matchInterests(['computer-vision'], path);
  assert.strictEqual(score, 1.0, 'Should match despite hyphen difference');
});

test('Interest: Title match normalizes spaces and hyphens', () => {
  const path = { title: 'Natural-Language-Processing', description: '' };
  const score = matchInterests(['natural language processing'], path);
  assert.strictEqual(score, 1.0, 'Should normalize hyphens to spaces');
});

test('Interest: Description match (weaker than title)', () => {
  const path = {
    title: 'AI Course',
    description: 'Learn computer vision techniques',
    summary: ''
  };
  const score = matchInterests(['computer-vision'], path);
  assert.strictEqual(score, 0.6, 'Description match should score 0.6');
});

test('Interest: Summary match (stronger than description)', () => {
  const path = {
    title: 'AI Course',
    description: 'General AI',
    summary: 'Computer vision and deep learning'
  };
  const score = matchInterests(['computer-vision'], path);
  assert.strictEqual(score, 0.8, 'Summary match should score 0.8');
});

test('Interest: No match', () => {
  const path = { title: 'Python Basics', description: 'Learn Python' };
  const score = matchInterests(['computer-vision'], path);
  assert.strictEqual(score, 0, 'No match should return 0');
});

test('Interest: Multiple interests - partial match', () => {
  const path = { title: 'Computer Vision Course', description: '' };
  const score = matchInterests(['computer-vision', 'nlp'], path);
  assert.strictEqual(score, 0.5, 'Should average: (1.0 + 0) / 2');
});

test('Interest: Multiple interests - full match', () => {
  const path = {
    title: 'Computer Vision and NLP',
    description: 'Natural language processing and computer vision'
  };
  const score = matchInterests(['computer-vision', 'nlp'], path);
  assert.strictEqual(score, 1.0, 'Both interests match');
});

test('Interest: Empty interests array', () => {
  const path = { title: 'Any Course', description: '' };
  const score = matchInterests([], path);
  assert.strictEqual(score, 0.5, 'Empty interests should return neutral 0.5');
});

// ============================================================================
// Budget Matching Tests
// ============================================================================

test('Budget: NULL cost (missing data)', () => {
  const score = matchBudget(500, null);
  assert.strictEqual(score, 1.0, 'NULL cost should match (assume free/unknown)');
});

test('Budget: Cost within budget', () => {
  const score = matchBudget(500, 300);
  assert.strictEqual(score, 1.0, 'Cost within budget should return 1.0');
});

test('Budget: Cost over budget', () => {
  const score = matchBudget(500, 1000);
  assert.strictEqual(score, 0, 'Cost 100% over budget should return 0');
});

test('Budget: Cost slightly over budget', () => {
  const score = matchBudget(500, 600);
  assert.ok(score < 1.0 && score > 0, 'Slightly over should return partial match');
});

// ============================================================================
// Integration Tests
// ============================================================================

test('Integration: Perfect match on all factors', () => {
  const path = {
    title: 'Intermediate Computer Vision',
    description: 'Learn computer vision',
    level: 'Intermediate',
    total_cost: 100,
    summary: ''
  };

  const expScore = matchExperienceLevel('intermediate', path.level);
  const intScore = matchInterests(['computer-vision'], path);
  const budScore = matchBudget(500, path.total_cost);

  assert.strictEqual(expScore, 1.0, 'Experience should match perfectly');
  assert.strictEqual(intScore, 1.0, 'Interest should match perfectly');
  assert.strictEqual(budScore, 1.0, 'Budget should match perfectly');

  // Calculate total (simplified weights)
  const total = (expScore * 0.25) + (intScore * 0.35) + (budScore * 0.08);
  assert.ok(total > 0.65, 'Total score should be high');
});

test('Integration: Partial match', () => {
  const path = {
    title: 'Beginner Machine Learning',
    description: 'Learn ML fundamentals',
    level: 'Beginner',
    total_cost: null,
    summary: ''
  };

  const expScore = matchExperienceLevel('intermediate', path.level);
  const intScore = matchInterests(['computer-vision'], path);
  const budScore = matchBudget(500, path.total_cost);

  assert.strictEqual(expScore, 0.4, 'Experience 1 level off');
  assert.strictEqual(intScore, 0, 'No interest match');
  assert.strictEqual(budScore, 1.0, 'NULL cost matches');

  // Calculate total
  const total = (expScore * 0.25) + (intScore * 0.35) + (budScore * 0.08);
  assert.ok(total < 0.3, 'Total score should be low');
});

test('Integration: Missing data handling', () => {
  const path = {
    title: null,
    description: null,
    level: null,
    total_cost: null,
    summary: null
  };

  // Should not crash
  const expScore = matchExperienceLevel('intermediate', path.level || '');
  const intScore = matchInterests(['computer-vision'], path);
  const budScore = matchBudget(500, path.total_cost);

  assert.ok(typeof expScore === 'number', 'Should return number for null level');
  assert.ok(typeof intScore === 'number', 'Should return number for null title');
  assert.ok(typeof budScore === 'number', 'Should return number for null cost');
});

// ============================================================================
// Edge Cases
// ============================================================================

test('Edge: Very long interest string', () => {
  const path = { title: 'Course', description: '' };
  const longInterest = 'a'.repeat(1000);
  const score = matchInterests([longInterest], path);
  assert.ok(typeof score === 'number' && score >= 0 && score <= 1, 'Should handle long strings');
});

test('Edge: Special characters in interest', () => {
  const path = { title: 'C++ Programming', description: '' };
  const score = matchInterests(['c++'], path);
  assert.ok(score >= 0, 'Should handle special characters');
});

test('Edge: Unicode characters', () => {
  const path = { title: 'ML 机器学习', description: '' };
  const score = matchInterests(['机器学习'], path);
  assert.ok(typeof score === 'number', 'Should handle Unicode');
});

// ============================================================================
// Run all tests
// ============================================================================

runTests();
