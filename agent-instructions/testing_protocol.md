# Twilio MCP Testing Protocol

## Overview

This document outlines the simplified testing methodology for evaluating performance gains when using Twilio's Model Context Protocol (MCP) compared to traditional API approaches.

## Test Objective

Measure the time required to complete each task using traditional API approaches versus MCP-enabled implementations.

## Metrics Collection

### Simplified Approach
We will focus only on tracking:
1. **When a task starts**
2. **When a task ends**

This allows us to calculate the total duration without complicated instrumentation.

### Task Timing Commands

The AI assistant should execute only these two commands per task:

1. **Task Start**:
   ```bash
   curl -X POST http://localhost:3000/test/start -H "Content-Type: application/json" -d '{"taskId": TASK_NUMBER, "mode": "MODE"}'
   ```

2. **Task Completion**:
   ```bash
   curl -X POST http://localhost:3000/test/complete -H "Content-Type: application/json" -d '{"sessionId": "SESSION_ID", "success": true|false, "notes": "Any notes about completion"}'
   ```

## Test Tasks

### Task 1: Purchase a Canadian Phone Number
- **Start**: When the AI assistant begins searching for Canadian numbers
- **End**: When a Canadian phone number has been successfully purchased

### Task 2: Create a Task Router Activity
- **Start**: When the AI assistant begins creating the activity
- **End**: When the "Bathroom" activity has been successfully created

### Task 3: Create a Queue with Task Filter
- **Start**: When the AI assistant begins creating the queue
- **End**: When the queue with proper task filter has been successfully created

## Testing Procedure

### Setup
1. Start the metrics server:
   ```bash
   node metrics-server.js
   ```

2. (Optional) Start the dashboard server for real-time visualization:
   ```bash
   node server.js
   ```

### Running Tests
For each test:

1. Execute the test runner:
   ```bash
   ./run-test.sh [control|mcp] [1|2|3]
   ```

2. Follow the on-screen instructions:
   - Open Cursor and start a new chat
   - Upload the appropriate instruction file as context
   - Start the test with: `Complete Task [TASK_NUMBER] using the commands in the instructions`

3. The AI assistant should:
   - Execute the start command when beginning the task
   - Execute the complete command when finishing the task

4. Press Enter in the terminal window when finished

### Verification
Confirm in the results.md file:
- Start time was recorded
- End time was recorded
- Duration was calculated

## Extracting Metrics from Chat Logs

After running tests, you need to extract metrics from the Claude chat logs:

```bash
npm run extract-metrics
```

This script analyzes the Claude chat logs and automatically extracts:
- Duration of each task
- Number of API calls
- Number of user interactions
- Token usage and estimated cost
- Success/failure status

You can also specify the model, client, and server names to use in the metrics:

```bash
npm run extract-metrics -- --model <model-name> --client <client-name> --server <server-name>
```

For example:
```bash
npm run extract-metrics -- --model claude-3.7-sonnet --client Cline --server Twilio
```

These arguments are optional and will override any values found in the logs or the default values. This is useful when the information isn't available in the logs or needs to be standardized across different runs.

Additional options:
- `--force` or `-f`: Force regeneration of all metrics, even if they already exist
- `--verbose` or `-v`: Enable verbose logging for debugging
- `--help` or `-h`: Show help message

## Results Analysis

After tests are complete and metrics are extracted, you have multiple ways to view and analyze results:

### Interactive Dashboard
The dashboard provides visual comparison of metrics:

1. Access the dashboard:
   ```
   http://localhost:3001
   ```

2. The dashboard shows:
   - Task completion time comparison
   - API calls per task
   - Interactions per task
   - Success rate comparison
   - Detailed results table

3. Use the "Refresh Data" button to update with latest results

### Command Line Summary
For a text-based summary:
```bash
node generate-summary.js
```

The performance improvement will be shown as percentage reduction in task completion time.

## Troubleshooting

If timing data is not being recorded properly:
- Ensure the metrics server is running
- Check that the AI assistant is executing both the start and complete commands
- Verify the sessionId is being passed correctly from start to complete

For dashboard issues:
- Make sure both servers are running (metrics-server.js on port 3000 and server.js on port 3001)
- Check browser console for any JavaScript errors
- Verify metrics files exist in the metrics directory

This approach focuses on task completion time while providing comprehensive visualization for analysis.
