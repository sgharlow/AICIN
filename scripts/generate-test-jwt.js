#!/usr/bin/env node
/**
 * AICIN - Generate Test JWT Token
 * Creates a test JWT token for API authentication testing
 */

const crypto = require('crypto');

// Generate a simple JWT token for testing
// In production, this would use the actual JWT_SECRET from Secret Manager
function generateTestJWT(userId = 'test_user_001', expiresIn = '24h') {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const payload = {
    userId: userId,
    email: 'test@example.com',
    role: 'user',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
  };

  // Base64 URL encode
  const base64UrlEncode = (obj) => {
    return Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  const headerEncoded = base64UrlEncode(header);
  const payloadEncoded = base64UrlEncode(payload);

  // For testing, use a simple secret
  // In production, this would match the JWT_SECRET in Secret Manager
  const secret = process.env.JWT_SECRET || 'test-secret-key-for-development';

  // Create signature
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${headerEncoded}.${payloadEncoded}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const token = `${headerEncoded}.${payloadEncoded}.${signature}`;

  return {
    token,
    header,
    payload,
    expiresAt: new Date(payload.exp * 1000).toISOString()
  };
}

// Main execution
if (require.main === module) {
  const userId = process.argv[2] || 'test_user_001';

  console.log('\n🔐 AICIN Test JWT Generator\n');

  const jwt = generateTestJWT(userId);

  console.log('User ID:', jwt.payload.userId);
  console.log('Email:', jwt.payload.email);
  console.log('Expires:', jwt.expiresAt);
  console.log('');
  console.log('JWT Token:');
  console.log(jwt.token);
  console.log('');
  console.log('Usage:');
  console.log(`curl -X POST https://orchestrator-n6oitfxdra-uw.a.run.app/api/v1/quiz/score \\`);
  console.log(`  -H "Authorization: Bearer ${jwt.token}" \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d @examples/sample-quiz.json`);
  console.log('');
}

module.exports = { generateTestJWT };
