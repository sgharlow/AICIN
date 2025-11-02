#!/usr/bin/env node
/**
 * AICIN - Integration Test Script
 * Tests the orchestrator with sample quiz data
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const ORCHESTRATOR_URL = 'https://orchestrator-n6oitfxdra-uw.a.run.app';
const SAMPLE_QUIZ_PATH = path.join(__dirname, '..', 'examples', 'sample-quiz.json');

async function testOrchestrator() {
  console.log('\n🧪 AICIN Integration Test\n');
  console.log('Target:', ORCHESTRATOR_URL);
  console.log('');

  // Read sample quiz data
  const quizData = JSON.parse(fs.readFileSync(SAMPLE_QUIZ_PATH, 'utf8'));

  console.log('📝 Test Payload:');
  console.log(`   User ID: ${quizData.userId}`);
  console.log(`   Answers: ${Object.keys(quizData.answers).length} questions`);
  console.log('');

  // Test 1: Health check
  console.log('Test 1: Health Check');
  await testHealthEndpoint();

  // Test 2: Quiz scoring (without auth for now)
  console.log('\nTest 2: Quiz Scoring');
  await testQuizScoring(quizData);

  console.log('\n✅ Integration test complete!\n');
}

function testHealthEndpoint() {
  return new Promise((resolve, reject) => {
    const healthUrl = `${ORCHESTRATOR_URL}/health`;

    https.get(healthUrl, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          const response = JSON.parse(data);
          console.log(`   ✓ Status: ${response.status}`);
          console.log(`   ✓ Agent: ${response.agent}`);
          resolve(response);
        } else {
          console.log(`   ✗ Health check failed: ${res.statusCode}`);
          reject(new Error(`Health check failed: ${res.statusCode}`));
        }
      });
    }).on('error', (err) => {
      console.log(`   ✗ Error: ${err.message}`);
      reject(err);
    });
  });
}

function testQuizScoring(quizData) {
  return new Promise((resolve, reject) => {
    const url = new URL('/api/v1/quiz/score', ORCHESTRATOR_URL);
    const postData = JSON.stringify(quizData);

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`   Response Status: ${res.statusCode}`);

        if (res.statusCode === 200) {
          const response = JSON.parse(data);
          console.log(`   ✓ Received recommendations: ${response.recommendations?.length || 0}`);

          if (response.recommendations && response.recommendations.length > 0) {
            console.log('\n   Top Recommendation:');
            const top = response.recommendations[0];
            console.log(`      Path: ${top.pathTitle}`);
            console.log(`      Match Score: ${top.matchScore}`);
            console.log(`      Confidence: ${top.confidence}`);
          }

          resolve(response);
        } else if (res.statusCode === 401) {
          console.log(`   ℹ Authentication required (expected for production)`);
          console.log(`   Response: ${data}`);
          resolve({ status: 'auth_required' });
        } else {
          console.log(`   ✗ Request failed: ${res.statusCode}`);
          console.log(`   Response: ${data}`);
          reject(new Error(`Request failed: ${res.statusCode}`));
        }
      });
    });

    req.on('error', (err) => {
      console.log(`   ✗ Error: ${err.message}`);
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

// Run test
testOrchestrator().catch(err => {
  console.error('\n❌ Test failed:', err.message);
  process.exit(1);
});
