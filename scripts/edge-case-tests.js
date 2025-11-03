#!/usr/bin/env node
/**
 * Edge Case Test Suite
 * Tests unusual scenarios that could break the system
 * Approach: Skeptical - prove graceful handling, don't assume
 */

const jwt = require('jsonwebtoken');
const https = require('https');

const JWT_SECRET = process.env.TEST_JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ ERROR: TEST_JWT_SECRET environment variable is required');
  process.exit(1);
}

const ORCHESTRATOR_URL = 'https://orchestrator-239116109469.us-west1.run.app/api/v1/quiz/score';

// Edge case scenarios that could break the system
const edgeCases = [
  {
    id: 1,
    name: "Beginner Wanting Only Advanced Topics",
    description: "Complete beginner (non-tech) wanting deep learning and research",
    expectedBehavior: "Should recommend beginner paths despite advanced interests",
    risk: "System might prioritize interests over experience level",
    answers: {
      learningGoal: 'career-switch',
      experienceLevel: 'beginner',
      interests: ['deep-learning', 'computer-vision', 'research'], // Advanced topics!
      availability: '10-20h',
      budget: '$100-500',
      learningStyle: 'theory-first',
      industry: 'non-tech',
      background: 'non-tech',
      programming: 'beginner', // Contradiction!
      specialization: 'specialist',
      certification: 'not-needed',
      timeline: '6-12-months',
      priorProjects: '0',
      mathBackground: 'basic',
      teamPreference: 'solo'
    }
  },
  {
    id: 2,
    name: "Advanced User with $0 Budget",
    description: "Expert wanting specialized training but zero budget",
    expectedBehavior: "Should filter to free advanced paths or flag budget constraint",
    risk: "Might recommend expensive paths ignoring budget",
    answers: {
      learningGoal: 'specialize',
      experienceLevel: 'advanced',
      interests: ['deep-learning', 'nlp'],
      availability: '20+h',
      budget: '$0', // Zero budget!
      learningStyle: 'project-based',
      industry: 'technology',
      background: 'tech',
      programming: 'expert',
      specialization: 'specialist',
      certification: 'not-needed',
      timeline: '3-6-months',
      priorProjects: '5+',
      mathBackground: 'advanced',
      teamPreference: 'collaborative'
    }
  },
  {
    id: 3,
    name: "Unrealistic Timeline vs Commitment",
    description: "Wants to master ML in 2 weeks with only 5 hours/week",
    expectedBehavior: "Should recommend paths but flag impossible timeline",
    risk: "Might recommend comprehensive paths that can't be completed",
    answers: {
      learningGoal: 'specialize',
      experienceLevel: 'intermediate',
      interests: ['machine-learning', 'deep-learning'],
      availability: '<5h', // Only 5 hours/week
      budget: '$100-500',
      learningStyle: 'hands-on',
      industry: 'technology',
      background: 'tech',
      programming: 'intermediate',
      specialization: 'specialist',
      certification: 'required',
      timeline: '<1-month', // 2 weeks! (math: 5hrs × 2 weeks = 10 total hours)
      priorProjects: '1-2',
      mathBackground: 'intermediate',
      teamPreference: 'solo'
    }
  },
  {
    id: 4,
    name: "Advanced User, Only Python Interest",
    description: "Data scientist wanting only Python basics",
    expectedBehavior: "Should recommend advanced Python or suggest broader topics",
    risk: "Level vs interest mismatch handling",
    answers: {
      learningGoal: 'upskill',
      experienceLevel: 'advanced',
      interests: ['python'], // Single basic interest
      availability: '10-20h',
      budget: '$100-500',
      learningStyle: 'hands-on',
      industry: 'technology',
      background: 'tech',
      programming: 'advanced', // Already advanced at programming!
      specialization: 'generalist',
      certification: 'not-needed',
      timeline: '3-6-months',
      priorProjects: '5+',
      mathBackground: 'advanced',
      teamPreference: 'both'
    }
  },
  {
    id: 5,
    name: "Beginner with Unlimited Resources",
    description: "Complete beginner with $10k budget and 40 hrs/week",
    expectedBehavior: "Should still recommend beginner paths (not influenced by money)",
    risk: "Might assume high budget = advanced user",
    answers: {
      learningGoal: 'career-switch',
      experienceLevel: 'beginner',
      interests: ['machine-learning', 'data-science'],
      availability: '20+h', // Full-time!
      budget: '$500+', // Unlimited!
      learningStyle: 'hands-on',
      industry: 'non-tech',
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
    id: 6,
    name: "Very Broad Interests (6 topics)",
    description: "Student wanting everything AI-related",
    expectedBehavior: "Should recommend comprehensive/journey paths",
    risk: "Might struggle to prioritize, give generic results",
    answers: {
      learningGoal: 'explore',
      experienceLevel: 'beginner',
      interests: ['machine-learning', 'deep-learning', 'nlp', 'computer-vision', 'data-science', 'python'],
      availability: '10-20h',
      budget: '$100-500',
      learningStyle: 'hands-on',
      industry: 'education',
      background: 'non-tech',
      programming: 'beginner',
      specialization: 'generalist',
      certification: 'nice-to-have',
      timeline: '12+-months',
      priorProjects: '0',
      mathBackground: 'basic',
      teamPreference: 'both'
    }
  },
  {
    id: 7,
    name: "Minimal Time (2 hours/week)",
    description: "Working professional with very limited time",
    expectedBehavior: "Should recommend shorter paths or micro-learning",
    risk: "Might recommend paths requiring 10-20 hrs/week",
    answers: {
      learningGoal: 'upskill',
      experienceLevel: 'intermediate',
      interests: ['machine-learning'],
      availability: '<5h', // Only 2 hours
      budget: '$100-500',
      learningStyle: 'reading',
      industry: 'business',
      background: 'tech',
      programming: 'intermediate',
      specialization: 'generalist',
      certification: 'not-needed',
      timeline: '12+-months', // Long timeline to compensate
      priorProjects: '1-2',
      mathBackground: 'intermediate',
      teamPreference: 'solo'
    }
  },
  {
    id: 8,
    name: "Single Interest Focus (NLP only)",
    description: "Laser-focused on NLP, nothing else",
    expectedBehavior: "Should recommend NLP-specific paths",
    risk: "Limited paths available, might give generic ML",
    answers: {
      learningGoal: 'specialize',
      experienceLevel: 'intermediate',
      interests: ['nlp'], // Only one interest
      availability: '10-20h',
      budget: '$100-500',
      learningStyle: 'project-based',
      industry: 'technology',
      background: 'tech',
      programming: 'advanced',
      specialization: 'specialist',
      certification: 'nice-to-have',
      timeline: '3-6-months',
      priorProjects: '3-4',
      mathBackground: 'intermediate',
      teamPreference: 'collaborative'
    }
  },
  {
    id: 9,
    name: "Self-Rated Intermediate, Beginner Indicators",
    description: "Says intermediate but all indicators point to beginner",
    expectedBehavior: "Should respect stated experience level",
    risk: "Might override user's self-assessment",
    answers: {
      learningGoal: 'explore',
      experienceLevel: 'intermediate', // Says intermediate
      interests: ['python'], // Basic interest
      availability: '5-10h',
      budget: '$0-100',
      learningStyle: 'hands-on',
      industry: 'non-tech', // Non-tech background
      background: 'non-tech',
      programming: 'beginner', // Beginner programming!
      specialization: 'generalist',
      certification: 'not-needed',
      timeline: '6-12-months',
      priorProjects: '0', // No projects!
      mathBackground: 'basic', // Basic math
      teamPreference: 'solo'
    }
  },
  {
    id: 10,
    name: "Cybersecurity + AI (Niche Combo)",
    description: "Security engineer wanting AI for cybersecurity",
    expectedBehavior: "Should find relevant paths or acknowledge limited options",
    risk: "No cybersecurity AI paths available → poor recommendations",
    answers: {
      learningGoal: 'upskill',
      experienceLevel: 'advanced',
      interests: ['machine-learning', 'cybersecurity'],
      availability: '10-20h',
      budget: '$100-500',
      learningStyle: 'hands-on',
      industry: 'cybersecurity',
      background: 'tech',
      programming: 'advanced',
      specialization: 'specialist',
      certification: 'required',
      timeline: '6-12-months',
      priorProjects: '5+',
      mathBackground: 'intermediate',
      teamPreference: 'solo'
    }
  }
];

async function testEdgeCase(testCase) {
  return new Promise((resolve, reject) => {
    const token = jwt.sign({ quiz: testCase.answers }, JWT_SECRET);
    const postData = JSON.stringify(testCase.answers);

    const options = {
      hostname: 'orchestrator-239116109469.us-west1.run.app',
      path: '/api/v1/quiz/score',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${token}`
      },
      timeout: 30000
    };

    const startTime = Date.now();
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const duration = Date.now() - startTime;
        try {
          const response = JSON.parse(data);
          resolve({ testCase, response, duration, statusCode: res.statusCode });
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout (30s)'));
    });

    req.write(postData);
    req.end();
  });
}

function analyzeEdgeCaseResult(testCase, response, duration) {
  const analysis = {
    passed: false,
    issues: [],
    observations: [],
    grade: 'F'
  };

  if (!response || !response.recommendations || response.recommendations.length === 0) {
    analysis.issues.push('No recommendations returned');
    return analysis;
  }

  const recs = response.recommendations.slice(0, 5);
  const levels = recs.map(r => r.path?.level?.toLowerCase()).filter(Boolean);
  const scores = recs.map(r => r.score);
  const confidences = recs.map(r => r.confidence);

  // Check based on test case
  switch (testCase.id) {
    case 1: // Beginner wanting advanced topics
      const beginnerCount = levels.filter(l => l === 'beginner').length;
      if (beginnerCount >= 3) {
        analysis.passed = true;
        analysis.observations.push(`✅ Correctly prioritized beginner level (${beginnerCount}/5)`);
        analysis.grade = 'A';
      } else {
        analysis.issues.push(`❌ Gave advanced paths to beginner (only ${beginnerCount}/5 beginner)`);
        analysis.grade = 'F';
      }
      break;

    case 2: // Advanced user with $0 budget
      // Check if recommendations respect budget (hard to verify without cost data)
      analysis.observations.push(`⚠️  Cannot verify budget filtering without path cost data`);
      if (levels.filter(l => l === 'advanced').length >= 3) {
        analysis.passed = true;
        analysis.observations.push('✅ Maintained advanced level');
        analysis.grade = 'B';
      }
      break;

    case 3: // Unrealistic timeline
      // System should still provide recommendations
      if (recs.length >= 3) {
        analysis.passed = true;
        analysis.observations.push('✅ Provided recommendations despite unrealistic timeline');
        analysis.grade = 'B';
      }
      analysis.observations.push('⚠️  No visible warning about timeline impossibility');
      break;

    case 4: // Advanced user, basic interest
      const advancedCount = levels.filter(l => l === 'advanced').length;
      if (advancedCount >= 3) {
        analysis.passed = true;
        analysis.observations.push(`✅ Respected advanced level (${advancedCount}/5)`);
        analysis.grade = 'A';
      } else {
        analysis.issues.push('Might have downgraded level based on interest');
      }
      break;

    case 5: // Beginner with unlimited resources
      const beginnerUnlimited = levels.filter(l => l === 'beginner').length;
      if (beginnerUnlimited >= 3) {
        analysis.passed = true;
        analysis.observations.push('✅ Not influenced by high budget');
        analysis.grade = 'A';
      } else {
        analysis.issues.push('May have been influenced by budget/time to suggest higher level');
      }
      break;

    case 6: // Very broad interests
      // Check for "Complete Journey" or comprehensive paths
      const titles = recs.map(r => r.path?.title || '').join(' ');
      if (titles.includes('Complete') || titles.includes('Journey') || titles.includes('Fundamentals')) {
        analysis.passed = true;
        analysis.observations.push('✅ Recommended comprehensive paths for broad interests');
        analysis.grade = 'A';
      } else {
        analysis.observations.push('⚠️  Might have prioritized one interest over others');
        analysis.grade = 'B';
      }
      break;

    case 7: // Minimal time
      // Should provide recommendations, ideally shorter paths
      if (recs.length >= 3) {
        analysis.passed = true;
        analysis.observations.push('✅ Provided recommendations for limited time');
        analysis.grade = 'B';
      }
      analysis.observations.push('⚠️  Cannot verify if paths match time constraint');
      break;

    case 8: // Single interest (NLP)
      const nlpRelevant = recs.filter(r => {
        const title = r.path?.title?.toLowerCase() || '';
        return title.includes('nlp') || title.includes('text') || title.includes('language');
      }).length;
      if (nlpRelevant >= 2) {
        analysis.passed = true;
        analysis.observations.push(`✅ Found NLP-relevant paths (${nlpRelevant}/5)`);
        analysis.grade = 'A';
      } else {
        analysis.issues.push(`Only ${nlpRelevant}/5 NLP-relevant recommendations`);
        analysis.grade = 'C';
      }
      break;

    case 9: // Self-rated intermediate with beginner indicators
      const intermediateCount = levels.filter(l => l === 'intermediate').length;
      if (intermediateCount >= 3) {
        analysis.passed = true;
        analysis.observations.push('✅ Respected self-rated experience level');
        analysis.grade = 'A';
      } else {
        analysis.observations.push('System may have overridden user self-assessment');
        analysis.grade = 'C';
      }
      break;

    case 10: // Cybersecurity + AI niche
      const cybersecurityRelevant = recs.filter(r => {
        const title = r.path?.title?.toLowerCase() || '';
        return title.includes('security') || title.includes('ml') || title.includes('machine');
      }).length;
      if (cybersecurityRelevant >= 1) {
        analysis.passed = true;
        analysis.observations.push(`Found ${cybersecurityRelevant} relevant paths`);
        analysis.grade = 'B';
      } else {
        analysis.observations.push('⚠️  No cybersecurity-specific AI paths found');
        analysis.grade = 'C';
      }
      break;
  }

  // Performance check
  if (duration > 8000) {
    analysis.observations.push(`⚠️  Slow response: ${Math.round(duration/1000)}s`);
  }

  // Confidence check
  const lowConfidence = confidences.filter(c => c === 'low').length;
  if (lowConfidence > 3) {
    analysis.observations.push('⚠️  Mostly low confidence');
  }

  return analysis;
}

async function runEdgeCaseTests() {
  console.log('🧪 Edge Case Test Suite');
  console.log('Testing 10 unusual scenarios that could break the system\n');

  const results = [];
  let passed = 0;
  let failed = 0;

  for (const testCase of edgeCases) {
    process.stdout.write(`[${testCase.id}/10] ${testCase.name}... `);

    try {
      const { response, duration, statusCode } = await testEdgeCase(testCase);

      if (statusCode !== 200) {
        console.log(`✗ HTTP ${statusCode}`);
        failed++;
        results.push({ testCase, error: `HTTP ${statusCode}`, analysis: { passed: false, issues: [`HTTP ${statusCode}`] } });
        continue;
      }

      const analysis = analyzeEdgeCaseResult(testCase, response, duration);

      if (analysis.passed) {
        console.log(`✓ ${analysis.grade} (${Math.round(duration/1000)}s)`);
        passed++;
      } else {
        console.log(`✗ ${analysis.grade}`);
        failed++;
      }

      results.push({ testCase, response, duration, analysis });

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.log(`✗ ERROR: ${error.message}`);
      failed++;
      results.push({ testCase, error: error.message, analysis: { passed: false, issues: [error.message] } });
    }
  }

  // Generate report
  console.log('\n' + '='.repeat(80));
  console.log('EDGE CASE TEST RESULTS');
  console.log('='.repeat(80) + '\n');

  console.log(`Pass Rate: ${passed}/${edgeCases.length} (${Math.round(passed/edgeCases.length*100)}%)`);
  console.log(`Fail Rate: ${failed}/${edgeCases.length} (${Math.round(failed/edgeCases.length*100)}%)\n`);

  const grades = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  results.forEach(r => {
    if (r.analysis?.grade) grades[r.analysis.grade]++;
  });

  console.log('Grade Distribution:');
  Object.entries(grades).forEach(([grade, count]) => {
    if (count > 0) console.log(`  ${grade}: ${count}`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('DETAILED RESULTS');
  console.log('='.repeat(80));

  results.forEach(({ testCase, response, duration, analysis, error }) => {
    console.log(`\n[${testCase.id}] ${testCase.name}`);
    console.log(`Expected: ${testCase.expectedBehavior}`);
    console.log(`Risk: ${testCase.risk}`);

    if (error) {
      console.log(`❌ ERROR: ${error}`);
    } else {
      console.log(`Grade: ${analysis.grade} | Duration: ${Math.round(duration/1000)}s`);

      if (analysis.passed) {
        console.log('✅ PASSED');
      } else {
        console.log('❌ FAILED');
      }

      if (analysis.observations.length > 0) {
        console.log('Observations:');
        analysis.observations.forEach(obs => console.log(`  ${obs}`));
      }

      if (analysis.issues.length > 0) {
        console.log('Issues:');
        analysis.issues.forEach(issue => console.log(`  ${issue}`));
      }

      if (response?.recommendations) {
        console.log(`Top 3 Recommendations:`);
        response.recommendations.slice(0, 3).forEach((rec, i) => {
          console.log(`  ${i+1}. ${rec.path?.title} (${rec.path?.level}, score: ${rec.score.toFixed(2)}, ${rec.confidence})`);
        });
      }
    }
  });

  console.log('\n' + '='.repeat(80));
  let verdict;
  if (passed >= 8) verdict = '✅ EXCELLENT';
  else if (passed >= 6) verdict = '✅ GOOD';
  else if (passed >= 4) verdict = '⚠️  ACCEPTABLE';
  else verdict = '❌ NEEDS WORK';

  console.log(`VERDICT: ${verdict}`);
  console.log(`  ${passed}/10 edge cases handled gracefully`);
  console.log('='.repeat(80));
}

runEdgeCaseTests().catch(console.error);
