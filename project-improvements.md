# Adding "model" Metric to Twilio MCP Performance Testing Framework

I'll provide step-by-step instructions to add the "model" metric to track which AI model was used in each test.

## 1. Update `scripts/run-test.sh`

First, modify the run-test.sh script to accept and process the model parameter:

```bash
#!/bin/bash
# run-test.sh

# Verify arguments
if [ $# -lt 2 ]; then
  echo "Usage: ./scripts/run-test.sh [control|mcp] [1|2|3] [model-name]"
  echo "Example: ./scripts/run-test.sh control 1 gpt-4"
  echo "Example: ./scripts/run-test.sh mcp 2 3.7-sonnet"
  exit 1
fi

MODE=$1
TASK_ID=$2
MODEL=${3:-"unknown"}  # Default to "unknown" if not provided

# Validate arguments
if [[ "$MODE" != "control" && "$MODE" != "mcp" ]]; then
  echo "Error: Mode must be 'control' or 'mcp'"
  exit 1
fi

if [[ "$TASK_ID" != "1" && "$TASK_ID" != "2" && "$TASK_ID" != "3" ]]; then
  echo "Error: Task ID must be 1, 2, or 3"
  exit 1
fi

# Check if metrics server is running
if ! curl -s http://localhost:3000/metrics/status > /dev/null; then
  echo "Error: Metrics server is not running. Start it with: npm run start:metrics"
  exit 1
fi

echo "===================================="
echo "Starting $MODE test for Task $TASK_ID using model $MODEL"
echo "===================================="
echo ""
echo "Instructions:"
echo "1. Open Cursor and start a new chat"
echo "2. Load the docs/${MODE}_instructions.md file as context"
echo "3. Start the test by sending: 'Complete Task $TASK_ID using the commands in the instructions'"
echo ""
echo "Press Enter when you're ready to start, or Ctrl+C to cancel..."
read

# Start the test and capture test ID
TEST_ID=$(curl -s -X POST http://localhost:3000/metrics/start -H "Content-Type: application/json" -d "{\"mode\": \"$MODE\", \"taskNumber\": $TASK_ID, \"model\": \"$MODEL\"}" | jq -r '.testId')

if [ -z "$TEST_ID" ]; then
  echo "Error: Failed to get test ID from server"
  exit 1
fi

START_TIME=$(date +%s)
echo "Test started at $(date)"
echo "Test ID: $TEST_ID"
echo ""
echo "Press Enter when the test is complete..."
read
END_TIME=$(date +%s)

# Complete the test
curl -s -X POST http://localhost:3000/metrics/complete -H "Content-Type: application/json" -d "{\"testId\": \"$TEST_ID\", \"success\": true}"

DURATION=$((END_TIME - START_TIME))

echo ""
echo "Test completed in $DURATION seconds"
echo ""
echo "Generating summary..."
echo ""
npm run generate-summary

echo ""
echo "View dashboard with: open src/client/dashboard/index.html"
```

## 2. Update `src/server/metrics-server.js`

Modify the metrics server to store the model information:

```javascript
// Start a new test session
app.post('/metrics/start', (req, res) => {
    const { mode, taskNumber, model } = req.body;
    const testId = `${mode}_task${taskNumber}_${Date.now()}`;
    
    const test = {
        mode,
        taskNumber,
        model: model || 'unknown', // Add model parameter with default fallback
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
```

## 3. Update `src/cli/generate-summary.js`

Modify the summary generator to include model information:

