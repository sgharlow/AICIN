#!/usr/bin/env node
/**
 * Load Testing Script for AICIN Multi-Agent System
 * Tests scalability and performance under load
 */

const https = require('https');
const jwt = require('jsonwebtoken');

// Configuration
const JWT_SECRET = process.env.TEST_JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ ERROR: TEST_JWT_SECRET environment variable is required');
  console.log('Set it with: export TEST_JWT_SECRET="your-test-secret"');
  console.log('Generate a secret: openssl rand -base64 32');
  process.exit(1);
}

const ORCHESTRATOR_URL = 'orchestrator-239116109469.us-west1.run.app';
const API_PATH = '/api/v1/quiz/score';

// Test configuration
const config = {
  warmupRequests: 5,        // Warm up instances first
  concurrentUsers: 10,      // Concurrent requests
  totalRequests: 50,        // Total requests to send
  requestDelay: 100,        // Delay between batches (ms)
};

// Test data
const testData = {
  answers: {
    learningGoal: 'data_science',
    experienceLevel: 'intermediate',
    interests: ['machine-learning', 'statistics'],
    availability: '10-20h',
    budget: '$100-500',
    learningStyle: 'hands-on',
    industry: 'technology',
    background: 'tech',
    programming: 'intermediate',
    specialization: 'specialist',
    certification: 'nice-to-have',
    timeline: '3-6-months',
    priorProjects: '3-5',
    mathBackground: 'basic',
    teamPreference: 'both'
  }
};

// Statistics
const stats = {
  total: 0,
  success: 0,
  failed: 0,
  responseTimes: [],
  errors: [],
  startTime: null,
  endTime: null
};

/**
 * Make a single API request
 */
