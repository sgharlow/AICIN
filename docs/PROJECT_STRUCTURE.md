# AICIN Project Structure

**Last Updated:** 2025-11-02

## Root Directory

```
AICIN/
├── README.md                    # Main project documentation
├── QUICKSTART.md                # Getting started guide
├── DEPLOY.md                    # Deployment instructions
├── package.json                 # Project dependencies
├── .env.template                # Environment variable template
├── .gitignore                   # Git ignore patterns
├── .dockerignore                # Docker ignore patterns
│
├── agents/                      # 6 specialized AI agents
│   ├── orchestrator/            # Main coordinator agent
│   ├── profile-analyzer/        # User profile analysis
│   ├── content-matcher/         # Content matching (TF-IDF)
│   ├── path-optimizer/          # Learning path optimization
│   ├── course-validator/        # Course quality validation
│   └── recommendation-builder/  # Final recommendation assembly
│
├── shared/                      # Shared modules
│   ├── types/                   # TypeScript type definitions
│   ├── database/                # PostgreSQL database client
│   └── utils/                   # Utility functions
│       ├── auth.ts              # JWT authentication
│       ├── cache.ts             # Redis caching
│       ├── agent-client.ts      # Inter-agent communication
│       ├── circuit-breaker.ts   # Circuit breaker pattern
│       ├── secrets.ts           # Secret Manager integration
│       └── gemini.ts            # Vertex AI Gemini integration
│
├── scripts/                     # Deployment & testing scripts
│   ├── build-and-deploy.sh     # Build & deploy to Cloud Run
│   ├── comprehensive-quiz-test.js        # 5-persona test suite
│   ├── production-load-test.js           # 1000+ request load test
│   └── test-*.js                         # Various test scripts
│
├── docs/                        # Documentation
│   ├── ARCHITECTURE.md          # System architecture
│   ├── ARCHITECTURE_DIAGRAMS.md # 7 detailed diagrams
│   ├── HACKATHON_READINESS_CRITIQUE.md  # Readiness assessment
│   ├── HACKATHON_SUBMISSION.md  # Submission checklist
│   ├── SLIDE_DECK_CONTENT.md    # Presentation content
│   ├── VIDEO_SCRIPT.md          # Demo video script
│   ├── BEFORE_AFTER_COMPARISON.md       # vs AWS Lambda
│   ├── PERFORMANCE_METRICS.md   # Performance data
│   ├── LOAD_TEST_RESULTS.md     # Load test outcomes
│   └── archive/                 # Development history
│
└── examples/                    # Example quiz responses
```

## Technology Stack

### Infrastructure
- **Cloud Platform:** Google Cloud Platform (GCP)
- **Compute:** Cloud Run (serverless containers)
- **Database:** Cloud SQL (PostgreSQL)
- **Cache:** Memorystore (Redis)
- **AI/ML:** Vertex AI (Gemini 1.5 Flash)
- **Secrets:** Secret Manager
- **Container Registry:** Artifact Registry

### Backend
- **Language:** TypeScript
- **Runtime:** Node.js 18
- **Framework:** Express.js
- **Architecture:** Microservices (6 specialized agents)
- **Patterns:** Circuit Breaker, Retry with Exponential Backoff

### Key Features
- **Multi-Agent AI System:** 6 specialized agents for personalized recommendations
- **3-Layer Scoring:** Content (40%) + Metadata (35%) + Quality (25%)
- **Circuit Breakers:** Resilience against agent failures
- **Secret Management:** Secure JWT handling via Secret Manager
- **Auto-Scaling:** 0-100 instances per agent
- **Caching:** Redis for performance (594ms average response time)

## Deployment URLs

- **Orchestrator:** https://orchestrator-239116109469.us-west1.run.app
- **Profile Analyzer:** https://profile-analyzer-239116109469.us-west1.run.app
- **Content Matcher:** https://content-matcher-239116109469.us-west1.run.app
- **Path Optimizer:** https://path-optimizer-239116109469.us-west1.run.app
- **Course Validator:** https://course-validator-239116109469.us-west1.run.app
- **Recommendation Builder:** https://recommendation-builder-239116109469.us-west1.run.app

## API Endpoint

**POST** `/api/v1/quiz/score`

**Headers:**
- `Authorization: Bearer <JWT>`
- `Content-Type: application/json`

**Body:**
```json
{
  "answers": {
    "learningGoal": "career-switch",
    "experienceLevel": "beginner",
    "interests": ["machine-learning", "healthcare-ai"],
    "availability": "5-10h",
    ...
  }
}
```

## Development History

Historical development documents have been moved to `docs/archive/`:
- DAY_1-3 progress summaries
- Database connectivity records
- Deployment status updates
- AWS migration documentation
- Original specification

## Testing

### Comprehensive Quiz Test
```bash
node scripts/comprehensive-quiz-test.js
```
Tests 5 different user personas with full system integration.

### Production Load Test
```bash
node scripts/production-load-test.js
```
Simulates 1000+ concurrent requests to validate scalability claims.

## Recent Improvements (Nov 2, 2025)

1. **Circuit Breakers** - Full pattern with CLOSED/OPEN/HALF_OPEN states
2. **Secret Manager Integration** - Secure JWT handling
3. **Architecture Diagrams** - 7 detailed system diagrams
4. **Production Load Test** - 1000+ request validation
5. **Project Cleanup** - Organized documentation and removed obsolete files

## Next Steps

1. Test deployed system with comprehensive quiz test
2. Update hackathon critique with recent progress
3. Run production load test to validate 500K daily capacity
4. Create presentation slides
5. Record demo video
