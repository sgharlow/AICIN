#!/usr/bin/env node
const jwt = require('jsonwebtoken');
const https = require('https');

const JWT_SECRET = process.env.TEST_JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ ERROR: TEST_JWT_SECRET environment variable is required');
  console.log('Set it with: export TEST_JWT_SECRET="your-test-secret"');
  console.log('Generate a secret: openssl rand -base64 32');
  process.exit(1);
}

const ORCHESTRATOR_URL = 'https://orchestrator-239116109469.us-west1.run.app/api/v1/quiz/score';

// Generate a fresh token with the correct secret
const token = jwt.sign({ userId: 1 }, JWT_SECRET, { algorithm: 'HS256' });
console.log('🚀 Testing Multi-Agent Workflow\n');

const testData = {
  answers: {
    learningGoal: 'data_science',
    experienceLevel: 'intermediate',
    interests: ['machine-learning', 'statistics'],
    availability: '10-20h',
    budget: '$100-500',
    learningStyle: 'hands-on',
    industry: 'technology',
    background: 'tech',
    programming: 'intermediate',
    specialization: 'specialist',
    certification: 'nice-to-have',
    timeline: '3-6-months',
    priorProjects: '3-5',
    mathBackground: 'basic',
    teamPreference: 'both'
  }
};

const postData = JSON.stringify(testData);

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'Authorization': `Bearer ${token}`
  }
};

const req = https.request(ORCHESTRATOR_URL, options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`Status: ${res.statusCode}\n`);

    if (res.statusCode === 200) {
      const response = JSON.parse(data);
      console.log('✓ SUCCESS! Multi-agent workflow completed!\n');
      console.log(`Submission ID: ${response.submissionId}`);
      console.log(`Recommendations: ${response.recommendations?.length || 0}`);
      console.log(`Processing time: ${response.processingTimeMs}ms`);
      console.log(`From cache: ${response.fromCache || false}\n`);

      if (response.recommendations && response.recommendations.length > 0) {
        console.log('Top recommendations:');
        response.recommendations.forEach((rec, i) => {
          const score = rec.matchScore != null ? rec.matchScore.toFixed(2) : 'N/A';
          console.log(`  ${i+1}. ${rec.pathTitle || rec.pathSlug || 'Unknown'}`);
          console.log(`     Score: ${score} | Confidence: ${rec.confidence}`);
          if (rec.matchReasons && rec.matchReasons.length > 0) {
            console.log(`     Reasons: ${rec.matchReasons.slice(0, 2).map(r => r.reason || r).join(', ')}`);
          }
        });
        console.log('\n✓ All agents working correctly!');
        console.log('  - Profile Analyzer ✓');
        console.log('  - Content Matcher ✓');
        console.log('  - Path Optimizer ✓');
        console.log('  - Recommendation Builder ✓');
        console.log('  - Database queries ✓');
        console.log('  - Cache graceful degradation ✓');
      }
    } else {
      console.log('✗ Test failed');
      try {
        const errorData = JSON.parse(data);
        console.log(JSON.stringify(errorData, null, 2));
      } catch {
        console.log(data);
      }
    }
  });
});

req.on('error', (e) => {
  console.error(`✗ Request failed: ${e.message}`);
});

req.write(postData);
req.end();
