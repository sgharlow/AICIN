/**
 * Diagnostic Test for Multi-Agent System
 * Tests if agents are working with populated database
 */

const jwt = require('jsonwebtoken');
const https = require('https');

const ORCHESTRATOR_URL = 'https://orchestrator-239116109469.us-west1.run.app';
const JWT_SECRET = process.env.JWT_SECRET || 'tgJoQnBPwHxccxWwYdx15g==';

// Test with Computer Vision interest
const userId = 999;
const token = jwt.sign({ userId }, JWT_SECRET, { algorithm: 'HS256' });

console.log('🔬 DIAGNOSTIC: Testing Multi-Agent System');
console.log('='.repeat(80));
console.log('');
console.log('Test Scenario:');
console.log('  - Interest: Computer Vision');
console.log('  - Experience: Intermediate');
console.log('  - Timeline: 12 months, 15h/week');
console.log('  - Budget: $500');
console.log('');
console.log('Expected Behavior:');
console.log('  - Agents should be called (useAgents = true)');
console.log('  - CV paths should score highest');
console.log('  - Scores should differentiate (not all 96%)');
console.log('  - Timeline should affect scores (long paths penalized)');
console.log('');
console.log('Testing...');
console.log('='.repeat(80));
console.log('');

const quizData = {
  userId,
  answers: {
    experienceLevel: 'intermediate',
    interests: ['computer-vision'],
    learningGoal: 'career-switch',
    preferredLearningStyle: 'hands-on',
    weeklyHours: 15,
    timeline: 12,
    programmingExperience: 'intermediate',
    maxBudget: 500,
    wantsCertification: false
  }
};

const url = new URL('/quiz/score', ORCHESTRATOR_URL);
const options = {
  hostname: url.hostname,
  port: 443,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  rejectUnauthorized: false
};

