# AICIN - Automated Deployment Guide

**All credentials configured** ✅
**GCP Project ID**: aicin-477004 ✅
**Scripts ready for execution** ✅

---

## 🚀 One-Command Full Deployment

### Option 1: Complete Automated Deployment

```bash
cd ~/CascadeProjects/AICIN
./scripts/deploy-master.sh
```

**This will**:
1. Setup GCP (enable APIs, create registry, configure secrets)
2. Build all 6 Docker images (~15 minutes)
3. Deploy to Cloud Run
4. Run health checks
5. Save URLs to `deployed-urls.txt`

**Time**: ~20-25 minutes total

---

## 🔧 Step-by-Step Deployment (For Monitoring)

### Step 1: Setup GCP

```bash
cd ~/CascadeProjects/AICIN
./scripts/setup-gcp.sh
```

**What it does**:
- Sets project to `aicin-477004`
- Enables Cloud Run, Build, Artifact Registry, Secret Manager
- Creates Docker repository
- Creates secrets (database-password, jwt-secret)
- Grants permissions

**Expected output**: ✓ GCP Setup Complete!

---

### Step 2: Build & Deploy All Agents

```bash
./scripts/build-and-deploy.sh
```

**What it does**:
- Builds 6 Docker images using Cloud Build
- Deploys to Cloud Run
- Configures environment variables
- Injects secrets
- Updates orchestrator with agent URLs
- Saves URLs to `deployed-urls.txt`

**Expected time**: ~15-20 minutes

**Expected output**:
```
✓ orchestrator deployed: https://orchestrator-xyz.run.app
✓ profile-analyzer deployed: https://profile-analyzer-xyz.run.app
✓ content-matcher deployed: https://content-matcher-xyz.run.app
✓ path-optimizer deployed: https://path-optimizer-xyz.run.app
✓ course-validator deployed: https://course-validator-xyz.run.app
✓ recommendation-builder deployed: https://recommendation-builder-xyz.run.app
```

---

### Step 3: Test All Services

```bash
./scripts/test-health.sh
```

**What it does**:
- Calls `/health` on all 6 services
- Verifies 200 status codes
- Shows summary

**Expected output**:
```
Testing Orchestrator...
  ✓ Status: 200
  ✓ Response: {"status":"healthy",...}

...

Health Check Summary
Passed: 6
Failed: 0

✓ All services are healthy!
```

---

## 📊 Monitoring Commands

### View Real-Time Logs

```bash
# Orchestrator logs (main service)
./scripts/monitor-logs.sh orchestrator

# Any specific service
./scripts/monitor-logs.sh profile-analyzer
./scripts/monitor-logs.sh content-matcher
```

**Press Ctrl+C to stop**

### Check Recent Logs (Last 50 entries)

```bash
gcloud run logs read orchestrator --region us-west1 --limit 50
```

### View Service Status

```bash
gcloud run services list --region us-west1
```

### Get Service Details

```bash
gcloud run services describe orchestrator --region us-west1
```

---

## 🧪 Testing After Deployment

### Test 1: Health Check (Manual)

```bash
# Load URLs
source deployed-urls.txt

# Test orchestrator
curl $ORCHESTRATOR_URL/health

# Expected: {"status":"healthy",...}
```

### Test 2: Database Connection Test

```bash
# Check orchestrator logs for database connection
gcloud run logs read orchestrator --region us-west1 --limit 20

# Look for: "[Database] Pool initialized successfully"
```

### Test 3: Quiz Submission (Requires JWT)

```bash
source deployed-urls.txt

# You'll need a JWT token from LearningAI365
# Get token by logging into https://learningai365.com

curl -X POST $ORCHESTRATOR_URL/api/v1/quiz/score \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "answers": {
      "experienceLevel": "intermediate",
      "learningGoal": "upskill",
      "availability": "10-20h",
      "budget": "$100-500",
      "background": "tech",
      "interests": ["machine-learning", "deep-learning"],
      "programming": "intermediate",
      "specialization": "specialist",
      "learningStyle": "mixed",
      "certification": "nice-to-have",
      "timeline": "3-6-months",
      "priorProjects": "3-5",
      "mathBackground": "strong",
      "industry": "technology",
      "teamPreference": "both"
    }
  }'
```

