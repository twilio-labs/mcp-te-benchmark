<p align="center"><img src="docs/twilioAlphaLogoLight.png#gh-dark-mode-only" height="100" alt="Twilio Alpha"/><img src="docs/twilioAlphaLogoDark.png#gh-light-mode-only" height="100" alt="Twilio Alpha"/></p>
<h1 align="center">MCP-TE Benchmark</h1> 

A standardized framework for evaluating the efficiency gains of AI agents using Model Context Protocol (MCP) compared to custom tools, such as terminal execution and web search.

## Abstract

MCP-TE Benchmark (where "TE" stands for "Task Efficiency") is designed to measure the efficiency gains and qualitative differences when AI coding agents utilize structured context protocols (like MCP) compared to traditional development methods (e.g., documentation lookup, trial-and-error). As AI coding assistants become more integrated into development workflows, understanding how they interact with APIs and structured protocols becomes increasingly important for optimizing developer productivity and cost.

## Leaderboard

**Note:** Due to a limitation in the current MCP Client (Cursor), model selection is restricted in some test runs. 'Auto' indicates the client's automatic model selection. Results for specific models will be added as they become available.

### Overall Performance

| Metric | Control | MCP | Improvement |
|--------|---------|-----|-------------|
| Average Duration (s) | 43.3 | 42.7 | -1.4% |
| Average API Calls | 6.9 | 2.5 | -63.8% |
| Average Interactions | 1.2 | 1.0 | -16.7% |
| Success Rate | 100.0% | 100.0% | 0.0% |

*Environment:* Twilio (MCP Server), Cursor (MCP Client), Mixed models

### Task-Specific Performance

#### Twilio - Task 1: Purchase a Canadian Phone Number

| Model | Mode | Duration (s) | API Calls | Interactions | Success |
|-------|------|--------------|-----------|--------------|---------|
| auto | Control | 20.7 | 3.5 | 1.0 | 100% |
| auto | MCP | 38.4 | 2.3 | 1.0 | 100% |
| claude-3.7-sonnet | Control | 64.3 | 9.0 | 1.0 | 100% |
| claude-3.7-sonnet | MCP | 42.2 | 3.0 | 1.0 | 100% |

#### Twilio - Task 2: Create a Task Router Activity

| Model | Mode | Duration (s) | API Calls | Interactions | Success |
|-------|------|--------------|-----------|--------------|---------|
| auto | Control | 65.6 | 14.0 | 2.0 | 100% |
| auto | MCP | 43.5 | 3.0 | 1.0 | 100% |
| claude-3.7-sonnet | Control | 35.3 | 4.0 | 1.0 | 100% |
| claude-3.7-sonnet | MCP | N/A | N/A | N/A | N/A |

#### Twilio - Task 3: Create a Queue with Task Filter

| Model | Mode | Duration (s) | API Calls | Interactions | Success |
|-------|------|--------------|-----------|--------------|---------|
| auto | Control | 38.5 | 5.0 | 1.0 | 100% |
| auto | MCP | 45.2 | 2.0 | 1.0 | 100% |
| claude-3.7-sonnet | Control | 40.1 | 4.0 | 1.0 | 100% |
| claude-3.7-sonnet | MCP | N/A | N/A | N/A | N/A |

## Benchmark Design & Metrics

The MCP-TE Benchmark evaluates AI coding agents' performance using a Control vs. Treatment methodology:

- **Control Group:** Completion of API tasks using traditional methods (web search, documentation, and terminal capabilities)
- **Treatment Group:** Completion of the same API tasks using Model Context Protocol (MCP)

### Key Metrics

| Metric | Description |
|--------|-------------|
| Duration | Time taken to complete a task from start to finish (in seconds) |
| API Calls | Number of API calls made during task completion |
| Interactions | Number of exchanges between the user and the AI assistant |
| Success Rate | Percentage of tasks completed successfully |

### Metrics Collection

All metrics are now collected automatically from the Cline chat logs:

- **Duration:** Time from task start to completion, measured automatically
- **API Calls:** Number of API calls made during task completion, extracted from chat logs
- **Interactions:** Number of exchanges between the user and the AI assistant, extracted from chat logs
- **Cost:** Estimated cost of the task based on token usage, calculated from chat logs
- **Success Rate:** Percentage of tasks completed successfully

To extract metrics from chat logs, run:
```
./scripts/extract-metrics.sh
```

This script will analyze the Claude chat logs and generate metrics files in the `src/server/metrics/` directory, including an updated `summary.json` file that powers the dashboard.

## Tasks

The current benchmark includes the following tasks specific to the Twilio MCP Server:

