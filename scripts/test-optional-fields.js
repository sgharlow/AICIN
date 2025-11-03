/**
 * Test Optional Fields Validation
 * Verify that quiz accepts minimal input (only critical fields)
 */

const https = require('https');
const jwt = require('jsonwebtoken');

const ORCHESTRATOR_URL = 'https://orchestrator-239116109469.us-west1.run.app';
const JWT_SECRET = process.env.TEST_JWT_SECRET;

if (!JWT_SECRET) {
  console.error('❌ ERROR: TEST_JWT_SECRET environment variable is required');
  console.log('Set it with: export TEST_JWT_SECRET="your-test-secret"');
  console.log('\nFor this deployment, check Secret Manager for the jwt-secret value');
  process.exit(1);
}

/**
 * Test cases for optional field validation
 */
const testCases = [
  {
    name: 'Minimal Input (Only Critical Fields)',
    description: 'Only experienceLevel and interests provided',
    answers: {
      experienceLevel: 'beginner',
      interests: ['machine-learning']
      // All other fields omitted - should use defaults
    }
  },
  {
    name: 'Partial Input (6 Key Fields)',
    description: 'Critical + high-impact fields only',
    answers: {
      experienceLevel: 'intermediate',
      interests: ['deep-learning', 'nlp'],
      availability: '10-20h',
      budget: '$100-500',
      timeline: '3-6-months',
      certification: 'nice-to-have'
      // Other fields omitted
    }
  },
  {
    name: 'Edge Case from Previous Test',
    description: 'Beginner wanting advanced topics',
    answers: {
      experienceLevel: 'beginner',
      interests: ['deep-learning', 'computer-vision', 'research'],
      availability: '10-20h',
      budget: '$500+',
      timeline: '3-6-months'
      // Other fields omitted - previously failed with HTTP 400
    }
  }
];

/**
 * Make API request with JWT auth
 */
function makeRequest(answers, testName) {
  return new Promise((resolve, reject) => {
    const userId = 123;
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' });

    const requestBody = JSON.stringify({ answers });
    const startTime = Date.now();

    const options = {
      hostname: 'orchestrator-239116109469.us-west1.run.app',
      path: '/api/v1/quiz/score',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
        'Authorization': `Bearer ${token}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const duration = Date.now() - startTime;
        try {
          const response = JSON.parse(data);
          resolve({
            testName,
            status: res.statusCode,
            duration,
            response,
            success: res.statusCode === 200
          });
        } catch (error) {
          resolve({
            testName,
            status: res.statusCode,
            duration,
            response: data,
            success: false,
            error: 'Invalid JSON response'
          });
        }
      });
    });

    req.on('error', (error) => {
      reject({
        testName,
        error: error.message
      });
    });

    req.write(requestBody);
    req.end();
  });
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🧪 Testing Optional Field Validation');
  console.log('Testing that minimal quiz input is now accepted\n');

  const results = [];

  for (const testCase of testCases) {
    console.log(`\n[${testCases.indexOf(testCase) + 1}/${testCases.length}] ${testCase.name}...`);
    console.log(`   ${testCase.description}`);

    try {
      const result = await makeRequest(testCase.answers, testCase.name);
      results.push(result);

      if (result.success) {
        console.log(`   ✅ Success (${result.status}) in ${result.duration}ms`);

        // Check for warnings
        if (result.response.warnings && result.response.warnings.length > 0) {
          console.log(`   ⚠️  Warnings (${result.response.warnings.length}):`);
          result.response.warnings.forEach(w => console.log(`      - ${w}`));
        }

        // Show top recommendation
        if (result.response.recommendations && result.response.recommendations.length > 0) {
          const top = result.response.recommendations[0];
          console.log(`   📊 Top Recommendation:`);
          console.log(`      ${top.pathTitle} (score: ${top.matchScore}, confidence: ${top.confidence})`);
        }
      } else {
        console.log(`   ❌ Failed (${result.status})`);
        if (result.response.error) {
          console.log(`      Error: ${result.response.error}`);
          console.log(`      Message: ${result.response.message}`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Request failed: ${error.message || error.error}`);
      results.push({
        testName: testCase.name,
        success: false,
        error: error.message || error.error
      });
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('VALIDATION TEST RESULTS');
  console.log('='.repeat(80));

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\nPass Rate: ${passed}/${testCases.length} (${Math.round(passed/testCases.length*100)}%)`);
  console.log(`Fail Rate: ${failed}/${testCases.length} (${Math.round(failed/testCases.length*100)}%)`);

  console.log('\n📊 Detailed Results:\n');
  results.forEach((result, i) => {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} [${i+1}] ${result.testName}`);
    if (result.success) {
      console.log(`   Status: ${result.status} | Duration: ${result.duration}ms`);
      if (result.response.warnings) {
        console.log(`   Warnings: ${result.response.warnings.length}`);
      }
    } else {
      console.log(`   Error: ${result.error || result.response?.message || 'Unknown'}`);
    }
  });

  // Verdict
  console.log('\n' + '='.repeat(80));
  if (passed === testCases.length) {
    console.log('✅ VERDICT: All tests passed! Optional fields validation working correctly.');
  } else if (passed > 0) {
    console.log(`⚠️  VERDICT: ${passed}/${testCases.length} tests passed. Some issues remain.`);
  } else {
    console.log('❌ VERDICT: All tests failed. Validation changes not working.');
  }
  console.log('='.repeat(80));
}

// Run tests
runTests().catch(console.error);
