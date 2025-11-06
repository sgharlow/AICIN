/**
 * Comprehensive Scoring Diagnostics
 * Tests the entire scoring pipeline with real data
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT,
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

// Simulate the actual query from fetchActiveLearningPaths
async function testQuery() {
  console.log('='.repeat(80));
  console.log('DIAGNOSTIC: Testing Database Query');
  console.log('='.repeat(80));

  const result = await pool.query(`
    SELECT
      lp.id,
      lp.document_id,
      lp.title,
      lp.slug,
      lp.description,
      lp.difficulty as level,
      lp.total_realistic_hours as estimated_hours,
      lp.total_cost,
      false as has_certificate,
      lp.target_goals as topics,
      lp.summary
    FROM learning_paths lp
    WHERE lp.is_active = true
      AND lp.published_at IS NOT NULL
      AND (lp.title ILIKE '%computer%vision%' OR lp.title ILIKE '%machine%learning%')
    LIMIT 10
  `);

  console.log(`\nFound ${result.rows.length} paths\n`);

  result.rows.forEach((path, i) => {
    console.log(`Path ${i + 1}: ${path.title}`);
    console.log(`  id: ${path.id}`);
    console.log(`  document_id: ${path.document_id}`);
    console.log(`  level: "${path.level}" (type: ${typeof path.level})`);
    console.log(`  difficulty: "${path.difficulty}" (should be undefined)`);
    console.log(`  estimated_hours: ${path.estimated_hours}`);
    console.log(`  total_cost: ${path.total_cost}`);
    console.log(`  topics: ${JSON.stringify(path.topics)}`);
    console.log(`  description length: ${path.description?.length || 0}`);
    console.log(`  summary length: ${path.summary?.length || 0}`);
    console.log('');
  });

  return result.rows;
}

// Test matching functions with real data
function testMatchingFunctions(paths) {
  console.log('='.repeat(80));
  console.log('DIAGNOSTIC: Testing Matching Functions');
  console.log('='.repeat(80));

  const testProfile = {
    experienceLevel: 'intermediate',
    interests: ['computer-vision'],
    maxBudget: 500,
    weeklyHours: 15,
    timeline: 24,
    wantsCertification: false,
    learningGoal: 'career-switch',
    programmingExperience: 'intermediate'
  };

  console.log('\nTest Profile:', JSON.stringify(testProfile, null, 2));
  console.log('');

  paths.forEach(path => {
    console.log(`\n--- Testing: ${path.title} ---`);

    // Test experience matching
    const userLevel = testProfile.experienceLevel;
    const pathLevel = (path.level || '').toLowerCase();
    const experienceScore = matchExperienceLevel(userLevel, pathLevel);
    console.log(`Experience Match: user="${userLevel}", path="${pathLevel}" => ${(experienceScore * 100).toFixed(0)}%`);

    // Test interest matching
    const interestScore = matchInterests(testProfile.interests, path);
    console.log(`Interest Match: ${(interestScore * 100).toFixed(0)}%`);

    // Test budget matching
    const budgetScore = path.total_cost <= testProfile.maxBudget ? 100 :
      Math.max(0, (1 - (path.total_cost - testProfile.maxBudget) / testProfile.maxBudget) * 100);
    console.log(`Budget Match: cost=$${path.total_cost}, max=$${testProfile.maxBudget} => ${budgetScore.toFixed(0)}%`);

    // Calculate total score
    const weights = {
      experience: 0.25,
      interests: 0.35,
      budget: 0.08,
      // Simplified for diagnostic
    };

    const totalScore = (experienceScore * weights.experience) +
                      (interestScore * weights.interests) +
                      (budgetScore/100 * weights.budget);

    console.log(`Partial Total Score: ${(totalScore * 100).toFixed(1)}%`);
  });
}

// Matching function implementations (copy from local-scorer.ts)
function matchExperienceLevel(userLevel, pathLevel) {
  const levelOrder = ['beginner', 'intermediate', 'advanced', 'expert'];
  const userIndex = levelOrder.indexOf(userLevel.toLowerCase());
  const pathIndex = levelOrder.indexOf(pathLevel.toLowerCase());

  if (userIndex === -1 || pathIndex === -1) {
    console.log(`  WARNING: Unknown level - user="${userLevel}" (${userIndex}), path="${pathLevel}" (${pathIndex})`);
    return 0.5;
  }

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
  let debugInfo = [];

  for (const interest of interests) {
    const normalizedInterest = normalize(interest);

    if (pathTitle.includes(normalizedInterest)) {
      matchCount += 1.0;
      debugInfo.push(`  ✓ Title contains "${normalizedInterest}"`);
    }
    else if (pathSummary.includes(normalizedInterest)) {
      matchCount += 0.8;
      debugInfo.push(`  ✓ Summary contains "${normalizedInterest}"`);
    }
    else if (pathDescription.includes(normalizedInterest)) {
      matchCount += 0.6;
      debugInfo.push(`  ✓ Description contains "${normalizedInterest}"`);
    } else {
      debugInfo.push(`  ✗ No match for "${normalizedInterest}"`);
    }
  }

  debugInfo.forEach(d => console.log(d));

  return Math.min(matchCount / interests.length, 1.0);
}

// Run diagnostics
async function main() {
  try {
    const paths = await testQuery();
    testMatchingFunctions(paths);
  } catch (error) {
    console.error('ERROR:', error);
  } finally {
    await pool.end();
  }
}

main();
