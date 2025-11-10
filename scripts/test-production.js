#!/usr/bin/env node
/**
 * AICIN - Production API Test Script
 * Tests deployed orchestrator with JWT authentication
 */

const https = require('https');
const crypto = require('crypto');

const ORCHESTRATOR_URL = 'https://orchestrator-239116109469.us-west1.run.app';
const JWT_SECRET = process.env.JWT_SECRET || 'ABC123==';

// Disable SSL certificate validation (for Windows cert issues)
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

/**
 * Generate a JWT token for testing
 */
function generateJWT(userId = Math.floor(Math.random() * 100000) + 1000) {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const payload = {
    userId: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
  };

  const base64UrlEncode = (obj) => {
    return Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  const headerEncoded = base64UrlEncode(header);
  const payloadEncoded = base64UrlEncode(payload);

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${headerEncoded}.${payloadEncoded}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return {
    token: `${headerEncoded}.${payloadEncoded}.${signature}`,
    userId,
    expiresAt: new Date(payload.exp * 1000).toISOString()
  };
}

/**
 * Make HTTPS request with proper error handling
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      agent: httpsAgent
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: parsed
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

/**
 * Test 1: Health check (no auth required)
 */
async function testHealthEndpoint() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 1: Health Check (No Authentication)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const startTime = Date.now();
    const response = await makeRequest(`${ORCHESTRATOR_URL}/health`);
    const duration = Date.now() - startTime;

    console.log(`Status: ${response.statusCode}`);
    console.log(`Duration: ${duration}ms`);
    console.log('\nResponse:');
    console.log(JSON.stringify(response.body, null, 2));

    if (response.statusCode === 200) {
      console.log('\n✅ Health check PASSED');
      return true;
    } else {
      console.log('\n❌ Health check FAILED');
      return false;
    }
  } catch (error) {
    console.log('\n❌ Health check ERROR:', error.message);
    return false;
  }
}

/**
 * Test 2: Quiz scoring with authentication
 */
async function testQuizScoringEndpoint() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 2: Quiz Scoring (With Authentication)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Generate JWT
  const jwt = generateJWT();
  console.log(`Generated JWT for user: ${jwt.userId}`);
  console.log(`Token expires: ${jwt.expiresAt}`);
  console.log(`Token: ${jwt.token.substring(0, 50)}...\n`);

  // Test payload
  const testAnswers = {
    answers: {
      experienceLevel: 'intermediate',
      interests: ['machine-learning', 'data-science', 'nlp'],
      learningStyle: 'hands-on',
      timeCommitment: '10-20',
      careerGoals: 'specialization'
    }
  };

  console.log('Test quiz answers:');
  console.log(JSON.stringify(testAnswers, null, 2));

  try {
    const startTime = Date.now();
    const response = await makeRequest(`${ORCHESTRATOR_URL}/api/v1/quiz/score`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt.token}`,
        'Content-Type': 'application/json'
      },
      body: testAnswers
    });
    const duration = Date.now() - startTime;

    console.log(`\nStatus: ${response.statusCode}`);
    console.log(`Duration: ${duration}ms`);
    console.log('\nResponse:');

    // Pretty print the response
    if (response.body && typeof response.body === 'object') {
      if (response.body.recommendations) {
        console.log(`\n📊 Received ${response.body.recommendations.length} recommendations`);
        console.log('\nTop 3 Recommendations:');
        response.body.recommendations.slice(0, 3).forEach((rec, idx) => {
          console.log(`\n${idx + 1}. ${rec.pathTitle || rec.title || rec.name || 'Untitled'}`);
          console.log(`   Match Score: ${rec.matchScore || rec.score || 'N/A'}`);
          console.log(`   Confidence: ${rec.confidence || 'N/A'}`);
          if (rec.matchReasons && rec.matchReasons.length > 0) {
            console.log(`   Top Reason: ${rec.matchReasons[0].reason}`);
          }
        });

        console.log('\n\nFull response saved to: test-production-response.json');
        require('fs').writeFileSync(
          'test-production-response.json',
          JSON.stringify(response.body, null, 2)
        );
      } else {
        console.log(JSON.stringify(response.body, null, 2));
      }
    } else {
      console.log(response.body);
    }

    if (response.statusCode === 200) {
      console.log('\n✅ Quiz scoring PASSED');
      return true;
    } else {
      console.log('\n❌ Quiz scoring FAILED');
      return false;
    }
  } catch (error) {
    console.log('\n❌ Quiz scoring ERROR:', error.message);
    console.log(error);
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('\n🚀 AICIN Production API Test Suite');
  console.log(`📍 Testing: ${ORCHESTRATOR_URL}`);
  console.log(`🔑 JWT Secret: ${JWT_SECRET.substring(0, 10)}...`);

  const results = {
    health: false,
    scoring: false
  };

  // Test 1: Health Check
  results.health = await testHealthEndpoint();

  // Wait a bit between tests
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: Quiz Scoring
  results.scoring = await testQuizScoringEndpoint();

  // Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`Health Check:   ${results.health ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Quiz Scoring:   ${results.scoring ? '✅ PASS' : '❌ FAIL'}`);

  const totalTests = 2;
  const passedTests = Object.values(results).filter(r => r).length;

  console.log(`\n${passedTests}/${totalTests} tests passed`);

  if (passedTests === totalTests) {
    console.log('\n🎉 All tests passed! Production API is working correctly.\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Check the output above for details.\n');
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  runTests().catch(error => {
    console.error('\n💥 Fatal error running tests:', error);
    process.exit(1);
  });
}

module.exports = { generateJWT, makeRequest, testHealthEndpoint, testQuizScoringEndpoint };
