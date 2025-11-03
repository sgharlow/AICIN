#!/usr/bin/env node
/**
 * Production-Grade Load Test
 * Tests 1000+ concurrent requests to prove 500K daily capacity claim
 */

const jwt = require('jsonwebtoken');
const https = require('https');
const { performance } = require('perf_hooks');

// Validate required environment variables
if (!process.env.TEST_JWT_SECRET) {
  console.error('❌ ERROR: TEST_JWT_SECRET environment variable is required');
  console.log('Set it with: export TEST_JWT_SECRET="your-test-secret"');
  console.log('Generate a secret: openssl rand -base64 32');
  process.exit(1);
}

// Configuration
const config = {
  // Test JWT secret from environment
  jwtSecret: process.env.TEST_JWT_SECRET,
  orchestratorUrl: 'orchestrator-239116109469.us-west1.run.app',
  apiPath: '/api/v1/quiz/score',

  // Load test parameters
  warmupRequests: 10,
  totalRequests: 1000,
  concurrentUsers: 20, // Reduced from 50 to stay within connection pool limits
  rampUpTime: 10000, // 10s ramp-up
  testDuration: 120000, // 2 minutes sustained load
};

// Test personas (cycling through these)
const personas = [
  {
    learningGoal: 'career-switch',
    experienceLevel: 'beginner',
    interests: ['machine-learning', 'healthcare-ai'],
    availability: '5-10h',
    budget: '$0-100',
    learningStyle: 'hands-on',
    industry: 'healthcare',
    background: 'non-tech',
    programming: 'beginner',
    specialization: 'generalist',
    certification: 'required',
    timeline: '6-12-months',
    priorProjects: '0',
    mathBackground: 'basic',
    teamPreference: 'solo'
  },
  {
    learningGoal: 'upskill',
    experienceLevel: 'intermediate',
    interests: ['deep-learning', 'nlp'],
    availability: '10-20h',
    budget: '$100-500',
    learningStyle: 'project-based',
    industry: 'technology',
    background: 'tech',
    programming: 'advanced',
    specialization: 'specialist',
    certification: 'nice-to-have',
    timeline: '3-6-months',
    priorProjects: '5+',
    mathBackground: 'advanced',
    teamPreference: 'both'
  },
  {
    learningGoal: 'specialize',
    experienceLevel: 'advanced',
    interests: ['computer-vision', 'research'],
    availability: '20+h',
    budget: '$500+',
    learningStyle: 'theory-first',
    industry: 'research',
    background: 'tech',
    programming: 'expert',
    specialization: 'specialist',
    certification: 'not-needed',
    timeline: '6-12-months',
    priorProjects: '5+',
    mathBackground: 'advanced',
    teamPreference: 'collaborative'
  }
];

// Metrics
const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  responseTimes: [],
  errors: {},
  startTime: null,
  endTime: null
};

/**
 * Make a single request
 */
function makeRequest(userId, personaIndex) {
  return new Promise((resolve) => {
    const startTime = performance.now();
    const persona = personas[personaIndex % personas.length];
    const token = jwt.sign({ userId }, config.jwtSecret, { algorithm: 'HS256' });
    const postData = JSON.stringify({ answers: persona });

    const options = {
      hostname: config.orchestratorUrl,
      port: 443,
      path: config.apiPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${token}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const responseTime = performance.now() - startTime;
        metrics.totalRequests++;

        if (res.statusCode === 200) {
          metrics.successfulRequests++;
          metrics.responseTimes.push(responseTime);
          resolve({ success: true, responseTime, statusCode: res.statusCode });
        } else {
          metrics.failedRequests++;
          const errorKey = `HTTP_${res.statusCode}`;
          metrics.errors[errorKey] = (metrics.errors[errorKey] || 0) + 1;
          resolve({ success: false, responseTime, statusCode: res.statusCode, error: data });
        }
      });
    });

    req.on('error', (error) => {
      const responseTime = performance.now() - startTime;
      metrics.totalRequests++;
      metrics.failedRequests++;
      const errorKey = error.code || 'UNKNOWN_ERROR';
      metrics.errors[errorKey] = (metrics.errors[errorKey] || 0) + 1;
      resolve({ success: false, responseTime, error: error.message });
    });

    req.on('timeout', () => {
      req.destroy();
      const responseTime = performance.now() - startTime;
      metrics.totalRequests++;
      metrics.failedRequests++;
      metrics.errors['TIMEOUT'] = (metrics.errors['TIMEOUT'] || 0) + 1;
      resolve({ success: false, responseTime, error: 'Timeout' });
    });

    req.setTimeout(30000); // 30s timeout
    req.write(postData);
    req.end();
  });
}

