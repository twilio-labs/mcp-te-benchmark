# Twilio MCP Testing Protocol

## Overview

This document outlines the simplified testing methodology for evaluating performance gains when using Twilio's Model Context Protocol (MCP) compared to traditional API approaches.

## Test Objective

Measure the time required to complete each task using traditional API approaches versus MCP-enabled implementations.

## Metrics Collection

### Automated Approach
Metrics are now automatically collected from Claude chat logs. The system tracks:

1. **Duration:** Time from task start to completion
2. **API Calls:** Number of API calls made during task completion
3. **Interactions:** Number of exchanges between the user and the AI assistant
4. **Token Usage:** Input and output tokens used during the task
5. **Cost:** Estimated cost based on token usage

No manual timing commands are needed. The AI assistant simply completes the task, and all metrics are extracted from the chat logs afterward.

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
1. Start the dashboard server:
   ```bash
   npm start
   ```

### Running Tests
For each test:

1. Open Cline and start a new chat with Claude

2. Upload the appropriate instruction file as context:
   - For control tests: `agent-instructions/control_instructions.md`
   - For MCP tests: `agent-instructions/mcp_instructions.md`

3. Start the test with: `Complete Task [TASK_NUMBER] using the commands in the instructions`

4. The AI assistant will complete the task, and all metrics will be automatically collected from the chat logs

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
npm run regenerate-summary
```

The performance improvement will be shown as percentage reduction in task completion time.

## Troubleshooting

If metrics are not being extracted properly:
- Ensure the chat logs are being saved correctly in Cline
- Check that the AI assistant completed the task successfully
- Try running the extraction with the `--verbose` flag for more detailed logging:
  ```bash
  npm run extract-metrics -- --verbose
  ```

For dashboard issues:
- Make sure the dashboard server is running (`npm start`)
- Check browser console for any JavaScript errors
- Verify metrics files exist in the `src/server/metrics/` directory
