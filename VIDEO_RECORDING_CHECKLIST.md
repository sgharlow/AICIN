# 🎬 VIDEO RECORDING CHECKLIST - AICIN Demo
**Last Updated:** November 6, 2025
**Demo Status:** ✅ READY
**Script:** docs/HONEST_VIDEO_SCRIPT.md (CORRECTED)

---

## ✅ PRE-RECORDING SETUP (15 minutes before)

### 1. **Environment Setup**
- [ ] Close all unnecessary applications
- [ ] Set screen resolution to 1920x1080
- [ ] Turn off notifications (Windows Focus Assist / macOS Do Not Disturb)
- [ ] Clear browser history/cache for clean demo
- [ ] Have water nearby (stay hydrated during recording!)

### 2. **Demo Server**
```bash
# Terminal 1: Start demo server
cd demo
node server.js

# Should see:
# 🚀 AICIN Demo Server Running
#    URL: http://localhost:3001
```

**Verify it's working:**
```bash
# Terminal 2: Test JWT endpoint
curl http://localhost:3001/api/demo-token

# Should return JSON with token
```

### 3. **Verify Multi-Agent System**
```bash
# Test the deployed orchestrator
curl https://orchestrator-239116109469.us-west1.run.app/health

# Should return: {"status":"healthy","agent":"orchestrator"...}
```

### 4. **Browser Setup**
- [ ] Open Chrome/Firefox in clean profile
- [ ] Navigate to http://localhost:3001
- [ ] Open DevTools (F12) - Network tab ready to show request
- [ ] Zoom to 100% (Ctrl+0 / Cmd+0)

### 5. **GCP Console Ready**
- [ ] Open https://console.cloud.google.com/run?project=aicin-477004
- [ ] Have 6 services visible:
  - orchestrator
  - profile-analyzer
  - content-matcher
  - path-optimizer
  - course-validator
  - recommendation-builder
- [ ] All services showing green "healthy" status

### 6. **Architecture Diagram**
- [ ] Have docs/ARCHITECTURE.md open (if exists)
- [ ] Or have README.md ASCII diagram ready to show

### 7. **Terminal Output Ready**
```bash
# Have this ready to show during "Proven Results" scene
node scripts/test-agents-comprehensive.js

# Should show:
# ✅ Test 1: CV - 78%
# ✅ Test 2: ML - 76%
# ⚠️ Test 3: NLP - 61%
# Average: 2.45s
```

---

## 🎥 RECORDING SOFTWARE SETUP

### Recommended: OBS Studio (Free)
1. **Download:** https://obsproject.com/
2. **Scene Setup:**
   - Source: Display Capture (full screen) or Window Capture (browser only)
   - Audio: Microphone input
3. **Settings:**
   - Resolution: 1920x1080
   - Frame rate: 30 FPS
   - Encoder: x264
   - Bitrate: 2500-5000 kbps
4. **Audio Check:**
   - Test mic levels (speak normally, aim for -12 to -6 dB)
   - No background noise

### Alternative: Loom (Easy, Web-based)
- https://loom.com
- "Share Screen + Camera" mode
- Max quality settings

### Alternative: QuickTime (Mac)
- File → New Screen Recording
- Options → High Quality

---

## 📝 SCENE-BY-SCENE CHECKLIST

### **SCENE 1: Hook (30s)**
- [ ] Title card or README.md visible
- [ ] Speak clearly: "6 specialized Cloud Run microservices"
- [ ] Emphasize: "2-3 second response, 100% success rate verified"

### **SCENE 2: Problem (45s)**
- [ ] Show README.md "The Problem" section OR
- [ ] Show LearningAI365.com context
- [ ] Mention: 3,950 courses, 251 learning paths

### **SCENE 3: Architecture (60s)**
**CRITICAL: Use correct numbers from script!**
- [ ] Show GCP Console with 6 services OR architecture diagram
- [ ] SAY: "30% content match, 70% metadata fit - our 2-layer system"
- [ ] ❌ DON'T SAY: "40% content, 35% metadata, 25% course quality"
- [ ] Show services auto-scaling (0-100 instances)

### **SCENE 4: Live Demo (90s)**
**Most important scene!**
- [ ] Navigate to http://localhost:3001
- [ ] Fill out quiz ON CAMERA:
  - Experience: Intermediate
  - Interests: Check "Computer Vision"
  - Availability: 10-20 hours
  - Budget: $100-500
  - Timeline: 3-6 months
  - Certification: Nice to have
  - Goal: Upskill my career
  - Programming: Advanced
  - Math: Intermediate
- [ ] Click Submit
- [ ] Show loading animation
- [ ] Point out Network tab (F12) showing request to orchestrator

**When results appear:**
- [ ] SAY: "78% match for Complete Computer Vision Journey"
- [ ] SAY: "77% for Intermediate Google Cloud Vision API"
- [ ] SAY: "74% for Intermediate Computer Vision"
- [ ] SAY: "Notice 78→77→74 - real differentiation, not all the same"
- [ ] ❌ DON'T SAY: "98%" or "84%"
- [ ] Point out response time (should be 2-3s)

### **SCENE 5: Technical Deep Dive (45s)**
- [ ] Show Cloud Logging (optional) OR code snippets
- [ ] Explain: "Profile Analyzer and Content Matcher run in parallel"
- [ ] Mention: "TF-IDF analysis across 251 paths"
- [ ] Mention: "7-dimensional scoring"
- [ ] Say: "2-3 seconds warm, 14 seconds cold start"

