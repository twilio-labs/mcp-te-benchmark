const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const config = require('../utils/config');

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Store metrics in memory
const activeTests = new Map();

// Ensure metrics directory exists
const metricsDir = config.metrics.dataPath;
if (!fs.existsSync(metricsDir)) {
    fs.mkdirSync(metricsDir, { recursive: true });
}

// Start a new test session
app.post('/metrics/start', (req, res) => {
    const { mode, taskNumber } = req.body;
    const testId = `${mode}_task${taskNumber}_${Date.now()}`;
    
    const test = {
        mode,
        taskNumber,
        startTime: Date.now(),
        completed: false,
        apiCalls: [],
        interactions: []
    };
    
    // Save test to memory and file
    activeTests.set(testId, test);
    const filename = path.join(metricsDir, `${testId}.json`);
    fs.writeFileSync(filename, JSON.stringify(test, null, 2));
    
    res.json({ testId });
});

// Complete a test session
app.post('/metrics/complete', (req, res) => {
    const { testId, success } = req.body;
    const test = activeTests.get(testId);
    
    if (test) {
        test.completed = true;
        test.success = success;
        test.endTime = Date.now();
        test.duration = test.endTime - test.startTime;
        
        // Save test results to file
        const filename = path.join(metricsDir, `${testId}.json`);
        fs.writeFileSync(filename, JSON.stringify(test, null, 2));
        
        // Remove from active tests
        activeTests.delete(testId);
        
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Test not found' });
    }
});

// Get test results
app.get('/metrics/results', (req, res) => {
    const results = [];
    
    fs.readdirSync(metricsDir).forEach(file => {
        if (file.endsWith('.json')) {
            const data = fs.readFileSync(path.join(metricsDir, file));
            results.push(JSON.parse(data));
        }
    });
    
    res.json(results);
});

// Health check endpoint
app.get('/metrics/status', (req, res) => {
    res.json({ status: 'ok' });
});

// Start the server
app.listen(port, () => {
    console.log(`Metrics server running on port ${port}`);
}); 