function makeRequest() {
  return new Promise((resolve) => {
    const token = jwt.sign({ userId: Math.floor(Math.random() * 1000) }, JWT_SECRET, { algorithm: 'HS256' });
    const postData = JSON.stringify(testData);

    const options = {
      hostname: ORCHESTRATOR_URL,
      port: 443,
      path: API_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${token}`
      }
    };

    const startTime = Date.now();

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        stats.total++;
        stats.responseTimes.push(responseTime);

        if (res.statusCode === 200) {
          stats.success++;
          resolve({ success: true, responseTime, statusCode: res.statusCode });
        } else {
          stats.failed++;
          stats.errors.push({ statusCode: res.statusCode, data });
          resolve({ success: false, responseTime, statusCode: res.statusCode, error: data });
        }
      });
    });

    req.on('error', (error) => {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      stats.total++;
      stats.failed++;
      stats.errors.push({ error: error.message });
      resolve({ success: false, responseTime, error: error.message });
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Calculate statistics
 */
function calculateStats() {
  if (stats.responseTimes.length === 0) {
    return {
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      p95: 0,
      p99: 0
    };
  }

  const sorted = [...stats.responseTimes].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / sorted.length;

  const p50Index = Math.floor(sorted.length * 0.50);
  const p95Index = Math.floor(sorted.length * 0.95);
  const p99Index = Math.floor(sorted.length * 0.99);

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: Math.round(mean),
    median: sorted[p50Index],
    p95: sorted[p95Index],
    p99: sorted[p99Index]
  };
}

/**
 * Print progress bar
 */
function printProgress(current, total) {
  const percent = Math.round((current / total) * 100);
  const filled = Math.round(percent / 2);
  const empty = 50 - filled;

  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  process.stdout.write(`\r[${bar}] ${percent}% (${current}/${total})`);
}

/**
 * Run warm-up requests
 */
async function warmUp() {
  console.log(`\n🔥 Warming up with ${config.warmupRequests} requests...`);

  for (let i = 0; i < config.warmupRequests; i++) {
    await makeRequest();
    process.stdout.write(`\r  Warm-up ${i + 1}/${config.warmupRequests}...`);
  }

  // Reset stats after warmup
  stats.total = 0;
  stats.success = 0;
  stats.failed = 0;
  stats.responseTimes = [];
  stats.errors = [];

  console.log(' ✓\n');
}

/**
 * Run load test
 */
async function runLoadTest() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         AICIN Load Testing - Google Cloud Run Hackathon     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  console.log('Configuration:');
  console.log(`  Target: https://${ORCHESTRATOR_URL}${API_PATH}`);
  console.log(`  Concurrent Users: ${config.concurrentUsers}`);
  console.log(`  Total Requests: ${config.totalRequests}`);
  console.log(`  Request Delay: ${config.requestDelay}ms\n`);

  // Warm-up phase
  await warmUp();

  // Load test phase
  console.log(`🚀 Starting load test with ${config.totalRequests} requests...\n`);
  stats.startTime = Date.now();

  const batches = Math.ceil(config.totalRequests / config.concurrentUsers);

  for (let batch = 0; batch < batches; batch++) {
    const requestsInBatch = Math.min(
      config.concurrentUsers,
      config.totalRequests - (batch * config.concurrentUsers)
    );

    const promises = [];
    for (let i = 0; i < requestsInBatch; i++) {
      promises.push(makeRequest());
    }

    await Promise.all(promises);
    printProgress(stats.total, config.totalRequests);

    // Delay between batches
    if (batch < batches - 1) {
      await new Promise(resolve => setTimeout(resolve, config.requestDelay));
    }
  }

  stats.endTime = Date.now();
  console.log('\n');

  // Print results
  printResults();
}

/**
 * Print test results
 */
function printResults() {
  const duration = (stats.endTime - stats.startTime) / 1000;
  const rps = (stats.total / duration).toFixed(2);
  const successRate = ((stats.success / stats.total) * 100).toFixed(2);
  const perfStats = calculateStats();

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                      Load Test Results                       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  console.log('Summary:');
  console.log(`  Total Requests:     ${stats.total}`);
  console.log(`  Successful:         ${stats.success} ✓`);
  console.log(`  Failed:             ${stats.failed} ${stats.failed > 0 ? '✗' : '✓'}`);
  console.log(`  Success Rate:       ${successRate}%`);
  console.log(`  Duration:           ${duration.toFixed(2)}s`);
  console.log(`  Throughput:         ${rps} req/s\n`);

  console.log('Response Times (ms):');
  console.log(`  Min:                ${perfStats.min}ms`);
  console.log(`  Max:                ${perfStats.max}ms`);
  console.log(`  Mean (Average):     ${perfStats.mean}ms`);
  console.log(`  Median (P50):       ${perfStats.median}ms`);
  console.log(`  P95:                ${perfStats.p95}ms`);
  console.log(`  P99:                ${perfStats.p99}ms\n`);

  // Performance rating
  const avgTime = perfStats.mean;
  let rating = '';
  if (avgTime < 2000) {
    rating = '⭐⭐⭐⭐⭐ Excellent';
  } else if (avgTime < 3000) {
    rating = '⭐⭐⭐⭐ Good';
  } else if (avgTime < 5000) {
    rating = '⭐⭐⭐ Acceptable';
  } else {
    rating = '⭐⭐ Needs Improvement';
  }

  console.log(`Performance Rating: ${rating}\n`);

  // Errors (if any)
  if (stats.errors.length > 0) {
    console.log('Errors:');
    const errorSummary = {};
    stats.errors.forEach(err => {
      const key = err.statusCode || err.error;
      errorSummary[key] = (errorSummary[key] || 0) + 1;
    });

    Object.entries(errorSummary).forEach(([error, count]) => {
      console.log(`  ${error}: ${count} occurrences`);
    });
    console.log('');
  }

  // Scalability assessment
  console.log('Scalability Assessment:');
  if (successRate >= 99 && avgTime < 3000) {
    console.log('  ✓ System handled load excellently');
    console.log('  ✓ Ready for production scale');
  } else if (successRate >= 95 && avgTime < 5000) {
    console.log('  ✓ System handled load well');
    console.log('  ⚠️ Some optimization opportunities');
  } else {
    console.log('  ⚠️ System struggled under load');
    console.log('  ⚠️ Requires optimization before production');
  }
  console.log('');

  // Save results to file
  saveResultsToFile();
}

/**
 * Save results to JSON file
 */
function saveResultsToFile() {
  const fs = require('fs');
  const perfStats = calculateStats();

  const results = {
    timestamp: new Date().toISOString(),
    config,
    stats: {
      total: stats.total,
      success: stats.success,
      failed: stats.failed,
      successRate: ((stats.success / stats.total) * 100).toFixed(2) + '%',
      duration: ((stats.endTime - stats.startTime) / 1000).toFixed(2) + 's',
      throughput: ((stats.total / ((stats.endTime - stats.startTime) / 1000)).toFixed(2)) + ' req/s'
    },
    responseTimes: perfStats,
    errors: stats.errors.length > 0 ? stats.errors.slice(0, 10) : []
  };

  const filename = `load-test-results-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(results, null, 2));
  console.log(`Results saved to: ${filename}\n`);
}

// Run the load test
runLoadTest().catch(error => {
  console.error('Load test failed:', error);
  process.exit(1);
});
