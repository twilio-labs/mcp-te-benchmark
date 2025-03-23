// metrics-server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

// Create metrics directory if it doesn't exist
const METRICS_DIR = path.join(__dirname, 'metrics');
if (!fs.existsSync(METRICS_DIR)) {
  fs.mkdirSync(METRICS_DIR);
}

app.use(express.json());

// Start tracking a new test session
app.post('/metrics/start', (req, res) => {
  const { taskId, mode } = req.body;
  const sessionId = `${mode}_task${taskId}_${Date.now()}`;
  
  const sessionData = {
    sessionId,
    taskId,
    mode,
    startTime: new Date().toISOString(),
    apiCalls: [],
    interactions: [],
    endTime: null,
    duration: null,
    success: null
  };
  
  // Save initial session data
  fs.writeFileSync(
    path.join(METRICS_DIR, `${sessionId}.json`),
    JSON.stringify(sessionData, null, 2)
  );
  
  res.json({ 
    status: 'success', 
    sessionId,
    message: `Started metrics collection for ${mode} task ${taskId}`
  });
});

// Log an API call
app.post('/metrics/api-call', (req, res) => {
  const { sessionId, endpoint, method, success, details } = req.body;
  const sessionFile = path.join(METRICS_DIR, `${sessionId}.json`);
  
  if (!fs.existsSync(sessionFile)) {
    return res.status(404).json({ 
      status: 'error', 
      message: `Session ${sessionId} not found` 
    });
  }
  
  const sessionData = JSON.parse(fs.readFileSync(sessionFile));
  
  sessionData.apiCalls.push({
    timestamp: new Date().toISOString(),
    endpoint,
    method,
    success,
    details
  });
  
  fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2));
  
  res.json({ 
    status: 'success', 
    message: `Logged API call to ${endpoint}` 
  });
});

// Log an AI interaction
app.post('/metrics/interaction', (req, res) => {
  const { sessionId, type, details } = req.body;
  const sessionFile = path.join(METRICS_DIR, `${sessionId}.json`);
  
  if (!fs.existsSync(sessionFile)) {
    return res.status(404).json({ 
      status: 'error', 
      message: `Session ${sessionId} not found` 
    });
  }
  
  const sessionData = JSON.parse(fs.readFileSync(sessionFile));
  
  sessionData.interactions.push({
    timestamp: new Date().toISOString(),
    type,
    details
  });
  
  fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2));
  
  res.json({ 
    status: 'success', 
    message: `Logged interaction of type ${type}` 
  });
});

// Complete a test session
app.post('/metrics/complete', (req, res) => {
  const { sessionId, success, notes } = req.body;
  const sessionFile = path.join(METRICS_DIR, `${sessionId}.json`);
  
  if (!fs.existsSync(sessionFile)) {
    return res.status(404).json({ 
      status: 'error', 
      message: `Session ${sessionId} not found` 
    });
  }
  
  const sessionData = JSON.parse(fs.readFileSync(sessionFile));
  
  sessionData.endTime = new Date().toISOString();
  sessionData.duration = (new Date(sessionData.endTime) - new Date(sessionData.startTime)) / 1000; // in seconds
  sessionData.success = success;
  sessionData.notes = notes || '';
  
  fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2));
  
  // Update results.md file
  updateResultsFile(sessionData);
  
  res.json({ 
    status: 'success', 
    message: `Completed metrics collection for session ${sessionId}`,
    duration: sessionData.duration,
    apiCalls: sessionData.apiCalls.length,
    interactions: sessionData.interactions.length
  });
});

// Get session status
app.get('/metrics/status/:sessionId', (req, res) => {
  const sessionFile = path.join(METRICS_DIR, `${req.params.sessionId}.json`);
  
  if (!fs.existsSync(sessionFile)) {
    return res.status(404).json({ 
      status: 'error', 
      message: `Session ${req.params.sessionId} not found` 
    });
  }
  
  const sessionData = JSON.parse(fs.readFileSync(sessionFile));
  
  res.json({
    status: 'success',
    data: {
      taskId: sessionData.taskId,
      mode: sessionData.mode,
      startTime: sessionData.startTime,
      endTime: sessionData.endTime,
      duration: sessionData.duration,
      apiCalls: sessionData.apiCalls.length,
      interactions: sessionData.interactions.length,
      complete: !!sessionData.endTime
    }
  });
});

function updateResultsFile(sessionData) {
  const resultsFile = path.join(__dirname, 'results.md');
  let resultsContent = '';
  
  if (fs.existsSync(resultsFile)) {
    resultsContent = fs.readFileSync(resultsFile, 'utf8');
  } else {
    // Create initial results file
    resultsContent = `## Results Table

| Task | Mode      | Start Time | End Time | Duration | API Calls | Interactions | Success | Notes |
|------|-----------|------------|----------|----------|-----------|--------------|---------|-------|
| 1    | Control   |            |          |          |           |              |         |       |
| 1    | MCP       |            |          |          |           |              |         |       |
| 2    | Control   |            |          |          |           |              |         |       |
| 2    | MCP       |            |          |          |           |              |         |       |
| 3    | Control   |            |          |          |           |              |         |       |
| 3    | MCP       |            |          |          |           |              |         |       |`;
  }
  
  // Find and update the corresponding row
  const lines = resultsContent.split('\n');
  const tableStartIndex = lines.findIndex(line => line.startsWith('| Task | Mode'));
  
  if (tableStartIndex === -1) {
    console.error('Could not find results table');
    return;
  }
  
  const startTimeFormatted = new Date(sessionData.startTime).toLocaleTimeString();
  const endTimeFormatted = new Date(sessionData.endTime).toLocaleTimeString();
  
  // Loop through lines to find the matching task and mode
  for (let i = tableStartIndex + 2; i < lines.length; i++) {
    if (lines[i].startsWith(`| ${sessionData.taskId}    | ${sessionData.mode}`)) {
      lines[i] = `| ${sessionData.taskId}    | ${sessionData.mode}       | ${startTimeFormatted} | ${endTimeFormatted} | ${sessionData.duration.toFixed(1)}s | ${sessionData.apiCalls.length} | ${sessionData.interactions.length} | ${sessionData.success ? '✅' : '❌'} | ${sessionData.notes} |`;
      break;
    }
  }
  
  fs.writeFileSync(resultsFile, lines.join('\n'));
}

app.listen(PORT, () => {
  console.log(`Metrics server running on http://localhost:${PORT}`);
});