/**
 * Simple demo server for AICIN Quiz
 * Serves the quiz page and generates JWTs for API calls
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');
const cors = require('cors');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.DEMO_PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'tgJoQnBPwHxccxWwYdx15g==';

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Generate JWT for demo user
app.get('/api/demo-token', (req, res) => {
    const userId = Math.floor(Math.random() * 100000) + 1000;
    const token = jwt.sign({ userId }, JWT_SECRET, { algorithm: 'HS256' });

    res.json({
        token,
        userId,
        expiresIn: '1h'
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'aicin-demo',
        timestamp: new Date().toISOString()
    });
});

// Serve demo page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 AICIN Demo Server Running`);
    console.log(`   URL: http://localhost:${PORT}`);
    console.log(`   JWT Secret: ${JWT_SECRET.substring(0, 10)}...`);
    console.log(`\n📋 Open your browser to take the quiz!\n`);
});