const startTime = Date.now();

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    const responseTime = Date.now() - startTime;

    try {
      const response = JSON.parse(data);

      if (res.statusCode !== 200) {
        console.error('❌ ERROR Response:', response);
        process.exit(1);
      }

      console.log('✅ Response received in', responseTime, 'ms');
      console.log('');
      console.log('='.repeat(80));
      console.log('RESULTS ANALYSIS');
      console.log('='.repeat(80));
      console.log('');

      // Analyze recommendations
      const recs = response.recommendations || [];
      console.log(`Recommendations returned: ${recs.length}`);
      console.log('');

      if (recs.length === 0) {
        console.log('❌ PROBLEM: No recommendations returned');
        process.exit(1);
      }

      // Show top 5
      console.log('Top 5 Recommendations:');
      console.log('-'.repeat(80));
      recs.slice(0, 5).forEach((rec, i) => {
        const score = rec.matchScore ? Math.round(rec.matchScore * 100) : '??';
        const title = rec.pathTitle || rec.title || 'Unknown';
        console.log(`${i + 1}. ${title} - ${score}%`);

        if (rec.categoryBreakdown) {
          const exp = Math.round((rec.categoryBreakdown.experience || 0) * 100);
          const int = Math.round((rec.categoryBreakdown.interests || 0) * 100);
          const tim = Math.round((rec.categoryBreakdown.timeline || 0) * 100);
          const bud = Math.round((rec.categoryBreakdown.budget || 0) * 100);
          console.log(`   Experience: ${exp}% | Interest: ${int}% | Timeline: ${tim}% | Budget: ${bud}%`);
        }

        if (rec.matchReasons && rec.matchReasons.length > 0) {
          console.log(`   Reasons: ${rec.matchReasons.slice(0,2).map(r => r.reason || r).join(', ')}`);
        }
        console.log('');
      });

      // Diagnostic checks
      console.log('='.repeat(80));
      console.log('DIAGNOSTIC CHECKS');
      console.log('='.repeat(80));
      console.log('');

      // Check 1: Are scores different?
      const scores = recs.slice(0, 10).map(r => Math.round((r.matchScore || 0) * 100));
      const uniqueScores = [...new Set(scores)];
      const allSame = uniqueScores.length === 1;

      console.log(`1. Score Differentiation:`);
      console.log(`   Unique scores in top 10: ${uniqueScores.length}`);
      console.log(`   Scores: ${scores.join(', ')}`);
      if (allSame) {
        console.log(`   ❌ PROBLEM: All paths have same score (${scores[0]}%)`);
        console.log(`   → This means scoring algorithm isn't differentiating`);
      } else {
        console.log(`   ✅ GOOD: Scores are differentiated`);
      }
      console.log('');

      // Check 2: Do CV paths score highest?
      const top3 = recs.slice(0, 3);
      const cvInTop3 = top3.filter(r =>
        (r.pathTitle || '').toLowerCase().includes('computer vision') ||
        (r.pathTitle || '').toLowerCase().includes('computer-vision') ||
        (r.pathTitle || '').toLowerCase().includes('cv')
      ).length;

      console.log(`2. Interest Matching (Computer Vision):`);
      console.log(`   CV paths in top 3: ${cvInTop3}/3`);
      if (cvInTop3 >= 2) {
        console.log(`   ✅ GOOD: Interest matching is working`);
      } else {
        console.log(`   ⚠️  WARNING: CV paths should score higher for CV interest`);
        console.log(`   → Interest matching may need fixing`);
      }
      console.log('');

      // Check 3: Does timeline affect scores?
      const hasTimeline = recs.some(r =>
        r.categoryBreakdown && typeof r.categoryBreakdown.timeline === 'number' && r.categoryBreakdown.timeline < 1.0
      );

      console.log(`3. Timeline Scoring:`);
      if (hasTimeline) {
        console.log(`   ✅ GOOD: Timeline scoring is active (some paths penalized)`);
      } else {
        console.log(`   ⚠️  INFO: All paths have 100% timeline score`);
        console.log(`   → Either all paths fit timeline, or scoring not working`);
      }
      console.log('');

      // Check 4: Response time
      console.log(`4. Performance:`);
      console.log(`   Response time: ${responseTime}ms`);
      if (responseTime < 3000) {
        console.log(`   ✅ EXCELLENT: Sub-3-second response`);
      } else if (responseTime < 10000) {
        console.log(`   ✅ GOOD: Acceptable for comprehensive analysis`);
      } else {
        console.log(`   ⚠️  SLOW: Consider optimization`);
      }
      console.log('');

      // Final verdict
      console.log('='.repeat(80));
      console.log('VERDICT');
      console.log('='.repeat(80));
      console.log('');

      if (allSame && scores[0] >= 90) {
        console.log('❌ AGENTS STILL BROKEN');
        console.log('   Problem: All paths scoring ~' + scores[0] + '%');
        console.log('   Action: Need to apply fixes from battle plan');
        console.log('   Next steps:');
        console.log('   1. Fix Content Matcher (text normalization)');
        console.log('   2. Fix Path Optimizer (scoring weights)');
        console.log('   3. Review TF-IDF implementation');
      } else if (!allSame && cvInTop3 >= 2) {
        console.log('✅ AGENTS WORKING!');
        console.log('   Differentiation: YES');
        console.log('   Interest matching: YES');
        console.log('   Timeline scoring: ' + (hasTimeline ? 'YES' : 'PARTIALLY'));
        console.log('   Action: Test more scenarios, then document');
      } else {
        console.log('⚠️  AGENTS PARTIALLY WORKING');
        console.log('   Some issues detected, review fixes needed');
      }

      console.log('');
      console.log('='.repeat(80));

    } catch (error) {
      console.error('Failed to parse response:', error.message);
      console.error('Raw data:', data.substring(0, 500));
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error(`Request failed: ${error.message}`);
  process.exit(1);
});

const payload = JSON.stringify(quizData);
req.write(payload);
req.end();
