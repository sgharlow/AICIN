/**
 * Edge Case Test Suite V2
 * Tests unusual but VALID scenarios with proper enum values
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
 * Edge case scenarios with VALID enum values
 */
const edgeCases = [
  {
    id: 1,
    name: "Beginner Wanting Advanced Topics",
    description: "Beginner level but interested in advanced topics (deep learning, research)",
    expectedBehavior: "Should recommend beginner paths despite advanced interests",
    risk: "System might prioritize interests over experience level",
    answers: {
      experienceLevel: 'beginner',
      interests: ['deep-learning', 'computer-vision', 'research'],
      availability: '10-20h',
      budget: '$500+',
      timeline: '3-6-months'
    }
  },
  {
    id: 2,
    name: "Advanced User with Zero Budget",
    description: "Expert wanting specialized training but zero budget",
    expectedBehavior: "Should filter to free advanced paths or provide warning",
    risk: "Might recommend expensive paths ignoring budget constraint",
    answers: {
      experienceLevel: 'advanced',
      interests: ['deep-learning', 'nlp'],
      availability: '20+h',
      budget: '$0', // Zero budget
      timeline: '3-6-months',
      programming: 'advanced',
      mathBackground: 'advanced'
    }
  },
  {
    id: 3,
    name: "Minimal Time Commitment",
    description: "User with only 0-5 hours per week available",
    expectedBehavior: "Should recommend shorter paths or warn about time constraints",
    risk: "Might recommend paths requiring more time than available",
    answers: {
      experienceLevel: 'intermediate',
      interests: ['machine-learning'],
      availability: '0-5h', // Very limited time
      budget: '$100-500',
      timeline: 'flexible'
    }
  },
  {
    id: 4,
    name: "Urgent Timeline with Limited Availability",
    description: "Wants results ASAP but only 5-10 hours/week available",
    expectedBehavior: "Should recommend focused paths or warn about timeline constraints",
    risk: "Conflicting requirements might produce poor recommendations",
    answers: {
      experienceLevel: 'beginner',
      interests: ['machine-learning'],
      availability: '5-10h',
      budget: '$100-500',
      timeline: 'asap', // Urgent
      certification: 'required'
    }
  },
  {
    id: 5,
    name: "Expert with No Programming",
    description: "Advanced ML knowledge but no programming experience",
    expectedBehavior: "Should balance advanced ML with programming prerequisites",
    risk: "Might recommend paths that assume programming skills",
    answers: {
      experienceLevel: 'advanced',
      interests: ['deep-learning', 'research'],
      availability: '20+h',
      budget: '$500+',
      programming: 'none', // No programming!
      mathBackground: 'advanced'
    }
  },
  {
    id: 6,
    name: "Very Broad Interests",
    description: "Interested in 6+ different AI topics",
    expectedBehavior: "Should recommend comprehensive/journey paths",
    risk: "Might struggle to prioritize, give generic results",
    answers: {
      experienceLevel: 'intermediate',
      interests: ['machine-learning', 'deep-learning', 'nlp', 'computer-vision', 'robotics', 'ethics'],
      availability: '10-20h',
      budget: '$100-500'
    }
  },
  {
    id: 7,
    name: "Single Narrow Focus",
    description: "Only interested in one specific topic (NLP)",
    expectedBehavior: "Should recommend NLP-specific paths",
    risk: "Limited paths available, might give generic ML",
    answers: {
      experienceLevel: 'intermediate',
      interests: ['nlp'], // Single interest
      availability: '10-20h',
      budget: '$100-500',
      learningGoal: 'upskill'
    }
  },
  {
    id: 8,
    name: "Career Switch with No Background",
    description: "Complete beginner wanting career switch",
    expectedBehavior: "Should recommend comprehensive beginner career paths",
    risk: "Might underestimate preparation needed",
    answers: {
      experienceLevel: 'beginner',
      interests: ['machine-learning', 'career'],
      availability: '20+h',
      budget: '$500+',
      learningGoal: 'career-switch',
      programming: 'none',
      mathBackground: 'minimal'
    }
  },
  {
    id: 9,
    name: "Certification Seeker with Minimal Budget",
    description: "Needs certification but has minimal budget",
    expectedBehavior: "Should find affordable certified paths or warn",
    risk: "Certifications usually cost money - might fail to match",
    answers: {
      experienceLevel: 'intermediate',
      interests: ['machine-learning'],
      availability: '10-20h',
      budget: '$0-100', // Low budget
      certification: 'required', // But needs cert!
      learningGoal: 'certification'
    }
  },
  {
    id: 10,
    name: "Exploration Mode with High Resources",
    description: "Just exploring but has unlimited time and money",
    expectedBehavior: "Should provide diverse exploratory paths",
    risk: "Might over-recommend expensive/long paths",
    answers: {
      experienceLevel: 'beginner',
      interests: ['machine-learning', 'ai'],
      availability: '20+h',
      budget: '$500+',
      learningGoal: 'exploration', // Just exploring
      timeline: 'flexible'
    }
  }
];

