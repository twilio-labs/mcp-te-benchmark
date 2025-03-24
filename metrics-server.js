const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Store metrics in memory
const activeTests = new Map();

// Ensure metrics directory exists
const metricsDir = path.join(__dirname, 'metrics');
if (!fs.existsSync(metricsDir)) {
    fs.mkdirSync(metricsDir);
}

// Start a new test session
app.post('/test/start', (req, res) => {
    const { mode, taskNumber } = req.body;
    const testId = `${mode}_task${taskNumber}_${Date.now()}`;
    
    activeTests.set(testId, {
        mode,
        taskNumber,
        startTime: Date.now(),
        apiCalls: 0,
        interactions: 0,
        completed: false
    });
    
    res.json({ testId });
});

// Record an API call
app.post('/test/api-call', (req, res) => {
    const { testId } = req.body;
    const test = activeTests.get(testId);
    
    if (test) {
        test.apiCalls++;
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Test not found' });
    }
});

// Record an interaction
app.post('/test/interaction', (req, res) => {
    const { testId } = req.body;
    const test = activeTests.get(testId);
    
    if (test) {
        test.interactions++;
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Test not found' });
    }
});

// Complete a test
app.post('/test/complete', (req, res) => {
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
app.get('/test/results', (req, res) => {
    const results = [];
    
    fs.readdirSync(metricsDir).forEach(file => {
        if (file.endsWith('.json')) {
            const data = fs.readFileSync(path.join(metricsDir, file));
            results.push(JSON.parse(data));
        }
    });
    
    res.json(results);
});

// Start the server
app.listen(port, () => {
    console.log(`Metrics server running on port ${port}`);
}); 