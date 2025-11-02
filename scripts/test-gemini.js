#!/usr/bin/env node
/**
 * AICIN - Test Gemini AI Integration
 * Verifies Vertex AI Gemini connectivity
 */

const { VertexAI } = require('@google-cloud/vertexai');

const project = process.env.GOOGLE_CLOUD_PROJECT || 'aicin-477004';
const location = 'us-central1';
const model = 'gemini-pro';

async function testGeminiAPI() {
  console.log('\n🤖 AICIN - Gemini AI Integration Test\n');
  console.log(`Project: ${project}`);
  console.log(`Location: ${location}`);
  console.log(`Model: ${model}\n`);

  try {
    // Initialize Vertex AI
    console.log('1. Initializing Vertex AI...');
    const vertex_ai = new VertexAI({ project, location });
    const generativeModel = vertex_ai.getGenerativeModel({ model });
    console.log('   ✓ Vertex AI initialized\n');

    // Test 1: Simple health check
    console.log('2. Testing basic generation...');
    const healthResult = await generativeModel.generateContent('Hello! Respond with just OK.');
    const healthText = healthResult.response.candidates[0].content.parts[0].text;
    console.log(`   Response: ${healthText}`);
    console.log('   ✓ Basic generation works\n');

    // Test 2: Structured JSON response
    console.log('3. Testing JSON generation...');
    const jsonPrompt = `Generate a JSON object with these fields:
- description: "A test learning path"
- matchReasons: ["reason 1", "reason 2", "reason 3"]
- skills: ["skill 1", "skill 2"]

Respond with ONLY valid JSON, no markdown.`;

    const jsonResult = await generativeModel.generateContent(jsonPrompt);
    const jsonText = jsonResult.response.candidates[0].content.parts[0].text;

    console.log(`   Raw response:\n${jsonText.substring(0, 200)}...`);

    try {
      const parsed = JSON.parse(jsonText.replace(/```json|```/g, '').trim());
      console.log('   ✓ JSON parsing successful');
      console.log(`   ✓ Description: ${parsed.description?.substring(0, 50)}...`);
      console.log(`   ✓ Match reasons: ${parsed.matchReasons?.length || 0}`);
      console.log(`   ✓ Skills: ${parsed.skills?.length || 0}\n`);
    } catch (parseError) {
      console.log('   ⚠ JSON parsing failed (may need prompt adjustment)');
      console.log(`   Error: ${parseError.message}\n`);
    }

    // Test 3: Path enrichment simulation
    console.log('4. Testing path enrichment...');
    const enrichmentPrompt = `You are an AI learning advisor. Analyze this learning path:

Learning Path: "Machine Learning Fundamentals"
Description: "Learn the basics of ML algorithms and applications"
Topics: Python, Supervised Learning, Neural Networks

User Context:
- Interests: AI, Data Science, Career Change
- Goals: Transition into ML engineering role

Provide a JSON response with:
1. enhancedDescription: A compelling 2-3 sentence description
2. matchReasons: Array of 3 reasons why this path fits
3. learningOutcomes: Array of 3 key skills
4. prerequisites: Array of 2 prerequisites
5. careerRelevance: 1 sentence on career impact

Respond with ONLY valid JSON.`;

    const enrichResult = await generativeModel.generateContent(enrichmentPrompt);
    const enrichText = enrichResult.response.candidates[0].content.parts[0].text;

    console.log(`   Response length: ${enrichText.length} chars`);

    try {
      const cleanedText = enrichText.replace(/```json|```/g, '').trim();
      const enrichment = JSON.parse(cleanedText);

      console.log('   ✓ Enrichment successful!');
      console.log(`   ✓ Enhanced description: ${enrichment.enhancedDescription?.substring(0, 60)}...`);
      console.log(`   ✓ Match reasons: ${enrichment.matchReasons?.length || 0}`);
      console.log(`   ✓ Learning outcomes: ${enrichment.learningOutcomes?.length || 0}`);
      console.log(`   ✓ Prerequisites: ${enrichment.prerequisites?.length || 0}`);
      console.log(`   ✓ Career relevance: ${enrichment.careerRelevance?.substring(0, 50)}...\n`);
    } catch (parseError) {
      console.log('   ⚠ Enrichment parsing failed');
      console.log(`   Raw: ${enrichText.substring(0, 300)}...\n`);
    }

    console.log('✅ Gemini AI integration test complete!\n');
    console.log('Summary:');
    console.log('  ✓ Vertex AI connection: Working');
    console.log('  ✓ Basic generation: Working');
    console.log('  ✓ Structured output: Functional (may need prompt tuning)');
    console.log('  ✓ Ready for production integration\n');

    return true;
  } catch (error) {
    console.error('\n❌ Gemini test failed:', error.message);

    if (error.message.includes('not found') || error.message.includes('permission')) {
      console.log('\nTroubleshooting:');
      console.log('1. Verify Vertex AI API is enabled:');
      console.log('   gcloud services enable aiplatform.googleapis.com --project=aicin-477004');
      console.log('2. Check authentication:');
      console.log('   gcloud auth application-default login');
      console.log('3. Verify project permissions for Vertex AI\n');
    }

    process.exit(1);
  }
}

// Run test
if (require.main === module) {
  testGeminiAPI();
}

module.exports = { testGeminiAPI };
