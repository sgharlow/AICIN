#!/usr/bin/env node
/**
 * Test if demo quiz actually works end-to-end
 */

const https = require('https');
const http = require('http');

async function testDemoQuiz() {
  console.log('🧪 Testing Demo Quiz End-to-End...\n');

  // Step 1: Get JWT from demo server
  console.log('Step 1: Getting JWT from demo server...');
  const token = await new Promise((resolve, reject) => {
    http.get('http://localhost:3000/api/demo-token', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log(`✓ Got token for user ${json.userId}`);
          resolve(json.token);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });

  // Step 2: Submit quiz to orchestrator
  console.log('\nStep 2: Submitting quiz to orchestrator...');
  const quiz = {
    answers: {
      experienceLevel: 'intermediate',
      interests: ['machine-learning', 'python'],
      availability: '10-20h',
      budget: '$100-500',
      timeline: '3-6-months',
      certification: 'nice-to-have',
      learningGoal: 'upskill',
      learningStyle: 'project-based',
      programming: 'advanced'
    }
  };

  const startTime = Date.now();
  const result = await new Promise((resolve, reject) => {
    const postData = JSON.stringify(quiz);
    const options = {
      hostname: 'orchestrator-239116109469.us-west1.run.app',
      path: '/api/v1/quiz/score',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${token}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        try {
          const json = JSON.parse(data);
          resolve({ json, responseTime, statusCode: res.statusCode });
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });

  const { json, responseTime, statusCode } = result;

  // Step 3: Validate response
  console.log(`✓ Response received in ${responseTime}ms (status: ${statusCode})\n`);

  if (statusCode !== 200) {
    console.error(`❌ ERROR: Expected status 200, got ${statusCode}`);
    console.error('Response:', json);
    process.exit(1);
  }

  if (!json.recommendations || json.recommendations.length === 0) {
    console.error('❌ ERROR: No recommendations returned');
    process.exit(1);
  }

  // Success!
  console.log('═══════════════════════════════════════════════════════');
  console.log('  ✅ DEMO QUIZ WORKS END-TO-END!');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log(`Response Time: ${responseTime}ms (${(responseTime/1000).toFixed(2)}s)`);
  console.log(`Recommendations: ${json.recommendations.length}`);
  console.log(`From Cache: ${json.fromCache || false}\n`);

  console.log('Top 3 Recommendations:');
  json.recommendations.slice(0, 3).forEach((rec, i) => {
    console.log(`  ${i + 1}. ${rec.pathTitle}`);
    console.log(`     Score: ${(rec.matchScore * 100).toFixed(0)}% | Confidence: ${rec.confidence}`);
  });

  console.log('\n✅ Demo is ready for live demonstration!\n');
}

testDemoQuiz().catch(error => {
  console.error('\n❌ Demo test failed:', error.message);
  process.exit(1);
});
