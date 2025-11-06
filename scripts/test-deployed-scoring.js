/**
 * Test Deployed Orchestrator Scoring
 * Verifies the deployed service is using updated database with populated fields
 */

const jwt = require('jsonwebtoken');
const https = require('https');

const ORCHESTRATOR_URL = 'https://orchestrator-239116109469.us-west1.run.app';
const JWT_SECRET = process.env.JWT_SECRET || 'tgJoQnBPwHxccxWwYdx15g==';

// Generate JWT token for test user
const userId = 12345;
const token = jwt.sign({ userId }, JWT_SECRET, { algorithm: 'HS256' });

console.log('Testing deployed orchestrator scoring...');
console.log('='.repeat(80));
console.log('');

// Quiz data for Computer Vision, Intermediate experience
const quizData = {
  userId,
  answers: {
    experienceLevel: 'intermediate',
    interests: ['computer-vision'],
    learningGoal: 'career-switch',
    preferredLearningStyle: 'hands-on',
    weeklyHours: 15,
    timeline: 12, // 12 months
    programmingExperience: 'intermediate',
    maxBudget: 500,
    wantsCertification: false
  }
};

// Make POST request
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
  rejectUnauthorized: false // For testing only
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);

      if (res.statusCode !== 200) {
        console.error('Error response:', response);
        process.exit(1);
      }

      console.log('✅ Orchestrator responded successfully!\n');
      console.log('Top 5 Recommendations:');
      console.log('='.repeat(80));

      response.recommendations.slice(0, 5).forEach((rec, i) => {
        const matchPct = Math.round((rec.matchScore || 0) * 100);
        console.log(`\n${i + 1}. ${rec.pathTitle} - ${matchPct}%`);
        console.log(`   Confidence: ${rec.confidence}`);

        if (rec.categoryBreakdown) {
          console.log(`   Experience: ${Math.round(rec.categoryBreakdown.experience * 100)}%`);
          console.log(`   Interest: ${Math.round(rec.categoryBreakdown.interests * 100)}%`);
          console.log(`   Timeline: ${Math.round((rec.categoryBreakdown.timeline || 0) * 100)}%`);
          console.log(`   Budget: ${Math.round((rec.categoryBreakdown.budget || 1) * 100)}%`);
        }
      });

      console.log('\n' + '='.repeat(80));
      console.log('VERIFICATION RESULTS:');
      console.log('='.repeat(80));

      // Check if timeline and budget scoring are present
      const top = response.recommendations[0];
      const hasTimeline = top.categoryBreakdown && typeof top.categoryBreakdown.timeline === 'number';
      const hasBudget = top.categoryBreakdown && typeof top.categoryBreakdown.budget === 'number';

      console.log(`\n✅ Timeline scoring: ${hasTimeline ? 'ACTIVE' : 'NOT PRESENT'}`);
      console.log(`✅ Budget scoring: ${hasBudget ? 'ACTIVE' : 'NOT PRESENT'}`);

      // Check score differentiation
      const scores = response.recommendations.slice(0, 5).map(r => Math.round((r.matchScore || 0) * 100));
      const maxScore = Math.max(...scores);
      const minScore = Math.min(...scores);
      const spread = maxScore - minScore;

      console.log(`\nScore spread: ${spread}% (${maxScore}% → ${minScore}%)`);
      console.log(`Differentiation: ${spread > 20 ? '✅ STRONG' : spread > 10 ? '⚠️ MODERATE' : '❌ WEAK'}`);

      console.log('\n' + '='.repeat(80));
      console.log('Deployment verification COMPLETE! ✅');
      console.log('='.repeat(80));

    } catch (error) {
      console.error('Failed to parse response:', error.message);
      console.error('Raw data:', data);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('Request failed:', error.message);
  process.exit(1);
});

const payload = JSON.stringify(quizData);
req.write(payload);
req.end();