1. **Purchase a Canadian Phone Number:** Search for and purchase an available Canadian phone number (preferably with area code 416)
2. **Create a Task Router Activity:** Create a new Task Router activity named "Bathroom"
3. **Create a Queue with Task Filter:** Create a queue with a task filter that prevents routing tasks to workers in the "Bathroom" activity

While the initial task suite focuses on Twilio MCP Server functionality, the MCP-TE framework is designed to be adaptable to other APIs and context protocols.

## Setup

1. Clone this repository:
   ```
   git clone https://github.com/nmogil-tw/mcp-te-benchmark.git
   ```
2. Run the setup script:
   ```
   ./scripts/setup.sh
   ```
3. Create your `.env` file from the example:
   ```
   cp .env.example .env
   ```
4. Edit the `.env` file with your Twilio credentials
5. Install dependencies:
   ```
   npm install
   ```
6. Start the metrics server:
   ```
   npm run start:metrics
   ```
7. Start the dashboard server (optional, for real-time visualization):
   ```
   npm start
   ```

## Running Tests

### Testing Protocol

1. Start the metrics server if not already running:
   ```
   npm run start:metrics
   ```

2. Use the run-test.sh script to prepare a specific test:
   ```
   ./scripts/run-test.sh [control|mcp] [1|2|3] [model-name]
   ```
   Where:
   - First parameter is the test mode (control or mcp)
   - Second parameter is the task number (1, 2, or 3)
   - Third parameter is the model name (e.g., "claude-3.7-sonnet")

3. Follow the on-screen instructions:
   - Open Cursor with the AI Agent
   - Load the appropriate instructions file (control_instructions.md or mcp_instructions.md) as context
   - Start the conversation with: "Complete Task [TASK_NUMBER] using the commands in the instructions"

4. The AI agent will then:
   - Read the instructions
   - Execute the start curl command to begin timing
   - Complete the required task
   - Execute the complete curl command to end timing

5. After the AI agent completes the task, press Enter in the terminal window to continue with the next test or generate the summary

6. Important: Before running tests, ensure the instruction documents contain the correct endpoint paths:
   - The start command should use `/metrics/start`
   - The complete command should use `/metrics/complete`
   - The model parameter should be included in the start command

### Batch Testing

To run all tests in sequence:
```
./scripts/run-test.sh run-all --model [model-name]
```

## Viewing Results

### Extracting Metrics from Chat Logs

Before viewing results, extract metrics from Claude chat logs:

```
npm run extract-metrics
```

This script analyzes the Claude chat logs in `/Users/nmogil/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/tasks` and automatically extracts:
- Duration of each task
- Number of API calls
- Number of user interactions
- Token usage and estimated cost
- Success/failure status

You can also specify the model, client, and server names to use in the metrics:

```
npm run extract-metrics -- --model <model-name> --client <client-name> --server <server-name>
```

For example:
```
npm run extract-metrics -- --model claude-3.7-sonnet --client Cline --server Twilio
```

These arguments are optional and will override any values found in the logs or the default values. This is useful when the information isn't available in the logs or needs to be standardized across different runs.

Additional options:
- `--force` or `-f`: Force regeneration of all metrics, even if they already exist
- `--verbose` or `-v`: Enable verbose logging for debugging
- `--help` or `-h`: Show help message

The extracted metrics are saved to the `src/server/metrics/` directory and the `summary.json` file is updated.

### Interactive Dashboard

For a visual representation of results:

1. Start the dashboard server (if not already running):
   ```
   npm start
   ```
2. Open your browser and navigate to:
   ```
   http://localhost:3001
   ```
3. Use the "Refresh Data" button to update the dashboard with latest results

### Command Line Summary

Generate a text-based summary of results:
```
npm run generate-summary
```

## Results Interpretation

The benchmark focuses on these key insights:

1. **Time Efficiency:** Comparing the time it takes to complete tasks using MCP vs. traditional methods
2. **API Efficiency:** Measuring the reduction in API calls when using MCP
3. **Interaction Efficiency:** Evaluating if MCP reduces the number of interactions needed to complete tasks
4. **Success Rate:** Determining if MCP improves the reliability of task completion

Negative percentage changes in duration, API calls, and interactions indicate improvements, while positive changes in success rate indicate improvements.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Citation

If you use MCP-TE Benchmark in your research or development, please cite:

```
@software{MCP-TE_Benchmark,
  author = {Twilio Emerging Technology & Innovation Team},
  title = {MCP-TE Benchmark: Evaluating Model Context Protocol Task Efficiency},
  year = {2025},
  url = {https://github.com/nmogil-tw/mcp-te-benchmark}
}
```

## Contact

For questions about MCP-TE Benchmark, please open an issue on this repository or contact the Twilio Emerging Technology & Innovation Team.
