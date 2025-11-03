/**
 * Test Backward Compatibility
 * Verify that old 15-field quiz format still works after Phase 2 (9-field reduction)
 */

const https = require('https');
const jwt = require('jsonwebtoken');

const ORCHESTRATOR_URL = 'https://orchestrator-239116109469.us-west1.run.app';
const JWT_SECRET = process.env.TEST_JWT_SECRET;

if (!JWT_SECRET) {
  console.error('❌ ERROR: TEST_JWT_SECRET environment variable is required');
  console.log('Set it with: export TEST_JWT_SECRET="your-test-secret"');
  process.exit(1);
}

/**
 * Test cases with old 15-field format
 */
const testCases = [
  {
    name: 'Old 15-Field Format (All Fields)',
    description: 'Complete old quiz format with all 15 fields including removed ones',
    answers: {
      // New 9-field format (should work)
      experienceLevel: 'intermediate',
      interests: ['machine-learning', 'nlp'],
      availability: '10-20h',
      budget: '$100-500',
      timeline: '3-6-months',
      certification: 'nice-to-have',
      learningGoal: 'upskill',
      programming: 'intermediate',
      mathBackground: 'strong',

      // OLD REMOVED FIELDS (should be ignored gracefully)
      background: 'tech',
      specialization: 'specialist',
      priorProjects: '3-5',
      learningStyle: 'hands-on',
      industry: 'healthcare',
      teamPreference: 'individual'
    }
  },
  {
    name: 'Old Format with Minimal New Fields',
    description: 'Old format but only critical new fields provided',
    answers: {
      // Only new critical fields
      experienceLevel: 'beginner',
      interests: ['deep-learning'],

      // Old removed fields still included
      background: 'non-tech',
      specialization: 'generalist',
      priorProjects: '0',
      learningStyle: 'structured',
      industry: 'finance',
      teamPreference: 'collaborative'
    }
  },
  {
    name: 'Mixed: Some New, Some Old',
    description: 'Realistic scenario: frontend has some old fields, some new',
    answers: {
      experienceLevel: 'advanced',
      interests: ['computer-vision', 'robotics'],
      availability: '20+h',
      budget: '$500+',
      programming: 'advanced',

      // Mix of old fields that might linger in frontend
      learningStyle: 'project-based',
      industry: 'technology',
      background: 'tech'
    }
  }
];

/**
 * Make API request with JWT auth
 */
function makeRequest(answers, testName) {
  return new Promise((resolve, reject) => {
    const userId = 456; // Different user for backward compat tests
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
            success: res.statusCode === 200,
            fieldCount: Object.keys(answers).length
          });
        } catch (error) {
          resolve({
            testName,
            status: res.statusCode,
            duration,
            response: data,
            success: false,
            error: 'Invalid JSON response',
            fieldCount: Object.keys(answers).length
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
 * Run all backward compatibility tests
 */
async function runTests() {
  console.log('🧪 Testing Backward Compatibility (15-Field Format)');
  console.log('Verifying old quiz format still works after Phase 2\n');

  const results = [];

  for (const testCase of testCases) {
    console.log(`\n[${testCases.indexOf(testCase) + 1}/${testCases.length}] ${testCase.name}...`);
    console.log(`   ${testCase.description}`);
    console.log(`   Fields sent: ${Object.keys(testCase.answers).length}`);

    try {
      const result = await makeRequest(testCase.answers, testCase.name);
      results.push(result);

      if (result.success) {
        console.log(`   ✅ Success (${result.status}) in ${result.duration}ms`);

        // Check for warnings
        if (result.response.warnings && result.response.warnings.length > 0) {
          console.log(`   ⚠️  Warnings (${result.response.warnings.length}):`);
          result.response.warnings.slice(0, 3).forEach(w => console.log(`      - ${w.substring(0, 80)}...`));
        } else {
          console.log(`   ℹ️  No warnings (all fields provided or ignored gracefully)`);
        }

        // Show top recommendation
        if (result.response.recommendations && result.response.recommendations.length > 0) {
          const top = result.response.recommendations[0];
          console.log(`   📊 Top Recommendation:`);
          console.log(`      ${top.pathTitle} (score: ${top.matchScore}, confidence: ${top.confidence})`);
        }

        // Check if extra fields caused issues
        const newFieldCount = 9;
        const oldFieldCount = 15;
        if (result.fieldCount >= oldFieldCount) {
          console.log(`   ✅ Backward Compatibility: ${result.fieldCount} fields accepted (extra fields ignored)`);
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
  console.log('BACKWARD COMPATIBILITY TEST RESULTS');
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
      console.log(`   Status: ${result.status} | Duration: ${result.duration}ms | Fields: ${result.fieldCount}`);
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
    console.log('✅ VERDICT: Backward compatibility maintained! Old 15-field format works.');
    console.log('   Extra fields are ignored gracefully, no breaking changes.');
  } else if (passed > 0) {
    console.log(`⚠️  VERDICT: ${passed}/${testCases.length} tests passed. Partial compatibility.`);
  } else {
    console.log('❌ VERDICT: Backward compatibility broken. Old format fails.');
  }
  console.log('='.repeat(80));

  // Exit code for automation
  process.exit(passed === testCases.length ? 0 : 1);
}

// Run tests
runTests().catch(console.error);
