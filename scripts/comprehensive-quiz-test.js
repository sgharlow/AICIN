#!/usr/bin/env node
/**
 * Comprehensive Quiz Test Suite
 * Tests various user personas to assess recommendation quality
 */

const jwt = require('jsonwebtoken');
const https = require('https');

// IMPORTANT: This is a TEST SECRET for generating test JWTs
// Production uses Google Secret Manager (aicin-jwt-secret)
const JWT_SECRET = process.env.TEST_JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ ERROR: TEST_JWT_SECRET environment variable is required');
  console.log('Set it with: export TEST_JWT_SECRET="your-test-secret"');
  console.log('Generate a secret: openssl rand -base64 32');
  process.exit(1);
}

const ORCHESTRATOR_URL = 'https://orchestrator-239116109469.us-west1.run.app/api/v1/quiz/score';

// Test personas representing real user scenarios
const testPersonas = [
  {
    name: 'Healthcare to AI Specialist (Beginner)',
    description: 'Healthcare professional with no tech background wanting to transition to AI',
    answers: {
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
    }
  },
  {
    name: 'Software Developer Upskilling (Intermediate)',
    description: 'Mid-level developer wanting to add ML to skillset',
    answers: {
      learningGoal: 'upskill',
      experienceLevel: 'intermediate',
      interests: ['machine-learning', 'deep-learning', 'nlp'],
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
    }
  },
  {
    name: 'Data Scientist Going Deep (Advanced)',
    description: 'Experienced data scientist wanting advanced ML specialization',
    answers: {
      learningGoal: 'specialize',
      experienceLevel: 'advanced',
      interests: ['deep-learning', 'computer-vision', 'research'],
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
  },
  {
    name: 'Business Analyst to Data Analyst (Beginner-Intermediate)',
    description: 'Business analyst wanting to become data-driven',
    answers: {
      learningGoal: 'career-switch',
      experienceLevel: 'beginner',
      interests: ['data-science', 'statistics', 'business-intelligence'],
      availability: '10-20h',
      budget: '$100-500',
      learningStyle: 'hands-on',
      industry: 'business',
      background: 'non-tech',
      programming: 'beginner',
      specialization: 'generalist',
      certification: 'required',
      timeline: '6-12-months',
      priorProjects: '0',
      mathBackground: 'intermediate',
      teamPreference: 'collaborative'
    }
  },
  {
    name: 'Student Exploring AI (Beginner)',
    description: 'University student exploring AI career options',
    answers: {
      learningGoal: 'explore',
      experienceLevel: 'beginner',
      interests: ['machine-learning', 'ai-fundamentals', 'python'],
      availability: '5-10h',
      budget: '$0',
      learningStyle: 'video-based',
      industry: 'education',
      background: 'student',
      programming: 'intermediate',
      specialization: 'generalist',
      certification: 'nice-to-have',
      timeline: '3-6-months',
      priorProjects: '1-2',
      mathBackground: 'basic',
      teamPreference: 'both'
    }
  }
];

/**
 * Make API request for a persona
 */
async function testPersona(persona, index) {
  return new Promise((resolve) => {
    const token = jwt.sign({ userId: 1000 + index }, JWT_SECRET, { algorithm: 'HS256' });
    const postData = JSON.stringify({ answers: persona.answers });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${token}`
      }
    };

    const startTime = Date.now();

    const req = https.request(ORCHESTRATOR_URL, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const responseTime = Date.now() - startTime;

        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data);
            resolve({
              success: true,
              persona: persona.name,
              description: persona.description,
              responseTime,
              recommendations: response.recommendations || [],
              processingTimeMs: response.processingTimeMs,
              fromCache: response.fromCache || false
            });
          } catch (error) {
            resolve({
              success: false,
              persona: persona.name,
              error: 'Failed to parse response',
              responseTime
            });
          }
        } else {
          resolve({
            success: false,
            persona: persona.name,
            statusCode: res.statusCode,
            error: data,
            responseTime
          });
        }
      });
    });

    req.on('error', (error) => {
      resolve({
        success: false,
        persona: persona.name,
        error: error.message
      });
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Analyze recommendations quality
 */
function analyzeRecommendations(result) {
  if (!result.success || !result.recommendations || result.recommendations.length === 0) {
    return {
      quality: 'FAILED',
      score: 0,
      issues: ['No recommendations generated']
    };
  }

  const issues = [];
  let score = 100;

  // Check if recommendations have scores
  const hasScores = result.recommendations.some(rec => rec.matchScore != null && rec.matchScore !== 'N/A');
  if (!hasScores) {
    issues.push('Missing match scores');
    score -= 30;
  }

  // Check if recommendations have match reasons
  const hasReasons = result.recommendations.every(rec =>
    rec.matchReasons && rec.matchReasons.length > 0
  );
  if (!hasReasons) {
    issues.push('Missing match reasons');
    score -= 20;
  }

  // Check confidence levels
  const hasConfidence = result.recommendations.every(rec => rec.confidence);
  if (!hasConfidence) {
    issues.push('Missing confidence levels');
    score -= 10;
  }

  // Check if we got expected number of recommendations
  if (result.recommendations.length < 5) {
    issues.push(`Only ${result.recommendations.length} recommendations (expected 5)`);
    score -= 10;
  }

  // Check response time
  if (result.responseTime > 5000) {
    issues.push(`Slow response (${(result.responseTime / 1000).toFixed(1)}s)`);
    score -= 10;
  }

  let quality = 'EXCELLENT';
  if (score < 90) quality = 'GOOD';
  if (score < 70) quality = 'FAIR';
  if (score < 50) quality = 'POOR';

  return { quality, score, issues };
}

/**
 * Print test results
 */
function printResults(results) {
  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║           COMPREHENSIVE QUIZ TEST RESULTS                           ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  let totalSuccess = 0;
  let totalScore = 0;
  const allResponseTimes = [];

  results.forEach((result, index) => {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`TEST ${index + 1}: ${result.persona}`);
    console.log(`Description: ${result.description}`);
    console.log(`${'='.repeat(70)}`);

    if (result.success) {
      totalSuccess++;
      allResponseTimes.push(result.responseTime);

      const analysis = analyzeRecommendations(result);
      totalScore += analysis.score;

      console.log(`\n✓ Status: SUCCESS`);
      console.log(`  Response Time: ${result.responseTime}ms`);
      console.log(`  Processing Time: ${result.processingTimeMs}ms`);
      console.log(`  From Cache: ${result.fromCache}`);
      console.log(`  Recommendations: ${result.recommendations.length}`);
      console.log(`  Quality: ${analysis.quality} (${analysis.score}/100)`);

      if (analysis.issues.length > 0) {
        console.log(`  Issues: ${analysis.issues.join(', ')}`);
      }

      console.log(`\n  Top 3 Recommendations:`);
      result.recommendations.slice(0, 3).forEach((rec, i) => {
        const score = rec.matchScore != null ? rec.matchScore.toFixed(2) : 'N/A';
        console.log(`    ${i + 1}. ${rec.pathTitle || 'Unknown'}`);
        console.log(`       Score: ${score} | Confidence: ${rec.confidence || 'N/A'}`);
        if (rec.matchReasons && rec.matchReasons.length > 0) {
          const firstReason = rec.matchReasons[0];
          const reasonText = typeof firstReason === 'object' ? firstReason.reason : firstReason;
          console.log(`       Reason: ${reasonText}`);
        }
      });
    } else {
      console.log(`\n✗ Status: FAILED`);
      console.log(`  Error: ${result.error}`);
      if (result.statusCode) {
        console.log(`  Status Code: ${result.statusCode}`);
      }
    }
  });

  // Overall summary
  console.log(`\n\n${'═'.repeat(70)}`);
  console.log('OVERALL SUMMARY');
  console.log(`${'═'.repeat(70)}`);

  const successRate = (totalSuccess / results.length * 100).toFixed(1);
  const avgScore = totalSuccess > 0 ? (totalScore / totalSuccess).toFixed(1) : 0;
  const avgResponseTime = allResponseTimes.length > 0
    ? (allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length).toFixed(0)
    : 0;

  console.log(`\nSuccess Rate: ${successRate}% (${totalSuccess}/${results.length})`);
  console.log(`Average Quality Score: ${avgScore}/100`);
  console.log(`Average Response Time: ${avgResponseTime}ms`);

  if (allResponseTimes.length > 0) {
    const minTime = Math.min(...allResponseTimes);
    const maxTime = Math.max(...allResponseTimes);
    console.log(`  Min: ${minTime}ms | Max: ${maxTime}ms`);
  }

  // Final verdict
  console.log('\n');
  if (successRate >= 100 && avgScore >= 80) {
    console.log('🎉 VERDICT: PRODUCTION READY');
    console.log('   All personas tested successfully with good quality');
  } else if (successRate >= 80 && avgScore >= 60) {
    console.log('⚠️  VERDICT: MOSTLY READY');
    console.log('   Most personas work but some quality issues need addressing');
  } else {
    console.log('❌ VERDICT: NEEDS WORK');
    console.log('   Significant issues found - not ready for production');
  }

  console.log('\n');
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🚀 Starting Comprehensive Quiz Test Suite\n');
  console.log(`Testing ${testPersonas.length} different user personas...`);
  console.log('This will help assess if AICIN can replace the current quiz system.\n');

  const results = [];

  for (let i = 0; i < testPersonas.length; i++) {
    process.stdout.write(`\nTesting persona ${i + 1}/${testPersonas.length}: ${testPersonas[i].name}...`);
    const result = await testPersona(testPersonas[i], i);
    results.push(result);
    console.log(result.success ? ' ✓' : ' ✗');

    // Small delay between requests to avoid overwhelming the system
    if (i < testPersonas.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  printResults(results);
}

// Run tests
runTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
