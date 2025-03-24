const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('../utils/config');

const app = express();
const port = config.server.metricsPort;

// Middleware
app.use(cors());
app.use(express.json());

// Create metrics directory if it doesn't exist
const metricsDir = config.metrics.dataPath;
console.log('Using metrics directory:', metricsDir);

if (!fs.existsSync(metricsDir)) {
    fs.mkdirSync(metricsDir, { recursive: true });
}

// In-memory storage for active tests
const activeTests = new Map();

// Change the route from '/metrics/start' to '/test/start'
app.post('/test/start', (req, res) => {
    console.log('Start request body:', req.body);
    const { mode, taskNumber, model } = req.body;
    const testId = `${mode}_task${taskNumber}_${Date.now()}`;
    
    const test = {
        mode,
        taskNumber,
        model: model || 'unknown',
        startTime: Date.now(),
        completed: false,
        apiCalls: [],
        interactions: []
    };
    
    console.log('Created test object:', test);
    
    // Save test to memory and file
    activeTests.set(testId, test);
    const filename = path.join(metricsDir, `${testId}.json`);
    fs.writeFileSync(filename, JSON.stringify(test, null, 2));
    
    res.json({ testId });
});

// Change the route from '/metrics/complete' to '/test/complete'
app.post('/test/complete', (req, res) => {
    const { testId, success } = req.body;
    console.log('Complete request - testId:', testId);
    const test = activeTests.get(testId);
    console.log('Retrieved test from memory:', test);
    
    if (test) {
        // Update test data while preserving existing fields
        const updatedTest = {
            ...test,
            completed: true,
            success: success,
            endTime: Date.now()
        };
        updatedTest.duration = updatedTest.endTime - updatedTest.startTime;
        
        console.log('Updated test object:', updatedTest);
        
        // Save test results to file
        const filename = path.join(metricsDir, `${testId}.json`);
        fs.writeFileSync(filename, JSON.stringify(updatedTest, null, 2));
        
        // Remove from active tests
        activeTests.delete(testId);
        
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Test not found' });
    }
});

// Add an alias for the status endpoint to maintain compatibility
app.get('/test/status', (req, res) => {
    res.json({ status: 'ok' });
});

// Start the server
app.listen(port, () => {
    console.log(`Metrics server listening at http://localhost:${port}`);
});