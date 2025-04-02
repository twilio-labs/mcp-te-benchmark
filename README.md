<p align="center"><img src="docs/twilioAlphaLogoLight.png#gh-dark-mode-only" height="100" alt="Twilio Alpha"/><img src="docs/twilioAlphaLogoDark.png#gh-light-mode-only" height="100" alt="Twilio Alpha"/></p>
<h1 align="center">MCP-TE Benchmark</h1> 

A standardized framework for evaluating the efficiency gains and trade-offs of AI agents using Model Context Protocol (MCP) compared to traditional methods.

## Abstract

MCP-TE Benchmark (where "TE" stands for "Task Efficiency") is designed to measure the efficiency gains, resource utilization changes, and qualitative differences when AI coding agents utilize structured context protocols (like MCP) compared to traditional development methods (e.g., file search, terminal execution, web search). As AI coding assistants become more integrated into development workflows, understanding how they interact with APIs and structured protocols is crucial for optimizing developer productivity and evaluating overall cost-effectiveness.

## Leaderboard

### Overall Performance (Model: claude-3.7-sonnet)

*Environment: Twilio (MCP Server), Cline (MCP Client), Model: claude-3.7-sonnet*

| Metric                 | Control    | MCP        | Change  |
| :--------------------- | :--------- | :--------- | :-----  |
| Average Duration (s)   | 62.54      | 49.68      | -20.56% |
| Average API Calls      | 10.27      | 8.29       | -19.26% |
| Average Interactions   | 1.08       | 1.04       | -3.27%  |
| Average Tokens         | 2286.12    | 2141.38    | -6.33%  |
| Average Cache Reads    | 191539.50  | 246152.46  | +28.51% |
| Average Cache Writes   | 11043.46   | 16973.88   | +53.70% |
| Average Cost ($)       | 0.13       | 0.17       | +27.55% |
| Success Rate           | 92.31%     | 100.0%     | +8.33%  |

*Note: Calculations based on data in `metrics/summary.json`.*

*Key Findings (claude-3.7-sonnet):*
*   **Efficiency Gains:** MCP usage resulted in faster task completion (-20.5% duration), fewer API calls (-19.3%), and slightly fewer user interactions (-3.3%). Token usage also saw a modest decrease (-6.3%).
*   **Increased Resource Utilization:** MCP significantly increased cache reads (+28.5%) and cache writes (+53.7%).
*   **Cost Increase:** The increased resource utilization, particularly cache operations or potentially different API call patterns within MCP, led to a notable increase in average task cost (+27.5%).
*   **Improved Reliability:** MCP achieved a perfect success rate (100%), an 8.3% improvement over the control group.

*Conclusion:* For the `claude-3.7-sonnet` model in this benchmark, MCP offers improvements in speed, API efficiency, and reliability, but at the cost of increased cache operations and overall monetary cost per task.

### Task-Specific Performance (Model: claude-3.7-sonnet)

*Calculations based on data in `summary.json`.*

#### Task 1: Purchase a Canadian Phone Number

| Metric                  | Control    | MCP        | Change   |
| :--------------------- | :--------- | :--------- | :------- |
| Duration (s)           | 79.41      | 62.27      | -21.57%  |
| API Calls              | 12.78      | 9.63       | -24.67%  |
| Interactions           | 1.22       | 1.13       | -7.95%   |
| Tokens                 | 2359.33    | 2659.88    | +12.74%  |
| Cache Reads            | 262556.11  | 281086.13  | +7.06%   |
| Cache Writes           | 17196.33   | 25627.63   | +49.03%  |
| Cost ($)               | 0.18       | 0.22       | +23.50%  |
| Success Rate           | 100.00%    | 100.00%    | 0.00%    |

#### Task 2: Create a Task Router Activity

| Metric                  | Control    | MCP        | Change   |
| :--------------------- | :--------- | :--------- | :------- |
| Duration (s)           | 46.37      | 30.71      | -33.77%  |
| API Calls              | 8.44       | 5.88       | -30.43%  |
| Interactions           | 1.00       | 1.00       | 0.00%    |
| Tokens                 | 2058.89    | 1306.63    | -36.54%  |
| Cache Reads            | 144718.44  | 164311.50  | +13.54%  |
| Cache Writes           | 6864.44    | 11219.13   | +63.44%  |
| Cost ($)               | 0.10       | 0.11       | +11.09%  |
| Success Rate           | 77.78%     | 100.00%    | +28.57%  |