**Expected response**: JSON with recommendations array

---

## 🔍 Troubleshooting

### Issue: Build fails

**Check**:
```bash
gcloud builds list --limit=5
gcloud builds log <BUILD_ID>
```

**Common causes**:
- Docker context too large (check .dockerignore)
- Timeout (increase with --timeout=30m)

### Issue: Service won't start

**Check logs**:
```bash
./scripts/monitor-logs.sh orchestrator
```

**Common causes**:
- Missing environment variables
- Database connection failed
- Secret not accessible

**Fix secrets**:
```bash
# Verify secrets exist
gcloud secrets list

# Update secret
echo -n "new-value" | gcloud secrets versions add secret-name --data-file=-
```

### Issue: Health check fails

**Check service is running**:
```bash
gcloud run services describe orchestrator --region us-west1
```

**Check recent deployments**:
```bash
gcloud run revisions list --service=orchestrator --region us-west1
```

**Redeploy specific service**:
```bash
gcloud run services update orchestrator --region us-west1
```

---

## 📁 Files Created During Deployment

### `deployed-urls.txt`
Contains all service URLs after deployment
```bash
cat deployed-urls.txt
```

### Build Logs
```bash
gcloud builds list --limit=10
```

### Service Logs
```bash
./scripts/monitor-logs.sh orchestrator
```

---

## 🎯 Quick Commands Reference

```bash
# Full deployment
./scripts/deploy-master.sh

# Just setup GCP
./scripts/setup-gcp.sh

# Just build and deploy
./scripts/build-and-deploy.sh

# Test health
./scripts/test-health.sh

# Monitor logs
./scripts/monitor-logs.sh orchestrator

# View URLs
cat deployed-urls.txt

# List services
gcloud run services list --region us-west1

# Open Cloud Console
open https://console.cloud.google.com/run?project=aicin-477004
```

---

## 💰 Cost Tracking

### View Current Costs

```bash
gcloud billing accounts list
```

### Set Budget Alert (Recommended)

```bash
# Set $50 monthly budget alert
gcloud billing budgets create \
  --billing-account=YOUR_BILLING_ACCOUNT_ID \
  --display-name="AICIN Monthly Budget" \
  --budget-amount=50USD
```

### Expected Costs (First Month)

- **Development/Testing**: $5-10
  - 6 services × ~$1-2 each
  - Minimal traffic
  - Scale-to-zero enabled

- **Hackathon Demo**: $10-15
  - Moderate testing
  - Demo traffic
  - Short duration

- **Production (if deployed)**: $15-25/month
  - Orchestrator: min-instances=1
  - Other agents: scale-to-zero

---

## ✅ Success Checklist

After running `./scripts/deploy-master.sh`:

- [ ] All 6 services show "✓ deployed"
- [ ] `deployed-urls.txt` exists
- [ ] Health checks pass (6/6)
- [ ] Orchestrator logs show database connection
- [ ] Can curl all service /health endpoints
- [ ] Orchestrator has agent URLs configured

---

## 🚀 What's Next?

### After Successful Deployment:

1. **Save URLs** - Copy `deployed-urls.txt` to safe location
2. **Test API** - Submit test quiz (see Test 3 above)
3. **Monitor Performance** - Watch logs during test
4. **Benchmark** - Run load test (optional)
5. **Demo Prep** - Start working on demo video
6. **Documentation** - Update with actual URLs

### Update Frontend (LearningAI365)

Once tested, update your Next.js app:

```bash
# In learningai365 frontend
export NEXT_PUBLIC_API_URL=$ORCHESTRATOR_URL
# Rebuild and deploy
```

---

**Ready to deploy? Run: `./scripts/deploy-master.sh`** 🚀
