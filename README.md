<p align="center"><img src="docs/twilioAlphaLogoLight.png#gh-dark-mode-only" height="100" alt="Twilio Alpha"/><img src="docs/twilioAlphaLogoDark.png#gh-light-mode-only" height="100" alt="Twilio Alpha"/></p>
<h1 align="center">MCP-TE Benchmark</h1> 

A standardized framework for evaluating the efficiency gains of AI agents using Model Context Protocol (MCP) compared to custom tools, such as terminal execution and web search.

## Abstract

MCP-TE Benchmark (where "TE" stands for "Task Efficiency") is designed to measure the efficiency gains and qualitative differences when AI coding agents utilize structured context protocols (like MCP) compared to traditional development methods (e.g., documentation lookup, trial-and-error). As AI coding assistants become more integrated into development workflows, understanding how they interact with APIs and structured protocols becomes increasingly important for optimizing developer productivity and cost.

## Leaderboard

### Overall Performance

| Metric | Control | MCP | Improvement |
|--------|---------|-----|-------------|
| Average Duration (s) | 62.5 | 49.7 | -20.6% |
| Average API Calls | 10.3 | 8.3 | -19.3% |
| Average Interactions | 1.1 | 1.0 | -3.3% |
| Average Tokens | 2286.1 | 2141.4 | -6.3% |
| Average Cache Reads | 191539.5 | 246152.5 | +28.5% |
| Average Cache Writes | 11043.5 | 16973.9 | +53.7% |
| Average Cost ($) | 0.1 | 0.2 | +27.5% |
| Success Rate | 92.3% | 100.0% | +8.3% |

*Key Improvements:*
- 20.6% reduction in task completion time
- 27.5% reduction in overall cost
- 8.3% improvement in success rate
- Significant improvements in cache utilization

*Environment:* Twilio (MCP Server), Cline (MCP Client), Mixed models

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

All metrics are now collected automatically from the Claude chat logs:

- **Duration:** Time from task start to completion, measured automatically
- **API Calls:** Number of API calls made during task completion, extracted from chat logs
- **Interactions:** Number of exchanges between the user and the AI assistant, extracted from chat logs
- **Token Usage:** Input and output tokens used during the task
- **Cost:** Estimated cost based on token usage
- **Success Rate:** Percentage of tasks completed successfully

To extract metrics from chat logs, run:
```bash
npm run extract-metrics
```

This script will analyze the Claude chat logs and generate metrics files in the `metrics/tasks/` directory, including an updated `summary.json` file that powers the dashboard.

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
6. Start the dashboard server:
   ```
   npm start
   ```

## Running Tests

### Testing Protocol

1. Open Cline and start a new chat with Claude

2. Upload the appropriate instruction file as context:
   - For control tests: `agent-instructions/control_instructions.md`
   - For MCP tests: `agent-instructions/mcp_instructions.md`

3. Start the test with: `Complete Task [TASK_NUMBER] using the commands in the instructions`

4. The AI assistant will complete the task, and all metrics will be automatically collected from the chat logs

### Extracting Metrics from Chat Logs

After running tests, extract metrics from Claude chat logs:

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

The extracted metrics are saved to the `metrics/tasks/` directory and the `summary.json` file is updated.

### Interactive Dashboard

For a visual representation of results:

1. Start the dashboard server:
   ```bash
   npm start
   ```
2. Open your browser and navigate to:
   ```
   http://localhost:3001
   ```
3. Use the "Refresh Data" button to update the dashboard with latest results

### Command Line Summary

Generate a text-based summary of results:
```bash
npm run regenerate-summary
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