#### Task 3: Create a Queue with Task Filter

| Metric                  | Control    | MCP        | Change   |
| :--------------------- | :--------- | :--------- | :------- |
| Duration (s)           | 61.77      | 56.07      | -9.23%   |
| API Calls              | 9.50       | 9.38       | -1.32%   |
| Interactions           | 1.00       | 1.00       | 0.00%    |
| Tokens                 | 2459.38    | 2457.63    | -0.07%   |
| Cache Reads            | 164319.50  | 293059.75  | +78.35%  |
| Cache Writes           | 8822.88    | 14074.88   | +59.53%  |
| Cost ($)               | 0.12       | 0.18       | +49.06%  |
| Success Rate           | 100.00%    | 100.00%    | 0.00%    |

## Benchmark Design & Metrics

The MCP-TE Benchmark evaluates AI coding agents' performance using a Control vs. Treatment methodology:

*   **Control Group:** Completion of API tasks using traditional methods (web search, file search, and terminal capabilities).
*   **Treatment Group (MCP):** Completion of the same API tasks using a Twilio Model Context Protocol server (MCP).

### Key Metrics Collected

| Metric         | Description                                                                 |
| :------------- | :-------------------------------------------------------------------------- |
| Duration       | Time taken to complete a task from start to finish (in seconds)             |
| API Calls      | Number of API calls made during task completion                             |
| Interactions   | Number of exchanges between the user and the AI assistant                   |
| Tokens         | Total input and output tokens used during the task                          |
| Cache Reads    | Number of cached tokens read (measure of cache hit effectiveness)           |
| Cache Writes   | Number of tokens written to the cache (measure of context loading/saving)   |
| Cost           | Estimated cost ($) based on token usage and cache operations (model specific) |
| Success Rate   | Percentage of tasks completed successfully                                  |

### Metrics Collection

All metrics are collected automatically from Claude chat logs using the scripts provided in this repository:

*   Run `npm run extract-metrics` to process chat logs.
*   This script analyzes logs, calculates metrics for each task run, and saves them as individual JSON files in `metrics/tasks/`.
*   It also generates/updates a `summary.json` file in the same directory, consolidating all individual results.

## Tasks

The current benchmark includes the following tasks specific to the Twilio MCP Server:

1.  **Purchase a Canadian Phone Number:** Search for and purchase an available Canadian phone number (preferably with area code 416).
2.  **Create a Task Router Activity:** Create a new Task Router activity named "Bathroom".
3.  **Create a Queue with Task Filter:** Create a queue with a task filter that prevents routing tasks to workers in the "Bathroom" activity.

(Setup, Running Tests, Extracting Metrics, Dashboard, CLI Summary sections remain largely the same as they accurately describe the repo structure and tools)

## Setup

1.  Clone this repository:
    ```bash
    git clone https://github.com/nmogil-tw/mcp-te-benchmark.git
    cd mcp-te-benchmark
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Create your `.env` file from the example:
    ```bash
    cp .env.example .env
    ```
4.  Edit the `.env` file with your necessary credentials (e.g., Twilio).
5.  *(Optional)* If needed, run any project-specific setup scripts (check `scripts/` directory if applicable).

## Running Tests

### Testing Protocol

1.  Open Cline (or the specified MCP Client) and start a new chat with the target model (e.g., Claude).
2.  Upload the appropriate instruction file as context:
    *   For control tests: `agent-instructions/control_instructions.md`
    *   For MCP tests: `agent-instructions/mcp_instructions.md`
3.  Start the test with the prompt: `Complete Task [TASK_NUMBER] using the commands in the instructions`
4.  Allow the AI assistant to complete the task. Metrics will be collected from the chat logs later.
5.  Repeat for all desired tasks and modes.

### Extracting Metrics from Chat Logs

After running tests, extract metrics from the chat logs:

```bash
# Extracts metrics and updates summary.json
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
4. **Cost Efficiency** Evalutating if the added MCP context has an impact on Token Costs
5. **Success Rate:** Determining if MCP improves the reliability of task completion

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