/**
 * Make API request
 */
function makeRequest(testCase) {
  return new Promise((resolve, reject) => {
    const userId = 1000 + testCase.id;
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' });

    const requestBody = JSON.stringify({ answers: testCase.answers });
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
            testCase,
            status: res.statusCode,
            duration,
            response,
            success: res.statusCode === 200
          });
        } catch (error) {
          resolve({
            testCase,
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
        testCase,
        error: error.message
      });
    });

    req.write(requestBody);
    req.end();
  });
}

/**
 * Run all edge case tests
 */
async function runTests() {
  console.log('🧪 Edge Case Test Suite V2 (Valid Enum Values)');
  console.log('Testing 10 challenging scenarios with proper data\n');

  const results = [];

  for (const testCase of edgeCases) {
    process.stdout.write(`\n[${testCase.id}/10] ${testCase.name}... `);

    try {
      const result = await makeRequest(testCase);
      results.push(result);

      if (result.success) {
        console.log(`✓ HTTP ${result.status}`);
      } else {
        console.log(`✗ HTTP ${result.status}`);
      }
    } catch (error) {
      console.log(`✗ ${error.message || error.error}`);
      results.push({
        testCase,
        success: false,
        error: error.message || error.error
      });
    }

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('EDGE CASE TEST RESULTS');
  console.log('='.repeat(80));

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\nPass Rate: ${passed}/10 (${Math.round(passed/10*100)}%)`);
  console.log(`Fail Rate: ${failed}/10 (${Math.round(failed/10*100)}%)`);

  // Grade distribution
  const grades = { excellent: 0, good: 0, acceptable: 0, poor: 0 };
  results.filter(r => r.success).forEach(r => {
    const score = r.response.recommendations?.[0]?.matchScore || 0;
    if (score >= 0.90) grades.excellent++;
    else if (score >= 0.80) grades.good++;
    else if (score >= 0.70) grades.acceptable++;
    else grades.poor++;
  });

  console.log('\nGrade Distribution:');
  console.log(`  Excellent (≥0.90): ${grades.excellent}/10`);
  console.log(`  Good (0.80-0.89): ${grades.good}/10`);
  console.log(`  Acceptable (0.70-0.79): ${grades.acceptable}/10`);
  console.log(`  Poor (<0.70): ${grades.poor}/10`);

  // Detailed results
  console.log('\n' + '='.repeat(80));
  console.log('DETAILED RESULTS');
  console.log('='.repeat(80) + '\n');

  results.forEach((result, i) => {
    const tc = result.testCase;
    console.log(`[${tc.id}] ${tc.name}`);
    console.log(`Expected: ${tc.expectedBehavior}`);
    console.log(`Risk: ${tc.risk}`);

    if (result.success) {
      const top = result.response.recommendations?.[0];
      console.log(`✅ SUCCESS: HTTP ${result.status} in ${result.duration}ms`);
      if (top) {
        console.log(`   Top Match: ${top.pathTitle}`);
        console.log(`   Score: ${top.matchScore} | Confidence: ${top.confidence}`);
      }
      if (result.response.warnings?.length > 0) {
        console.log(`   Warnings: ${result.response.warnings.length}`);
      }
    } else {
      console.log(`❌ ERROR: HTTP ${result.status}`);
      if (result.response?.error) {
        console.log(`   ${result.response.error}: ${result.response.message}`);
      }
    }
    console.log();
  });

  // Verdict
  console.log('='.repeat(80));
  if (passed === 10) {
    console.log('✅ VERDICT: All edge cases handled gracefully!');
  } else if (passed >= 7) {
    console.log(`⚠️  VERDICT: ${passed}/10 edge cases handled. Some issues remain.`);
  } else {
    console.log(`❌ VERDICT: ${passed}/10 passed. Significant edge case handling issues.`);
  }
  console.log('='.repeat(80));

  process.exit(passed === 10 ? 0 : 1);
}

// Run tests
runTests().catch(console.error);
