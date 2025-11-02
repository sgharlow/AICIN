#!/usr/bin/env node
/**
 * AICIN - Health Check Test Script
 * Tests all Cloud Run service health endpoints
 */

const https = require('https');

const services = [
  { name: 'orchestrator', url: 'https://orchestrator-n6oitfxdra-uw.a.run.app' },
  { name: 'profile-analyzer', url: 'https://profile-analyzer-n6oitfxdra-uw.a.run.app' },
  { name: 'content-matcher', url: 'https://content-matcher-n6oitfxdra-uw.a.run.app' },
  { name: 'path-optimizer', url: 'https://path-optimizer-n6oitfxdra-uw.a.run.app' },
  { name: 'course-validator', url: 'https://course-validator-n6oitfxdra-uw.a.run.app' },
  { name: 'recommendation-builder', url: 'https://recommendation-builder-n6oitfxdra-uw.a.run.app' }
];

async function testHealth(service) {
  return new Promise((resolve, reject) => {
    const healthUrl = `${service.url}/health`;

    https.get(healthUrl, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`✓ ${service.name.padEnd(25)} HEALTHY (${res.statusCode})`);
          resolve({ service: service.name, status: 'healthy', code: res.statusCode });
        } else {
          console.log(`✗ ${service.name.padEnd(25)} UNHEALTHY (${res.statusCode})`);
          resolve({ service: service.name, status: 'unhealthy', code: res.statusCode });
        }
      });
    }).on('error', (err) => {
      console.log(`✗ ${service.name.padEnd(25)} ERROR: ${err.message}`);
      reject({ service: service.name, status: 'error', error: err.message });
    });
  });
}

async function runHealthChecks() {
  console.log('\n🔍 Testing Cloud Run Service Health...\n');

  const results = [];

  for (const service of services) {
    try {
      const result = await testHealth(service);
      results.push(result);
    } catch (error) {
      results.push(error);
    }
  }

  console.log('\n✅ Health check complete!\n');

  const healthy = results.filter(r => r.status === 'healthy').length;
  const total = results.length;

  console.log(`Summary: ${healthy}/${total} services healthy\n`);

  process.exit(healthy === total ? 0 : 1);
}

runHealthChecks();
