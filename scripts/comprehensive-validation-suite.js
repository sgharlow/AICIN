/**
 * Comprehensive Validation Test Suite
 * 20+ personas covering happy paths, edge cases, and boundary conditions
 */

const https = require('https');

// JWT secret from environment
const JWT_SECRET = process.env.TEST_JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ ERROR: TEST_JWT_SECRET environment variable is required');
  console.error('Set it with: export TEST_JWT_SECRET="your-test-secret"');
  process.exit(1);
}

const ORCHESTRATOR_URL = 'orchestrator-239116109469.us-west1.run.app';

// ============================================================================
// Test Personas: 25 scenarios covering comprehensive validation
// ============================================================================

const testPersonas = [
  // ========== HAPPY PATH CASES (1-5) ==========
  {
    id: 1,
    name: "Healthcare to AI (Beginner)",
    description: "Healthcare professional, no tech background",
    expectedLevel: "beginner",
    quiz: {
      experienceLevel: 'beginner',
      interests: ['machine-learning', 'healthcare-ai'],
      currentRole: 'healthcare',
      goalRole: 'ai-specialist',
      maxBudget: 1000,
      weeklyHours: 10,
      timeline: 24,
      wantsCertification: true
    }
  },
  {
    id: 2,
    name: "Software Dev Upskilling (Intermediate)",
    description: "Mid-level developer adding ML skills",
    expectedLevel: "intermediate",
    quiz: {
      experienceLevel: 'intermediate',
      interests: ['machine-learning', 'python', 'data-science'],
      currentRole: 'software-developer',
      goalRole: 'ml-engineer',
      maxBudget: 2000,
      weeklyHours: 15,
      timeline: 16,
      wantsCertification: true
    }
  },
  {
    id: 3,
    name: "Data Scientist Specializing (Advanced)",
    description: "Experienced data scientist going deep",
    expectedLevel: "advanced",
    quiz: {
      experienceLevel: 'advanced',
      interests: ['deep-learning', 'nlp', 'computer-vision'],
      currentRole: 'data-scientist',
      goalRole: 'research-scientist',
      maxBudget: 3000,
      weeklyHours: 20,
      timeline: 12,
      wantsCertification: false
    }
  },
  {
    id: 4,
    name: "Business Analyst Transition (Beginner-Intermediate)",
    description: "Business analyst becoming data-driven",
    expectedLevel: "beginner",
    quiz: {
      experienceLevel: 'beginner',
      interests: ['data-science', 'python'],
      currentRole: 'business-analyst',
      goalRole: 'data-analyst',
      maxBudget: 1500,
      weeklyHours: 10,
      timeline: 20,
      wantsCertification: true
    }
  },
  {
    id: 5,
    name: "Student Exploring AI (Beginner)",
    description: "University student exploring AI careers",
    expectedLevel: "beginner",
    quiz: {
      experienceLevel: 'beginner',
      interests: ['machine-learning', 'python'],
      currentRole: 'student',
      goalRole: 'ml-engineer',
      maxBudget: 500,
      weeklyHours: 20,
      timeline: 24,
      wantsCertification: false
    }
  },

  // ========== EDGE CASE: CONFLICTING REQUIREMENTS (6-10) ==========
  {
    id: 6,
    name: "Beginner with Advanced Interests",
    description: "Complete beginner wanting deep learning and NLP",
    expectedLevel: "beginner",
    expectedIssue: "Should recommend beginner paths despite advanced interests",
    quiz: {
      experienceLevel: 'beginner',
      interests: ['deep-learning', 'nlp', 'computer-vision'],
      currentRole: 'student',
      goalRole: 'research-scientist',
      maxBudget: 1000,
      weeklyHours: 15,
      timeline: 24,
      wantsCertification: true
    }
  },
  {
    id: 7,
    name: "Advanced User, Very Limited Budget",
    description: "Expert with only $100 budget",
    expectedLevel: "advanced",
    expectedIssue: "Should find free/cheap advanced paths or show budget constraints",
    quiz: {
      experienceLevel: 'advanced',
      interests: ['deep-learning', 'nlp'],
      currentRole: 'data-scientist',
      goalRole: 'research-scientist',
      maxBudget: 100,
      weeklyHours: 20,
      timeline: 12,
      wantsCertification: false
    }
  },
  {
    id: 8,
    name: "Intermediate, Unrealistic Timeline",
    description: "Wants to master ML in 2 weeks with 5 hours/week",
    expectedLevel: "intermediate",
    expectedIssue: "Should recommend paths but flag timeline constraints",
    quiz: {
      experienceLevel: 'intermediate',
      interests: ['machine-learning', 'python'],
      currentRole: 'software-developer',
      goalRole: 'ml-engineer',
      maxBudget: 2000,
      weeklyHours: 5,
      timeline: 2,
      wantsCertification: true
    }
  },
  {
    id: 9,
    name: "Advanced User, Single Basic Interest",
    description: "Advanced user only interested in Python basics",
    expectedLevel: "advanced",
    expectedIssue: "Should recommend advanced Python or suggest broader learning",
    quiz: {
      experienceLevel: 'advanced',
      interests: ['python'],
      currentRole: 'data-scientist',
      goalRole: 'data-scientist',
      maxBudget: 2000,
      weeklyHours: 10,
      timeline: 12,
      wantsCertification: false
    }
  },
  {
    id: 10,
    name: "Beginner with Unlimited Resources",
    description: "Complete beginner with $10k budget and 40 hrs/week",
    expectedLevel: "beginner",
    expectedIssue: "Should recommend beginner paths, not be influenced by budget",
    quiz: {
      experienceLevel: 'beginner',
      interests: ['machine-learning', 'data-science'],
      currentRole: 'career-changer',
      goalRole: 'ml-engineer',
      maxBudget: 10000,
      weeklyHours: 40,
      timeline: 52,
      wantsCertification: true
    }
  },

  // ========== EDGE CASE: BOUNDARY CONDITIONS (11-15) ==========
  {
    id: 11,
    name: "Minimum Budget ($0)",
    description: "Beginner with zero budget, needs free paths only",
    expectedLevel: "beginner",
    expectedIssue: "Should only recommend free paths",
    quiz: {
      experienceLevel: 'beginner',
      interests: ['machine-learning'],
      currentRole: 'student',
      goalRole: 'ml-engineer',
      maxBudget: 0,
      weeklyHours: 10,
      timeline: 24,
      wantsCertification: false
    }
  },
  {
    id: 12,
    name: "Single Interest Focus",
    description: "Only interested in NLP, very focused",
    expectedLevel: "intermediate",
    expectedIssue: "Should recommend NLP-specific paths",
    quiz: {
      experienceLevel: 'intermediate',
      interests: ['nlp'],
      currentRole: 'software-developer',
      goalRole: 'nlp-engineer',
      maxBudget: 1500,
      weeklyHours: 15,
      timeline: 16,
      wantsCertification: true
    }
  },
  {
    id: 13,
    name: "Very Broad Interests",
    description: "Interested in everything AI-related",
    expectedLevel: "beginner",
    expectedIssue: "Should recommend comprehensive/journey paths",
    quiz: {
      experienceLevel: 'beginner',
      interests: ['machine-learning', 'deep-learning', 'nlp', 'computer-vision', 'data-science', 'python'],
      currentRole: 'student',
      goalRole: 'ai-specialist',
      maxBudget: 2000,
      weeklyHours: 20,
      timeline: 36,
      wantsCertification: true
    }
  },
  {
    id: 14,
    name: "Minimal Time Commitment",
    description: "Only 2 hours per week available",
    expectedLevel: "intermediate",
    expectedIssue: "Should recommend shorter paths or flag time constraints",
    quiz: {
      experienceLevel: 'intermediate',
      interests: ['machine-learning'],
      currentRole: 'software-developer',
      goalRole: 'ml-engineer',
      maxBudget: 1500,
      weeklyHours: 2,
      timeline: 52,
      wantsCertification: false
    }
  },
  {
    id: 15,
    name: "Intensive Learning (40 hrs/week)",
    description: "Full-time learner, 40 hours per week",
    expectedLevel: "beginner",
    expectedIssue: "Should recommend comprehensive paths with fast completion",
    quiz: {
      experienceLevel: 'beginner',
      interests: ['machine-learning', 'python', 'data-science'],
      currentRole: 'career-changer',
      goalRole: 'ml-engineer',
      maxBudget: 3000,
      weeklyHours: 40,
      timeline: 12,
      wantsCertification: true
    }
  },

  // ========== SPECIFIC DOMAIN COMBINATIONS (16-20) ==========
  {
    id: 16,
    name: "Cloud AI Specialist (Intermediate)",
    description: "Wants cloud-specific AI skills (AWS, Azure, GCP)",
    expectedLevel: "intermediate",
    expectedIssue: "Should recommend cloud AI paths",
    quiz: {
      experienceLevel: 'intermediate',
      interests: ['machine-learning', 'cloud'],
      currentRole: 'software-developer',
      goalRole: 'cloud-ai-engineer',
      maxBudget: 2000,
      weeklyHours: 15,
      timeline: 16,
      wantsCertification: true
    }
  },
  {
    id: 17,
    name: "Cybersecurity + AI (Advanced)",
    description: "Cybersecurity professional adding AI skills",
    expectedLevel: "advanced",
    expectedIssue: "Should find cybersecurity AI paths if available",
    quiz: {
      experienceLevel: 'advanced',
      interests: ['machine-learning', 'cybersecurity'],
      currentRole: 'security-engineer',
      goalRole: 'ai-security-specialist',
      maxBudget: 2500,
      weeklyHours: 12,
      timeline: 20,
      wantsCertification: true
    }
  },
  {
    id: 18,
    name: "Computer Vision Specialist (Advanced)",
    description: "Focused solely on computer vision",
    expectedLevel: "advanced",
    expectedIssue: "Should recommend advanced computer vision paths",
    quiz: {
      experienceLevel: 'advanced',
      interests: ['computer-vision', 'deep-learning'],
      currentRole: 'data-scientist',
      goalRole: 'computer-vision-engineer',
      maxBudget: 2000,
      weeklyHours: 20,
      timeline: 12,
      wantsCertification: false
    }
  },
  {
    id: 19,
    name: "Data Engineering to ML (Intermediate)",
    description: "Data engineer transitioning to ML engineering",
    expectedLevel: "intermediate",
    expectedIssue: "Should recommend ML paths for engineers",
    quiz: {
      experienceLevel: 'intermediate',
      interests: ['machine-learning', 'data-engineering', 'python'],
      currentRole: 'data-engineer',
      goalRole: 'ml-engineer',
      maxBudget: 2000,
      weeklyHours: 15,
      timeline: 16,
      wantsCertification: true
    }
  },
  {
    id: 20,
    name: "Product Manager Learning AI (Beginner)",
    description: "PM wanting to understand AI for product decisions",
    expectedLevel: "beginner",
    expectedIssue: "Should recommend beginner/overview paths",
    quiz: {
      experienceLevel: 'beginner',
      interests: ['machine-learning'],
      currentRole: 'product-manager',
      goalRole: 'ai-product-manager',
      maxBudget: 1000,
      weeklyHours: 8,
      timeline: 20,
      wantsCertification: false
    }
  },

  // ========== AMBIGUOUS/MIXED PROFILES (21-25) ==========
  {
    id: 21,
    name: "Self-Rated Intermediate, Basic Interests",
    description: "Says intermediate but interests are beginner-level",
    expectedLevel: "intermediate",
    expectedIssue: "Should respect stated experience level",
    quiz: {
      experienceLevel: 'intermediate',
      interests: ['python'],
      currentRole: 'software-developer',
      goalRole: 'software-developer',
      maxBudget: 1000,
      weeklyHours: 10,
      timeline: 12,
      wantsCertification: false
    }
  },
  {
    id: 22,
    name: "Career Switcher with Time Pressure",
    description: "Changing careers, needs fast results",
    expectedLevel: "beginner",
    expectedIssue: "Should balance thoroughness with timeline",
    quiz: {
      experienceLevel: 'beginner',
      interests: ['machine-learning', 'data-science'],
      currentRole: 'marketing',
      goalRole: 'data-analyst',
      maxBudget: 2000,
      weeklyHours: 25,
      timeline: 12,
      wantsCertification: true
    }
  },
  {
    id: 23,
    name: "Academic Researcher (Advanced)",
    description: "PhD-level, wants practical ML skills",
    expectedLevel: "advanced",
    expectedIssue: "Should recommend advanced applied ML paths",
    quiz: {
      experienceLevel: 'advanced',
      interests: ['deep-learning', 'nlp'],
      currentRole: 'researcher',
      goalRole: 'research-scientist',
      maxBudget: 1500,
      weeklyHours: 15,
      timeline: 16,
      wantsCertification: false
    }
  },
  {
    id: 24,
    name: "Multiple Career Goals",
    description: "Wants both NLP and Computer Vision expertise",
    expectedLevel: "intermediate",
    expectedIssue: "Should recommend comprehensive or dual paths",
    quiz: {
      experienceLevel: 'intermediate',
      interests: ['nlp', 'computer-vision', 'deep-learning'],
      currentRole: 'ml-engineer',
      goalRole: 'research-scientist',
      maxBudget: 3000,
      weeklyHours: 20,
      timeline: 24,
      wantsCertification: true
    }
  },
  {
    id: 25,
    name: "Certification Hunter (Intermediate)",
    description: "Only cares about certifications, budget-conscious",
    expectedLevel: "intermediate",
    expectedIssue: "Should prioritize certified paths within budget",
    quiz: {
      experienceLevel: 'intermediate',
      interests: ['machine-learning', 'cloud'],
      currentRole: 'software-developer',
      goalRole: 'ml-engineer',
      maxBudget: 1000,
      weeklyHours: 10,
      timeline: 20,
      wantsCertification: true
    }
  }
];

