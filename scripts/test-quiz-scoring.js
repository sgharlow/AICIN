/**
 * Test Quiz Scoring with Updated Data
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

// Import scoring logic
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
  if (pathCost === null || pathCost === undefined) return 1.0;
  if (pathCost <= userBudget) return 1.0;
  return Math.max(0, 1 - (pathCost - userBudget) / userBudget);
}

function matchTimeline(userTimeline, pathHours, weeklyHours) {
  if (!pathHours || pathHours === 0) return 1.0; // NULL hours = assume match

  const weeksNeeded = pathHours / weeklyHours;
  const monthsNeeded = weeksNeeded / 4.33;

  if (monthsNeeded <= userTimeline) return 1.0;

  // Partial match if slightly over timeline
  const overage = (monthsNeeded - userTimeline) / userTimeline;
  return Math.max(0, 1 - overage);
}

async function testScoring() {
  console.log('='.repeat(80));
  console.log('Testing Quiz Scoring with Updated Data');
  console.log('='.repeat(80));

  // Test profile (Computer Vision, Intermediate)
  const profile = {
    experienceLevel: 'intermediate',
    interests: ['computer-vision'],
    maxBudget: 500,
    weeklyHours: 15,
    timeline: 12, // 12 months
    wantsCertification: false,
    learningGoal: 'career-switch',
    programmingExperience: 'intermediate'
  };

  console.log('\nTest Profile:');
  console.log(JSON.stringify(profile, null, 2));

  // Fetch paths
  const result = await pool.query(`
    SELECT
      lp.id,
      lp.title,
      lp.description,
      lp.difficulty as level,
      lp.total_realistic_hours as estimated_hours,
      lp.total_cost,
      lp.summary
    FROM learning_paths lp
    WHERE lp.is_active = true
      AND lp.published_at IS NOT NULL
      AND (lp.title ILIKE '%computer%vision%' OR lp.title ILIKE '%machine%learning%')
    ORDER BY lp.title
    LIMIT 15
  `);

  console.log(`\nFound ${result.rows.length} paths\n`);

  // Score each path
  const weights = {
    experience: 0.25,
    interests: 0.35,
    goals: 0.15,
    timeline: 0.10,
    budget: 0.08,
    programming: 0.05,
    certification: 0.02
  };

  const scoredPaths = result.rows.map(path => {
    const scores = {
      experience: matchExperienceLevel(profile.experienceLevel, path.level || ''),
      interests: matchInterests(profile.interests, path),
      budget: matchBudget(profile.maxBudget, path.total_cost),
      timeline: matchTimeline(profile.timeline, path.estimated_hours, profile.weeklyHours),
      goals: 0.8, // Simplified
      programming: 0.8, // Simplified
      certification: path.has_certificate ? 1.0 : 0.5
    };

    const totalScore =
      (scores.experience * weights.experience) +
      (scores.interests * weights.interests) +
      (scores.goals * weights.goals) +
      (scores.timeline * weights.timeline) +
      (scores.budget * weights.budget) +
      (scores.programming * weights.programming) +
      (scores.certification * weights.certification);

    return {
      title: path.title,
      level: path.level,
      cost: path.total_cost,
      hours: path.estimated_hours,
      scores,
      totalScore: Math.round(totalScore * 100)
    };
  });

  // Sort by score
  scoredPaths.sort((a, b) => b.totalScore - a.totalScore);

  // Display results
  console.log('SCORING RESULTS:');
  console.log('='.repeat(80));

  scoredPaths.forEach((path, i) => {
    console.log(`\n${i + 1}. ${path.title} - ${path.totalScore}%`);
    console.log(`   Level: ${path.level} | Cost: $${path.cost || 0} | Hours: ${path.hours || 'N/A'}`);
    console.log(`   Experience: ${Math.round(path.scores.experience * 100)}% | ` +
                `Interest: ${Math.round(path.scores.interests * 100)}% | ` +
                `Budget: ${Math.round(path.scores.budget * 100)}% | ` +
                `Timeline: ${Math.round(path.scores.timeline * 100)}%`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('DIFFERENTIATION ANALYSIS:');
  console.log('='.repeat(80));

  const topScore = scoredPaths[0].totalScore;
  const secondScore = scoredPaths[1]?.totalScore || 0;
  const thirdScore = scoredPaths[2]?.totalScore || 0;

  console.log(`\nTop 3 scores: ${topScore}%, ${secondScore}%, ${thirdScore}%`);
  console.log(`Score spread: ${topScore - thirdScore} percentage points`);
  console.log(`\nTimeline scoring now active: ${scoredPaths[0].scores.timeline < 1.0 ? 'YES (some paths penalized)' : 'Check needed'}`);
  console.log(`Budget scoring now active: ${scoredPaths.some(p => p.scores.budget < 1.0) ? 'YES (some paths penalized)' : 'All within budget'}`);

  await pool.end();
}

testScoring().catch(console.error);