### **SCENE 6: Proven Results (30s)**
- [ ] Show terminal with test-agents-comprehensive.js output
- [ ] Point out: "100% success rate (3/3 scenarios)"
- [ ] SAY: "78% for best matches down to 51% for lower-priority"
- [ ] SAY: "Average response time: 2.45 seconds"
- [ ] ❌ DON'T SAY: "98% for best matches"

### **SCENE 7: Google Cloud Integration (45s)**
- [ ] Show GCP Console
- [ ] List services: Cloud Run, Vertex AI, Memorystore, Secret Manager, Cloud Logging
- [ ] Mention: "Auto-scaling to zero when idle"
- [ ] Mention: "Independent scaling per agent"

### **SCENE 8: Impact & Results (30s)**
- [ ] Show comparison table or mention metrics
- [ ] SAY: "6 independent Cloud Run services"
- [ ] SAY: "2-3 seconds response time"
- [ ] SAY: "78% → 51% score differentiation"
- [ ] SAY: "60% projected cost savings"

### **SCENE 9: Call to Action (15s)**
- [ ] Show GitHub: https://github.com/sgharlow/AICIN
- [ ] Show email: sgharlow@gmail.com
- [ ] Thank viewers

---

## 🎙️ RECORDING TIPS

### Audio Quality
- ✅ Speak clearly and at moderate pace
- ✅ Pause briefly between scenes
- ✅ Use natural enthusiasm (this is cool stuff!)
- ❌ Don't rush - you have 5 minutes
- ❌ Don't apologize or say "um" too much (edit later if needed)

### Visual Quality
- ✅ Keep mouse movements smooth
- ✅ Point out key elements with cursor
- ✅ Zoom in if needed (Ctrl/Cmd +)
- ❌ Don't move too fast between screens
- ❌ Don't cover important text with cursor

### Energy Level
- 🔥 Start strong - the hook matters
- 💡 Show genuine excitement during demo
- 📊 Be matter-of-fact during technical sections
- 🎯 End confidently with call to action

---

## 🐛 TROUBLESHOOTING

### Demo Server Not Responding
```bash
# Kill and restart
cd demo
node server.js

# Verify
curl http://localhost:3001/api/demo-token
```

### Orchestrator Down
```bash
# Check health
curl https://orchestrator-239116109469.us-west1.run.app/health

# If unhealthy, check GCP Console
# May need to wait 30s for cold start
```

### Quiz Submission Fails
- Check browser DevTools Console (F12)
- Verify JWT token generated: http://localhost:3001/api/demo-token
- Try refreshing page
- **BACKUP PLAN:** Show terminal test output instead of live demo

### Wrong Scores Appearing
- If you see 68% for all paths → orchestrator using old code
- **BACKUP PLAN:** Show terminal test output showing correct scores

### Audio Issues
- Check mic in Windows Sound Settings / Mac System Preferences
- Test in recording software before starting
- Have backup audio recorder running (phone voice memo)

---

## ✂️ POST-RECORDING

### Immediate Review
- [ ] Watch entire recording
- [ ] Check audio quality throughout
- [ ] Verify demo showed correct scores (78-77-74)
- [ ] Confirm all scenes present

### Editing (if needed)
- [ ] Cut long pauses
- [ ] Remove "ums" and false starts
- [ ] Add fade transitions between major scenes
- [ ] Add background music (optional, royalty-free)
- [ ] Add text overlays for key metrics

### Export Settings
- **Resolution:** 1920x1080 (1080p)
- **Frame Rate:** 30fps
- **Format:** MP4 (H.264)
- **Bitrate:** 8-10 Mbps
- **Audio:** AAC, 192kbps
- **Max Size:** Under 500MB

### Upload
- [ ] YouTube (unlisted or public)
- [ ] Add title: "AICIN - Multi-Agent AI on Google Cloud Run | Cloud Run Hackathon 2025"
- [ ] Add description with GitHub link
- [ ] Add timestamps in description
- [ ] Copy video URL for Devpost submission

---

## 📋 FINAL VERIFICATION BEFORE RECORDING

### Run This Command:
```bash
node scripts/test-agents-diagnostic.js
```

**Expected output:**
```
✅ Response received in 2-3s
Top 5 Recommendations:
1. Complete Computer Vision Journey - 78%
2. Intermediate Google Cloud Vision API - 77%
3. Intermediate Computer Vision - 74%

✅ AGENTS WORKING!
```

If you see this, **YOU'RE READY TO RECORD!** 🎬

---

## 🎯 KEY MESSAGES (DON'T FORGET)

1. **"6 specialized Cloud Run microservices"** - emphasize distributed architecture
2. **"30% content, 70% metadata"** - NOT 40/35/25!
3. **"78→77→74"** - actual scores, NOT 98/84/77
4. **"2-3 seconds warm, 14s cold"** - honest performance
5. **"100% success rate verified"** - proven with tests
6. **"Real production data"** - 3,950 courses, 251 paths

---

## 🚀 YOU GOT THIS!

This is a real, working multi-agent system on Cloud Run. You built something impressive. Show it with confidence!

**Remember:** Honest metrics, real demo, clear explanation = winning submission.

**Good luck with your recording!** 🎬🎉
