#!/usr/bin/env node
/**
 * Test database schema fixes
 */

const https = require('https');

const ORCHESTRATOR_URL = 'https://orchestrator-239116109469.us-west1.run.app/api/v1/quiz/score';
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImlhdCI6MTczMDUzNzM5MX0.p5VW_2YYyvnU7JbWNGnOwFh1_3Hx7G8_-ys_MnCBXaU';

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
console.log(`URL: ${ORCHESTRATOR_URL}`);

const postData = JSON.stringify(testData);

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'Authorization': `Bearer ${TEST_TOKEN}`
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
      console.log('✓ SUCCESS! Database queries working correctly\n');
      console.log(`Received ${response.recommendations?.length || 0} recommendations`);
      console.log(`Processing time: ${response.processingTimeMs}ms\n`);
      
      if (response.recommendations && response.recommendations.length > 0) {
        console.log('Top recommendation:');
        console.log(`  Path: ${response.recommendations[0].pathTitle}`);
        console.log(`  Score: ${response.recommendations[0].matchScore}`);
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