```javascript
// Process all session files and generate summary
function generateSummary() {
  const files = fs.readdirSync(METRICS_DIR)
    .filter(file => file.endsWith('.json') && !file.startsWith('summary'));
  
  const sessions = [];
  
  files.forEach(file => {
    try {
      const sessionData = JSON.parse(fs.readFileSync(path.join(METRICS_DIR, file)));
      
      // Only include completed sessions
      if (sessionData.endTime) {
        sessions.push({
          taskId: sessionData.taskNumber || sessionData.taskId,
          mode: sessionData.mode,
          model: sessionData.model || 'unknown', // Include model information
          startTime: sessionData.startTime,
          endTime: sessionData.endTime,
          duration: sessionData.duration,
          apiCalls: Array.isArray(sessionData.apiCalls) ? sessionData.apiCalls.length : sessionData.apiCalls,
          interactions: Array.isArray(sessionData.interactions) ? sessionData.interactions.length : sessionData.interactions,
          success: sessionData.success,
          notes: sessionData.notes || ''
        });
      }
    } catch (error) {
      console.error(`Error processing file ${file}:`, error);
    }
  });
  
  // Sort by task ID, mode, and model
  sessions.sort((a, b) => {
    if (a.taskId === b.taskId) {
      if (a.mode === b.mode) {
        return a.model.localeCompare(b.model);
      }
      return a.mode.localeCompare(b.mode);
    }
    return a.taskId - b.taskId;
  });
  
  // Write summary file
  fs.writeFileSync(
    path.join(METRICS_DIR, 'summary.json'),
    JSON.stringify(sessions, null, 2)
  );
  
  console.log(`Generated summary for ${sessions.length} completed sessions`);
  
  // Calculate overall metrics
  if (sessions.length > 0) {
    // Group sessions by model
    const modelGroups = groupBy(sessions, 'model');
    
    // Display performance by model
    console.log('\nPerformance by Model:');
    console.log('-------------------');
    
    for (const [model, modelSessions] of Object.entries(modelGroups)) {
      const modelControlSessions = modelSessions.filter(s => s.mode === 'control');
      const modelMcpSessions = modelSessions.filter(s => s.mode === 'mcp');
      
      if (modelSessions.length > 0) {
        console.log(`\nModel: ${model}`);
        
        if (modelControlSessions.length > 0 && modelMcpSessions.length > 0) {
          const modelControlAvgDuration = average(modelControlSessions.map(s => s.duration));
          const modelMcpAvgDuration = average(modelMcpSessions.map(s => s.duration));
          
          console.log(`  Average Duration: Control=${modelControlAvgDuration.toFixed(1)}s, MCP=${modelMcpAvgDuration.toFixed(1)}s (${percentageChange(modelMcpAvgDuration, modelControlAvgDuration)}% change)`);
        } else {
          console.log(`  Average Duration: ${average(modelSessions.map(s => s.duration)).toFixed(1)}s`);
        }
      }
    }
    
    // Original summary (all models combined)
    const controlSessions = sessions.filter(s => s.mode === 'control');
    const mcpSessions = sessions.filter(s => s.mode === 'mcp');
    
    const controlAvgDuration = average(controlSessions.map(s => s.duration));
    const mcpAvgDuration = average(mcpSessions.map(s => s.duration));
    
    const controlAvgApiCalls = average(controlSessions.map(s => s.apiCalls));
    const mcpAvgApiCalls = average(mcpSessions.map(s => s.apiCalls));
    
    const controlAvgInteractions = average(controlSessions.map(s => s.interactions));
    const mcpAvgInteractions = average(mcpSessions.map(s => s.interactions));
    
    const controlSuccessRate = percentage(controlSessions.filter(s => s.success).length, controlSessions.length);
    const mcpSuccessRate = percentage(mcpSessions.filter(s => s.success).length, mcpSessions.length);
    
    console.log('\nOverall Performance Summary (All Models):');
    console.log('-------------------');
    console.log(`Average Duration: Control=${controlAvgDuration.toFixed(1)}s, MCP=${mcpAvgDuration.toFixed(1)}s (${percentageChange(mcpAvgDuration, controlAvgDuration)}% change)`);
    console.log(`Average API Calls: Control=${controlAvgApiCalls.toFixed(1)}, MCP=${mcpAvgApiCalls.toFixed(1)} (${percentageChange(mcpAvgApiCalls, controlAvgApiCalls)}% change)`);
    console.log(`Average Interactions: Control=${controlAvgInteractions.toFixed(1)}, MCP=${mcpAvgInteractions.toFixed(1)} (${percentageChange(mcpAvgInteractions, controlAvgInteractions)}% change)`);
    console.log(`Success Rate: Control=${controlSuccessRate.toFixed(1)}%, MCP=${mcpSuccessRate.toFixed(1)}% (${percentageChange(mcpSuccessRate, controlSuccessRate)}% change)`);
  }
}

// Helper function to group sessions by a property
function groupBy(array, key) {
  return array.reduce((result, item) => {
    (result[item[key]] = result[item[key]] || []).push(item);
    return result;
  }, {});
}
```

## 4. Update `src/server/dashboard.html`

