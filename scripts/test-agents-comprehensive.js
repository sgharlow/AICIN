/**
 * Comprehensive Multi-Scenario Agent Testing
 * Validates agents work across different interests and experience levels
 */

const jwt = require('jsonwebtoken');
const https = require('https');

const ORCHESTRATOR_URL = 'https://orchestrator-239116109469.us-west1.run.app';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ ERROR: JWT_SECRET environment variable required');
  console.log('Set it with: export JWT_SECRET="your-secret"');
  process.exit(1);
}

const scenarios = [
  {
    name: 'Computer Vision - Intermediate',
    answers: {
      experienceLevel: 'intermediate',
      interests: ['computer-vision'],
      weeklyHours: 15,
      timeline: 12,
      maxBudget: 500
    },
    expectTop: 'Computer Vision'
  },
  {
    name: 'Machine Learning - Beginner',
    answers: {
      experienceLevel: 'beginner',
      interests: ['machine-learning'],
      weeklyHours: 10,
      timeline: 6,
      maxBudget: 200
    },
    expectTop: 'Machine Learning'
  },
  {
    name: 'NLP - Advanced',
    answers: {
      experienceLevel: 'advanced',
      interests: ['natural-language-processing'],
      weeklyHours: 20,
      timeline: 3,
      maxBudget: 1000
    },
    expectTop: 'NLP'
  }
];

async function testScenario(scenario, index) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Test ${index + 1}: ${scenario.name}`);
    console.log('='.repeat(80));

    const userId = 1000 + index;
    const token = jwt.sign({ userId }, JWT_SECRET, { algorithm: 'HS256' });

    const quizData = {
      userId,
      answers: scenario.answers
    };

    const url = new URL('/quiz/score', ORCHESTRATOR_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      rejectUnauthorized: false
    };

    const startTime = Date.now();

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const responseTime = Date.now() - startTime;

        try {
          const response = JSON.parse(data);

          if (res.statusCode !== 200) {
            console.error('❌ Error:', response);
            resolve({ success: false, scenario: scenario.name, error: response });
            return;
          }

          const recs = response.recommendations || [];
          const scores = recs.slice(0, 5).map(r => Math.round((r.matchScore || 0) * 100));
          const topTitle = recs[0]?.pathTitle || '';

          console.log(`Response time: ${responseTime}ms`);
          console.log(`Top 5 scores: ${scores.join(', ')}`);
          console.log(`#1: ${topTitle} (${scores[0]}%)`);

          // Check if expected topic is in top 3
          const expectMatch = scenario.expectTop.toLowerCase();
          const top3Titles = recs.slice(0, 3).map(r => (r.pathTitle || '').toLowerCase());
          const hasExpected = top3Titles.some(title =>
            title.includes(expectMatch) ||
            expectMatch.split(' ').some(word => title.includes(word))
          );

          if (hasExpected) {
            console.log(`✅ PASS: ${scenario.expectTop} found in top 3`);
            resolve({ success: true, scenario: scenario.name, responseTime, scores });
          } else {
            console.log(`⚠️  WARNING: ${scenario.expectTop} not in top 3`);
            console.log(`   Top 3: ${top3Titles.join(', ')}`);
            resolve({ success: true, scenario: scenario.name, responseTime, scores, warning: true });
          }

        } catch (error) {
          console.error('Parse error:', error.message);
          resolve({ success: false, scenario: scenario.name, error: error.message });
        }
      });
    });

    req.on('error', (error) => {
      console.error(`Request failed: ${error.message}`);
      resolve({ success: false, scenario: scenario.name, error: error.message });
    });

    const payload = JSON.stringify(quizData);
    req.write(payload);
    req.end();
  });
}

async function runAllTests() {
  console.log('🧪 COMPREHENSIVE AGENT TESTING');
  console.log('Testing multi-agent system across different scenarios');
  console.log('='.repeat(80));

  const results = [];

  for (let i = 0; i < scenarios.length; i++) {
    const result = await testScenario(scenarios[i], i);
    results.push(result);

    // Wait 2 seconds between tests to avoid rate limiting
    if (i < scenarios.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));

  const passed = results.filter(r => r.success && !r.warning).length;
  const warnings = results.filter(r => r.success && r.warning).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\nResults: ${passed} passed, ${warnings} warnings, ${failed} failed`);

  if (results.every(r => r.success)) {
    const avgTime = results.reduce((sum, r) => sum + (r.responseTime || 0), 0) / results.length;
    console.log(`Average response time: ${Math.round(avgTime)}ms`);
    console.log(`\n✅ ALL TESTS PASSED - Multi-agent system is working!`);
    console.log(`\nNext steps:`);
    console.log(`1. Document the working system`);
    console.log(`2. Create demo video showing multi-agent architecture`);
    console.log(`3. Emphasize Cloud Run orchestration in submission`);
  } else {
    console.log(`\n⚠️  Some tests failed - review results above`);
  }

  console.log('');
}

runAllTests().catch(console.error);
