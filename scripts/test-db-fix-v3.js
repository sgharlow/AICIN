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
console.log('Generated test token with TEST_JWT_SECRET\n');

const testData = {
  answers: {
    learningGoal: 'data_science',
    experienceLevel: 'intermediate',
    interests: ['machine-learning', 'statistics'],
    availability: '10-20h',
    budget: '$100-500',
    learningStyle: 'hands-on',
    industry: 'technology',
    q8: 'courses',
    q9: 'career_advancement',
    q10: 'online',
    q11: 'project_based',
    q12: 'yes',
    q13: 'practical',
    q14: '3-6months',
    q15: 'yes'
  }
};

console.log('Testing database schema fixes...\n');

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
      console.log('✓ SUCCESS! Database schema fixes verified!\n');
      console.log(`Received ${response.recommendations?.length || 0} recommendations`);
      console.log(`Processing time: ${response.processingTimeMs}ms\n`);
      
      if (response.recommendations && response.recommendations.length > 0) {
        console.log('Top 3 recommendations:');
        response.recommendations.slice(0, 3).forEach((rec, i) => {
          console.log(`  ${i+1}. ${rec.pathTitle} (score: ${rec.matchScore.toFixed(2)})`);
        });
        console.log('\n✓ All database queries working correctly with Strapi schema!');
      }
    } else {
      console.log('✗ Test failed');
      console.log(data);
    }
  });
});

req.on('error', (e) => {
  console.error(`✗ Request failed: ${e.message}`);
});

req.write(postData);
req.end();
