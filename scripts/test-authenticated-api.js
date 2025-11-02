#!/usr/bin/env node
/**
 * AICIN - Authenticated API Integration Test
 * Tests the full quiz scoring workflow with authentication
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { generateTestJWT } = require('./generate-test-jwt.js');

// Configuration
const ORCHESTRATOR_URL = 'https://orchestrator-n6oitfxdra-uw.a.run.app';
const SAMPLE_QUIZ_PATH = path.join(__dirname, '..', 'examples', 'sample-quiz.json');

async function testAuthenticatedAPI() {
  console.log('\n🧪 AICIN Authenticated API Integration Test\n');
  console.log('Target:', ORCHESTRATOR_URL);
  console.log('');

  // Read sample quiz data
  const quizData = JSON.parse(fs.readFileSync(SAMPLE_QUIZ_PATH, 'utf8'));

  console.log('📝 Test Payload:');
  console.log(`   User ID: ${quizData.userId}`);
  console.log(`   Answers: ${Object.keys(quizData.answers).length} questions`);
  console.log('');

  // Generate JWT token
  console.log('🔐 Generating JWT token...');
  const jwt = generateTestJWT(quizData.userId);
  console.log(`   Token expires: ${jwt.expiresAt}`);
  console.log('');

  // Test 1: Health check (no auth required)
  console.log('Test 1: Health Check (no auth)');
  await testHealthEndpoint();

  // Test 2: Quiz scoring with authentication
  console.log('\nTest 2: Authenticated Quiz Scoring');
  await testQuizScoring(quizData, jwt.token);

  console.log('\n✅ Authenticated API test complete!\n');
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
          console.log(`   ✓ Database: ${response.checks?.database || 'ok'}`);
          console.log(`   ✓ Cache: ${response.checks?.cache || 'unknown'}`);
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

function testQuizScoring(quizData, token) {
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
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${token}`
      }
    };

    console.log(`   Sending authenticated request...`);

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`   Response Status: ${res.statusCode}`);

        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data);
            console.log(`   ✓ Success! Received response`);

            if (response.recommendations && Array.isArray(response.recommendations)) {
              console.log(`   ✓ Recommendations: ${response.recommendations.length}`);

              if (response.recommendations.length > 0) {
                console.log('\n   📊 Top Recommendation:');
                const top = response.recommendations[0];
                console.log(`      Path: ${top.pathTitle || 'N/A'}`);
                console.log(`      Match Score: ${top.matchScore || top.relevanceScore || 'N/A'}`);
                console.log(`      Confidence: ${top.confidence || 'N/A'}`);
                if (top.matchReasons && top.matchReasons.length > 0) {
                  console.log(`      Match Reasons:`);
                  top.matchReasons.slice(0, 3).forEach(reason => {
                    console.log(`         - ${reason}`);
                  });
                }
              }
            } else if (response.submissionId) {
              console.log(`   ✓ Submission ID: ${response.submissionId}`);
              console.log(`   ℹ Recommendations may be processing asynchronously`);
            } else {
              console.log(`   ⚠ Unexpected response format`);
              console.log(`   Response:`, JSON.stringify(response, null, 2).substring(0, 500));
            }

            resolve(response);
          } catch (parseError) {
            console.log(`   ✗ Failed to parse response`);
            console.log(`   Raw response: ${data.substring(0, 500)}`);
            reject(parseError);
          }
        } else if (res.statusCode === 401) {
          console.log(`   ✗ Authentication failed`);
          console.log(`   Response: ${data}`);
          console.log(`   ℹ This might mean the JWT_SECRET doesn't match`);
          reject(new Error('Authentication failed'));
        } else if (res.statusCode === 500) {
          console.log(`   ✗ Server error`);
          try {
            const errorResponse = JSON.parse(data);
            console.log(`   Error: ${errorResponse.error || 'Unknown error'}`);
            console.log(`   Message: ${errorResponse.message || 'No details'}`);
          } catch {
            console.log(`   Response: ${data.substring(0, 500)}`);
          }
          reject(new Error(`Server error: ${res.statusCode}`));
        } else {
          console.log(`   ✗ Request failed: ${res.statusCode}`);
          console.log(`   Response: ${data.substring(0, 500)}`);
          reject(new Error(`Request failed: ${res.statusCode}`));
        }
      });
    });

    req.on('error', (err) => {
      console.log(`   ✗ Request error: ${err.message}`);
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

// Run test
if (require.main === module) {
  testAuthenticatedAPI().catch(err => {
    console.error('\n❌ Test failed:', err.message);
    process.exit(1);
  });
}

module.exports = { testAuthenticatedAPI };