Finally, update the dashboard to display model information:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>MCP Performance Dashboard</title>
    <style>
        /* Existing styles */
        /* ... */
        
        /* Add new styles for model sections */
        .model-section {
            margin-top: 40px;
            margin-bottom: 20px;
        }
        .model-title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 15px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>MCP Performance Dashboard</h1>
        <div class="metrics" id="summary"></div>
        
        <!-- New section for model-specific metrics -->
        <div id="modelMetrics"></div>
        
        <table class="sessions" id="sessionsTable">
            <thead>
                <tr>
                    <th>Task ID</th>
                    <th>Mode</th>
                    <th>Model</th>
                    <th>Duration (s)</th>
                    <th>API Calls</th>
                    <th>Interactions</th>
                    <th>Success</th>
                    <th>Notes</th>
                </tr>
            </thead>
            <tbody id="sessionsBody"></tbody>
        </table>
    </div>

    <script>
        async function loadData() {
            try {
                const response = await fetch('/metrics/summary.json');
                const data = await response.json();
                
                // Process and display the data
                displayMetrics(data);
                displayModelMetrics(data);  // New function to display model metrics
                displaySessions(data);
            } catch (error) {
                console.error('Error loading data:', error);
            }
        }

        // Existing displayMetrics function
        // ...

        // New function to display metrics by model
        function displayModelMetrics(sessions) {
            // Group sessions by model
            const models = {};
            sessions.forEach(session => {
                const model = session.model || 'unknown';
                if (!models[model]) {
                    models[model] = {
                        control: [],
                        mcp: []
                    };
                }
                
                if (session.mode === 'control') {
                    models[model].control.push(session);
                } else if (session.mode === 'mcp') {
                    models[model].mcp.push(session);
                }
            });
            
            // Create metrics per model
            const modelMetricsEl = document.getElementById('modelMetrics');
            modelMetricsEl.innerHTML = '';
            
            for (const [model, data] of Object.entries(models)) {
                const controlAvgDuration = average(data.control.map(s => s.duration));
                const mcpAvgDuration = average(data.mcp.map(s => s.duration));
                
                const section = document.createElement('div');
                section.className = 'model-section';
                
                section.innerHTML = `
                    <div class="model-title">Model: ${model}</div>
                    <div class="metrics">
                        <div class="metric-card">
                            <div class="metric-title">Average Duration</div>
                            <div>Control: ${controlAvgDuration.toFixed(1)}s</div>
                            <div>MCP: ${mcpAvgDuration.toFixed(1)}s</div>
                            <div>Change: ${percentageChange(mcpAvgDuration, controlAvgDuration)}%</div>
                        </div>
                    </div>
                `;
                
                modelMetricsEl.appendChild(section);
            }
        }

        // Update displaySessions function to include model column
        function displaySessions(sessions) {
            const tbody = document.getElementById('sessionsBody');
            tbody.innerHTML = sessions
                .map(s => `
                    <tr>
                        <td>${s.taskId}</td>
                        <td>${s.mode}</td>
                        <td>${s.model || 'unknown'}</td>
                        <td>${(s.duration/1000).toFixed(1)}</td>
                        <td>${s.apiCalls}</td>
                        <td>${s.interactions}</td>
                        <td>${s.success ? '&#x2714;' : '&#x2718;'}</td>
                        <td>${s.notes}</td>
                    </tr>
                `).join('');
        }

        // Existing helper functions
        // ...
    </script>
</body>
</html>
```

## 5. Update the CLI tool (src/cli/run-test.js)

Don't forget to update the command-line interface to accept the model parameter:

```javascript
// Command to run a single test
program
  .command('run')
  .description('Run a single test')
  .option('-m, --mode <mode>', 'Test mode (control or mcp)', 'control')
  .option('-t, --task <task>', 'Task number (1, 2, or 3)', '1')
  .option('-a, --model <model>', 'AI model name', 'unknown')
  .option('-y, --yes', 'Skip confirmation', false)
  .action(async (options) => {
    // Validate inputs
    if (!['control', 'mcp'].includes(options.mode)) {
      console.error('Error: Mode must be "control" or "mcp"');
      process.exit(1);
    }
    
    if (!['1', '2', '3'].includes(options.task)) {
      console.error('Error: Task must be 1, 2, or 3');
      process.exit(1);
    }
    
    // Check if metrics server is running
    // ...
    
    // Confirm test if not using --yes
    if (!options.yes) {
      const answers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Run ${options.mode} test for Task ${options.task} using model ${options.model}?`,
          default: true
        }
      ]);
      
      if (!answers.confirm) {
        console.log('Test canceled');
        process.exit(0);
      }
    }
    
    // Run the test
    console.log(`Running ${options.mode} test for Task ${options.task} with model ${options.model}...`);
    exec(`./run-test.sh ${options.mode} ${options.task} ${options.model}`, (error, stdout, stderr) => {
      // ...
    });
  });
```

## Testing Your Implementation

After implementing these changes:

1. Restart both the metrics server and dashboard server:
   ```
   npm run start:metrics
   npm start
   ```

2. Run a test with the model parameter:
   ```
   ./scripts/run-test.sh mcp 1 3.7-sonnet
   ```

3. Verify that the model information is being captured in:
   - The test start log output 
   - The metrics JSON files in the metrics directory
   - The summary output
   - The dashboard display

These changes will allow you to track which AI model was used for each test, compare performance between different models, and visualize the results in the dashboard.