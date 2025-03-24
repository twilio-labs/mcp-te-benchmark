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
   curl -X POST http://localhost:3000/metrics/start -H "Content-Type: application/json" -d '{"taskId": TASK_NUMBER, "mode": "MODE"}'
   ```

2. **Task Completion**:
   ```bash
   curl -X POST http://localhost:3000/metrics/complete -H "Content-Type: application/json" -d '{"sessionId": "SESSION_ID", "success": true|false, "notes": "Any notes about completion"}'
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

## Results Analysis

After all tests are complete:
- Run `node generate-summary.js` to see performance comparison
- Compare the duration times between control and MCP implementations
- The performance improvement will be shown as percentage reduction in task completion time

## Troubleshooting

If timing data is not being recorded properly:
- Ensure the metrics server is running
- Check that the AI assistant is executing both the start and complete commands
- Verify the sessionId is being passed correctly from start to complete

This simplified approach focuses solely on the key performance metric of task completion time while minimizing instrumentation complexity.