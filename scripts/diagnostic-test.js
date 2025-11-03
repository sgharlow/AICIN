/**
 * Diagnostic Test - Run single request and trace all logs
 */

const https = require('https');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.TEST_JWT_SECRET;

if (!JWT_SECRET) {
  console.error('❌ ERROR: TEST_JWT_SECRET environment variable is required');
  process.exit(1);
}

console.log('🔬 Running diagnostic test with unique correlation ID...\n');

const userId = 9999;
const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' });

const testPayload = {
  answers: {
    experienceLevel: 'intermediate',
    interests: ['machine-learning', 'deep-learning'],
    availability: '10-20h',
    budget: '$100-500',
    programming: 'intermediate'
  }
};

const requestBody = JSON.stringify(testPayload);
const startTime = Date.now();

console.log(`Starting request at ${new Date().toISOString()}`);
console.log(`User ID: ${userId}`);
console.log(`Payload:`, JSON.stringify(testPayload, null, 2));
console.log('\nWaiting for response...\n');

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
    console.log(`Response received after ${duration}ms`);
    console.log(`Status: ${res.statusCode}\n`);

    try {
      const response = JSON.parse(data);
      console.log('Correlation ID:', response.correlationId);
      console.log('Processing Time:', response.processingTimeMs, 'ms');
      console.log('Recommendations:', response.recommendations?.length || 0);

      if (response.recommendations?.[0]) {
        console.log('Top Match:', response.recommendations[0].pathTitle);
        console.log('Score:', response.recommendations[0].matchScore);
      }

      console.log('\n✅ Test complete. Now check logs for correlation ID:', response.correlationId);
      console.log('\nRun this command to see all logs:');
      console.log(`gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=orchestrator AND textPayload:${response.correlationId}" --limit=50 --project=aicin-477004`);
    } catch (error) {
      console.error('❌ Error parsing response:', error.message);
      console.log('Raw response:', data.substring(0, 500));
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
  process.exit(1);
});

req.write(requestBody);
req.end();
