/**
 * Simple Load Test
 * Test 10 concurrent quiz requests to validate system stability
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
 * Test scenarios for load testing (varied to simulate real usage)
 */
const testScenarios = [
  {
    name: 'Beginner ML',
    answers: {
      experienceLevel: 'beginner',
      interests: ['machine-learning'],
      availability: '5-10h',
      budget: '$100-500'
    }
  },
  {
    name: 'Intermediate DL',
    answers: {
      experienceLevel: 'intermediate',
      interests: ['deep-learning', 'nlp'],
      availability: '10-20h',
      budget: '$500+',
      programming: 'intermediate'
    }
  },
  {
    name: 'Advanced CV',
    answers: {
      experienceLevel: 'advanced',
      interests: ['computer-vision'],
      availability: '20+h',
      budget: '$500+',
      programming: 'advanced',
      mathBackground: 'advanced'
    }
  },
  {
    name: 'Career Switch',
    answers: {
      experienceLevel: 'beginner',
      interests: ['machine-learning', 'career'],
      availability: '20+h',
      budget: '$500+',
      learningGoal: 'career-switch'
    }
  },
  {
    name: 'Quick Learner',
    answers: {
      experienceLevel: 'intermediate',
      interests: ['machine-learning'],
      availability: '10-20h',
      budget: '$100-500',
      timeline: 'asap'
    }
  },
  {
    name: 'Budget Conscious',
    answers: {
      experienceLevel: 'beginner',
      interests: ['machine-learning'],
      availability: '5-10h',
      budget: '$0',
      learningGoal: 'exploration'
    }
  },
  {
    name: 'Certification Seeker',
    answers: {
      experienceLevel: 'intermediate',
      interests: ['machine-learning', 'deep-learning'],
      availability: '10-20h',
      budget: '$100-500',
      certification: 'required'
    }
  },
  {
    name: 'Research Focused',
    answers: {
      experienceLevel: 'advanced',
      interests: ['deep-learning', 'research'],
      availability: '20+h',
      budget: '$500+',
      mathBackground: 'advanced'
    }
  },
  {
    name: 'NLP Specialist',
    answers: {
      experienceLevel: 'intermediate',
      interests: ['nlp'],
      availability: '10-20h',
      budget: '$100-500',
      learningGoal: 'upskill'
    }
  },
  {
    name: 'Minimal Input',
    answers: {
      experienceLevel: 'beginner',
      interests: ['machine-learning']
    }
  }
];

/**
 * Make single API request
 */
function makeRequest(scenario, index) {
  return new Promise((resolve, reject) => {
    const userId = 5000 + index;
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' });

    const requestBody = JSON.stringify({ answers: scenario.answers });
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
            index,
            scenario: scenario.name,
            status: res.statusCode,
            duration,
            response,
            success: res.statusCode === 200
          });
        } catch (error) {
          resolve({
            index,
            scenario: scenario.name,
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
      const duration = Date.now() - startTime;
      reject({
        index,
        scenario: scenario.name,
        duration,
        error: error.message
      });
    });

    req.write(requestBody);
    req.end();
  });
}

/**
 * Run load test
 */
async function runLoadTest() {
  console.log('🧪 Simple Load Test: 10 Concurrent Requests');
  console.log('Testing system stability and performance under load\n');

  const startTime = Date.now();

  // Launch all 10 requests concurrently
  console.log('Launching 10 concurrent requests...');
  const promises = testScenarios.map((scenario, index) =>
    makeRequest(scenario, index + 1).catch(error => ({
      index: index + 1,
      scenario: scenario.name,
      success: false,
      error: error.error || error.message,
      duration: error.duration || 0
    }))
  );

  // Wait for all to complete
  const results = await Promise.all(promises);
  const totalDuration = Date.now() - startTime;

  // Calculate statistics
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  const durations = successful.map(r => r.duration);
  const avgDuration = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;
  const minDuration = durations.length > 0 ? Math.min(...durations) : 0;
  const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;

  // Results summary
  console.log('\n' + '='.repeat(80));
  console.log('LOAD TEST RESULTS');
  console.log('='.repeat(80));

  console.log(`\nTotal Time: ${totalDuration}ms (wall clock)`);
  console.log(`Successful: ${successful.length}/10 (${Math.round(successful.length/10*100)}%)`);
  console.log(`Failed: ${failed.length}/10 (${Math.round(failed.length/10*100)}%)`);

  if (successful.length > 0) {
    console.log(`\nResponse Times:`);
    console.log(`  Average: ${avgDuration}ms`);
    console.log(`  Min: ${minDuration}ms`);
    console.log(`  Max: ${maxDuration}ms`);
    console.log(`  Throughput: ${Math.round(successful.length / (totalDuration / 1000))} req/sec`);
  }

  // Detailed results
  console.log('\n' + '='.repeat(80));
  console.log('DETAILED RESULTS');
  console.log('='.repeat(80) + '\n');

  results.sort((a, b) => a.index - b.index).forEach(result => {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} [${result.index}] ${result.scenario}`);
    if (result.success) {
      console.log(`   Status: ${result.status} | Duration: ${result.duration}ms`);
      const topRec = result.response.recommendations?.[0];
      if (topRec) {
        console.log(`   Top Match: ${topRec.pathTitle} (${topRec.matchScore})`);
      }
    } else {
      console.log(`   Error: ${result.error || 'Unknown'}`);
    }
  });

  // Verdict
  console.log('\n' + '='.repeat(80));
  if (successful.length === 10) {
    console.log('✅ VERDICT: Load test passed! System stable under concurrent load.');
    console.log(`   All 10 requests succeeded with avg ${avgDuration}ms response time.`);
  } else if (successful.length >= 8) {
    console.log(`⚠️  VERDICT: ${successful.length}/10 requests succeeded. Minor stability issues.`);
  } else {
    console.log(`❌ VERDICT: ${successful.length}/10 succeeded. System unstable under load.`);
  }
  console.log('='.repeat(80));

  process.exit(successful.length >= 8 ? 0 : 1);
}

// Run test
runLoadTest().catch(console.error);
