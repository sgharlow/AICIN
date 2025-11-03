/**
 * Performance Benchmark - Measure cold vs warm start performance
 */

const https = require('https');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.TEST_JWT_SECRET;

if (!JWT_SECRET) {
  console.error('❌ ERROR: TEST_JWT_SECRET environment variable is required');
  process.exit(1);
}

const testPayload = {
  answers: {
    experienceLevel: 'intermediate',
    interests: ['machine-learning', 'deep-learning'],
    availability: '10-20h',
    budget: '$100-500',
    programming: 'intermediate'
  }
};

function makeRequest() {
  return new Promise((resolve, reject) => {
    const userId = 9999 + Math.floor(Math.random() * 100);
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' });
    const requestBody = JSON.stringify(testPayload);
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
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const duration = Date.now() - startTime;
        try {
          const response = JSON.parse(data);
          resolve({
            duration,
            processingTime: response.processingTimeMs,
            status: res.statusCode,
            topScore: response.recommendations?.[0]?.matchScore
          });
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

async function runBenchmark() {
  console.log('🏃 Performance Benchmark: Cold vs Warm Start\n');
  console.log('Running 5 consecutive requests...\n');

  const results = [];

  for (let i = 1; i <= 5; i++) {
    process.stdout.write(`Test ${i}/5... `);
    try {
      const result = await makeRequest();
      results.push(result);
      console.log(`✓ ${result.duration}ms (server: ${result.processingTime}ms, score: ${result.topScore})`);

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.log(`✗ ${error.message}`);
      results.push({ error: error.message });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('BENCHMARK RESULTS');
  console.log('='.repeat(60) + '\n');

  const successful = results.filter(r => !r.error);
  const durations = successful.map(r => r.duration);
  const processingTimes = successful.map(r => r.processingTime);

  console.log(`Successful: ${successful.length}/5\n`);

  if (successful.length > 0) {
    console.log('Wall Clock Time (includes network):');
    console.log(`  Test 1 (cold start): ${durations[0]}ms`);
    console.log(`  Tests 2-5 (warm):    ${durations.slice(1).join('ms, ')}ms`);
    console.log(`  Average (all):       ${Math.round(durations.reduce((a,b) => a+b) / durations.length)}ms`);
    console.log(`  Average (warm only): ${Math.round(durations.slice(1).reduce((a,b) => a+b) / (durations.length-1))}ms`);

    console.log('\nServer Processing Time:');
    console.log(`  Test 1: ${processingTimes[0]}ms`);
    console.log(`  Tests 2-5: ${processingTimes.slice(1).join('ms, ')}ms`);
    console.log(`  Average: ${Math.round(processingTimes.reduce((a,b) => a+b) / processingTimes.length)}ms`);

    const coldVsWarm = durations[0] - Math.round(durations.slice(1).reduce((a,b) => a+b) / (durations.length-1));
    console.log(`\nCold Start Overhead: ${coldVsWarm > 0 ? '+' : ''}${coldVsWarm}ms`);
  }

  console.log('='.repeat(60));
}

runBenchmark().catch(console.error);