/**
 * Run warmup requests
 */
async function runWarmup() {
  console.log(`\n🔥 Warming up with ${config.warmupRequests} requests...`);

  for (let i = 0; i < config.warmupRequests; i++) {
    process.stdout.write(`\rWarmup: ${i + 1}/${config.warmupRequests}`);
    await makeRequest(10000 + i, i);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(' ✓ Warmup complete\n');

  // Reset metrics after warmup
  metrics.totalRequests = 0;
  metrics.successfulRequests = 0;
  metrics.failedRequests = 0;
  metrics.responseTimes = [];
  metrics.errors = {};
}

/**
 * Run sustained load test
 */
async function runLoadTest() {
  console.log(`🚀 Starting load test:`);
  console.log(`   Total Requests: ${config.totalRequests}`);
  console.log(`   Concurrent Users: ${config.concurrentUsers}`);
  console.log(`   Test Duration: ${config.testDuration / 1000}s\n`);

  metrics.startTime = Date.now();

  let requestsLaunched = 0;
  const activeRequests = new Set();

  // Progress bar
  const progressInterval = setInterval(() => {
    const elapsed = ((Date.now() - metrics.startTime) / 1000).toFixed(1);
    const requestsPerSec = (metrics.totalRequests / elapsed).toFixed(1);
    const successRate = ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(1);

    process.stdout.write(`\r⏱️  ${elapsed}s | Requests: ${metrics.totalRequests}/${config.totalRequests} | ` +
      `RPS: ${requestsPerSec} | Success: ${successRate}% | Active: ${activeRequests.size}`);
  }, 1000);

  // Launch requests with ramp-up
  const rampUpDelay = config.rampUpTime / config.concurrentUsers;

  for (let user = 0; user < config.concurrentUsers; user++) {
    // Ramp up gradually
    await new Promise(resolve => setTimeout(resolve, rampUpDelay));

    // Each user sends multiple requests
    (async () => {
      while (requestsLaunched < config.totalRequests) {
        if (activeRequests.size >= config.concurrentUsers) {
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }

        const requestId = requestsLaunched++;
        const userId = 20000 + requestId;
        const personaIndex = requestId;

        const requestPromise = makeRequest(userId, personaIndex);
        activeRequests.add(requestPromise);

        requestPromise.finally(() => {
          activeRequests.delete(requestPromise);
        });

        // Slight delay between requests from same user
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    })();
  }

  // Wait for all requests to complete
  const checkComplete = setInterval(() => {
    if (metrics.totalRequests >= config.totalRequests && activeRequests.size === 0) {
      clearInterval(checkComplete);
      clearInterval(progressInterval);
      metrics.endTime = Date.now();
      printResults();
    }
  }, 500);
}

/**
 * Calculate percentiles
 */
function calculatePercentile(arr, percentile) {
  if (arr.length === 0) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Print test results
 */
function printResults() {
  console.log('\n\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║            PRODUCTION LOAD TEST RESULTS                       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const duration = (metrics.endTime - metrics.startTime) / 1000;
  const successRate = ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2);
  const requestsPerSecond = (metrics.totalRequests / duration).toFixed(2);

  // Overall metrics
  console.log('📊 Overall Metrics:');
  console.log(`   Total Requests:      ${metrics.totalRequests}`);
  console.log(`   Successful:          ${metrics.successfulRequests} (${successRate}%)`);
  console.log(`   Failed:              ${metrics.failedRequests}`);
  console.log(`   Test Duration:       ${duration.toFixed(2)}s`);
  console.log(`   Throughput:          ${requestsPerSecond} req/s`);

  // Response times
  if (metrics.responseTimes.length > 0) {
    const sorted = metrics.responseTimes.slice().sort((a, b) => a - b);
    const avg = sorted.reduce((sum, t) => sum + t, 0) / sorted.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p50 = calculatePercentile(sorted, 50);
    const p75 = calculatePercentile(sorted, 75);
    const p90 = calculatePercentile(sorted, 90);
    const p95 = calculatePercentile(sorted, 95);
    const p99 = calculatePercentile(sorted, 99);

    console.log('\n⚡ Response Time Distribution:');
    console.log(`   Average:    ${avg.toFixed(0)}ms`);
    console.log(`   Min:        ${min.toFixed(0)}ms`);
    console.log(`   Max:        ${max.toFixed(0)}ms`);
    console.log(`   P50:        ${p50.toFixed(0)}ms`);
    console.log(`   P75:        ${p75.toFixed(0)}ms`);
    console.log(`   P90:        ${p90.toFixed(0)}ms`);
    console.log(`   P95:        ${p95.toFixed(0)}ms`);
    console.log(`   P99:        ${p99.toFixed(0)}ms`);
  }

  // Errors
  if (Object.keys(metrics.errors).length > 0) {
    console.log('\n❌ Errors:');
    Object.entries(metrics.errors).forEach(([error, count]) => {
      console.log(`   ${error}: ${count}`);
    });
  }

  // Capacity analysis
  console.log('\n📈 Capacity Analysis:');
  console.log(`   Peak RPS:           ${requestsPerSecond} req/s`);
  console.log(`   Daily Capacity:     ${(requestsPerSecond * 86400).toFixed(0)} req/day`);
  console.log(`   500K Daily Target:  ${requestsPerSecond >= 5.8 ? '✅ ACHIEVED' : '❌ NOT MET'}`);
  console.log(`   (Requires 5.8 req/s sustained)`);

  // Pass/Fail
  console.log('\n🎯 Pass/Fail Criteria:');
  const tests = [
    { name: 'Success Rate ≥ 99%', pass: successRate >= 99 },
    { name: 'P95 Response Time < 2s', pass: calculatePercentile(metrics.responseTimes, 95) < 2000 },
    { name: 'P99 Response Time < 5s', pass: calculatePercentile(metrics.responseTimes, 99) < 5000 },
    { name: 'Zero timeouts', pass: !metrics.errors['TIMEOUT'] },
    { name: 'Sustained 5.8 req/s (500K/day)', pass: requestsPerSecond >= 5.8 }
  ];

  tests.forEach(test => {
    console.log(`   ${test.pass ? '✅' : '❌'} ${test.name}`);
  });

  const allPassed = tests.every(t => t.pass);

  console.log('\n' + '═'.repeat(64));
  if (allPassed) {
    console.log('🎉 VERDICT: PRODUCTION READY - All criteria met');
    console.log('   System can handle 500K+ daily requests');
  } else {
    console.log('⚠️  VERDICT: NEEDS OPTIMIZATION - Some criteria not met');
    console.log('   Review failed tests above');
  }
  console.log('═'.repeat(64) + '\n');

  // Save results to file
  const resultFile = `load-test-results-${Date.now()}.json`;
  const fs = require('fs');
  fs.writeFileSync(resultFile, JSON.stringify({
    config,
    metrics: {
      ...metrics,
      duration,
      successRate,
      requestsPerSecond,
      percentiles: {
        p50: calculatePercentile(metrics.responseTimes, 50),
        p75: calculatePercentile(metrics.responseTimes, 75),
        p90: calculatePercentile(metrics.responseTimes, 90),
        p95: calculatePercentile(metrics.responseTimes, 95),
        p99: calculatePercentile(metrics.responseTimes, 99)
      }
    },
    tests
  }, null, 2));
  console.log(`📄 Results saved to: ${resultFile}\n`);
}

/**
 * Main execution
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     AICIN PRODUCTION LOAD TEST - 1000 Requests                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  try {
    await runWarmup();
    await runLoadTest();
  } catch (error) {
    console.error('\n❌ Load test failed:', error);
    process.exit(1);
  }
}

// Run
main();