// ============================================================================
// Helper Functions
// ============================================================================

function createJWT(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

  const crypto = require('crypto');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function makeRequest(quiz) {
  return new Promise((resolve, reject) => {
    const token = createJWT({ quiz });
    const postData = JSON.stringify(quiz);

    const options = {
      hostname: ORCHESTRATOR_URL,
      path: '/api/v1/quiz/score',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${token}`
      },
      timeout: 30000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
}

function analyzeResults(persona, response) {
  const analysis = {
    success: false,
    quality: 0,
    issues: [],
    levelMatch: 'unknown'
  };

  if (!response || !response.recommendations || response.recommendations.length === 0) {
    analysis.issues.push('No recommendations returned');
    return analysis;
  }

  analysis.success = true;
  const recs = response.recommendations.slice(0, 5);

  // Check experience level matching
  const levels = recs.map(r => r.path?.level?.toLowerCase()).filter(Boolean);
  const expectedLevel = persona.expectedLevel;

  // Count how many recommendations match expected level
  const matchingLevel = levels.filter(l => l === expectedLevel).length;
  const wrongLevel = levels.filter(l => {
    const levelDiff = Math.abs(
      ['beginner', 'intermediate', 'advanced'].indexOf(l) -
      ['beginner', 'intermediate', 'advanced'].indexOf(expectedLevel)
    );
    return levelDiff >= 2; // 2+ levels apart is wrong
  }).length;

  if (matchingLevel >= 3) {
    analysis.levelMatch = 'good';
    analysis.quality += 40;
  } else if (matchingLevel >= 1) {
    analysis.levelMatch = 'acceptable';
    analysis.quality += 20;
  } else {
    analysis.levelMatch = 'poor';
    analysis.issues.push(`Expected ${expectedLevel} paths, got: ${levels.join(', ')}`);
  }

  if (wrongLevel > 0) {
    analysis.issues.push(`${wrongLevel} recommendations are 2+ levels mismatched`);
    analysis.quality -= 20;
  }

  // Check confidence distribution
  const confidences = recs.map(r => r.confidence);
  const highConf = confidences.filter(c => c === 'high').length;

  if (highConf >= 3) {
    analysis.quality += 30;
  } else if (highConf >= 1) {
    analysis.quality += 15;
  } else {
    analysis.issues.push('No high-confidence recommendations');
  }

  // Check score differentiation
  const scores = recs.map(r => r.score);
  const scoreRange = Math.max(...scores) - Math.min(...scores);

  if (scoreRange > 0.2) {
    analysis.quality += 20;
  } else if (scoreRange > 0.1) {
    analysis.quality += 10;
  } else {
    analysis.issues.push(`Poor score differentiation (range: ${scoreRange.toFixed(3)})`);
  }

  // Response time check
  if (response.processingTimeMs < 8000) {
    analysis.quality += 10;
  } else {
    analysis.issues.push(`Slow response (${Math.round(response.processingTimeMs / 1000)}s)`);
  }

  return analysis;
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function runTests() {
  console.log('🧪 Starting Comprehensive Validation Suite');
  console.log(`📋 Testing ${testPersonas.length} personas\n`);

  const results = [];
  let totalSuccess = 0;
  let totalQuality = 0;
  let levelMatchGood = 0;
  let levelMatchAcceptable = 0;
  let levelMatchPoor = 0;

  for (const persona of testPersonas) {
    process.stdout.write(`Testing ${persona.id}/25: ${persona.name}... `);

    const startTime = Date.now();
    try {
      const response = await makeRequest(persona.quiz);
      const duration = Date.now() - startTime;

      const analysis = analyzeResults(persona, response);

      if (analysis.success) {
        totalSuccess++;
        totalQuality += analysis.quality;

        if (analysis.levelMatch === 'good') levelMatchGood++;
        else if (analysis.levelMatch === 'acceptable') levelMatchAcceptable++;
        else levelMatchPoor++;

        console.log(`✓ (${duration}ms, quality: ${analysis.quality}/100, level: ${analysis.levelMatch})`);
      } else {
        console.log(`✗ FAILED`);
      }

      results.push({
        persona,
        response,
        analysis,
        duration
      });

    } catch (error) {
      console.log(`✗ ERROR: ${error.message}`);
      results.push({
        persona,
        error: error.message,
        analysis: { success: false, quality: 0, issues: [error.message], levelMatch: 'error' }
      });
    }

    // Small delay between requests to avoid overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // ============================================================================
  // Generate Report
  // ============================================================================

  console.log('\n' + '='.repeat(80));
  console.log('COMPREHENSIVE VALIDATION RESULTS');
  console.log('='.repeat(80) + '\n');

  console.log(`Success Rate: ${totalSuccess}/${testPersonas.length} (${Math.round(totalSuccess/testPersonas.length*100)}%)`);
  console.log(`Average Quality: ${Math.round(totalQuality/totalSuccess)}/100`);
  console.log(`\nLevel Matching:`);
  console.log(`  Good (3+ correct): ${levelMatchGood} (${Math.round(levelMatchGood/totalSuccess*100)}%)`);
  console.log(`  Acceptable (1-2): ${levelMatchAcceptable} (${Math.round(levelMatchAcceptable/totalSuccess*100)}%)`);
  console.log(`  Poor (0): ${levelMatchPoor} (${Math.round(levelMatchPoor/totalSuccess*100)}%)`);

  // Issues summary
  const allIssues = results.flatMap(r => r.analysis.issues);
  const issueTypes = {};
  allIssues.forEach(issue => {
    const key = issue.split(':')[0];
    issueTypes[key] = (issueTypes[key] || 0) + 1;
  });

  if (Object.keys(issueTypes).length > 0) {
    console.log(`\nCommon Issues:`);
    Object.entries(issueTypes)
      .sort((a, b) => b[1] - a[1])
      .forEach(([issue, count]) => {
        console.log(`  - ${issue}: ${count} occurrences`);
      });
  }

  // Detailed failures
  const failures = results.filter(r => !r.analysis.success || r.analysis.levelMatch === 'poor');
  if (failures.length > 0) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`DETAILED FAILURES (${failures.length})`);
    console.log('='.repeat(80));

    failures.forEach(({ persona, analysis }) => {
      console.log(`\n[${persona.id}] ${persona.name}`);
      console.log(`  Description: ${persona.description}`);
      console.log(`  Expected Level: ${persona.expectedLevel}`);
      console.log(`  Level Match: ${analysis.levelMatch}`);
      console.log(`  Quality: ${analysis.quality}/100`);
      if (analysis.issues.length > 0) {
        console.log(`  Issues:`);
        analysis.issues.forEach(issue => console.log(`    - ${issue}`));
      }
    });
  }

  // Edge case analysis
  console.log(`\n${'='.repeat(80)}`);
  console.log('EDGE CASE ANALYSIS');
  console.log('='.repeat(80));

  const edgeCases = results.filter(r => r.persona.expectedIssue);
  console.log(`\nTested ${edgeCases.length} edge cases:`);

  edgeCases.forEach(({ persona, analysis }) => {
    const status = analysis.success && analysis.quality >= 50 ? '✓' : '✗';
    console.log(`\n${status} [${persona.id}] ${persona.name}`);
    console.log(`  Expected: ${persona.expectedIssue}`);
    console.log(`  Quality: ${analysis.quality}/100, Level: ${analysis.levelMatch}`);
    if (analysis.issues.length > 0) {
      console.log(`  Issues: ${analysis.issues.join('; ')}`);
    }
  });

  // Final verdict
  console.log(`\n${'='.repeat(80)}`);
  const passRate = totalSuccess / testPersonas.length;
  const avgQuality = totalQuality / totalSuccess;
  const levelGoodRate = levelMatchGood / totalSuccess;

  let verdict = '🎉 EXCELLENT';
  if (passRate < 0.95 || avgQuality < 70 || levelGoodRate < 0.7) {
    verdict = '✅ GOOD';
  }
  if (passRate < 0.9 || avgQuality < 60 || levelGoodRate < 0.5) {
    verdict = '⚠️  NEEDS IMPROVEMENT';
  }
  if (passRate < 0.8 || avgQuality < 50 || levelGoodRate < 0.3) {
    verdict = '❌ NOT READY';
  }

  console.log(`VERDICT: ${verdict}`);
  console.log(`  - ${Math.round(passRate * 100)}% success rate (target: ≥95%)`);
  console.log(`  - ${Math.round(avgQuality)}/100 average quality (target: ≥70)`);
  console.log(`  - ${Math.round(levelGoodRate * 100)}% good level matching (target: ≥70%)`);
  console.log('='.repeat(80));

  return results;
}

// Run tests
runTests().catch(console.error);
