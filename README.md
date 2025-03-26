<p align="center"><img src="docs/twilioAlphaLogo.png" height="100" alt="Twilio Alpha"/></p>
<h1 align="center">MCP-TE Benchmark</h1> 

A standardized framework for evaluating the efficiency gains of AI agents using Model Context Protocol (MCP) compared to custom tools, such as terminal execution and web search.

## Abstract

MCP-TE Benchmark (where "TE" stands for "Task Efficiency") is designed to measure the efficiency gains and qualitative differences when AI coding agents utilize structured context protocols (like MCP) compared to traditional development methods (e.g., documentation lookup, trial-and-error). As AI coding assistants become more integrated into development workflows, understanding how they interact with APIs and structured protocols becomes increasingly important for optimizing developer productivity and cost.

## Leaderboard

**Note:** Due to a limitation in the current MCP Client (Cursor), model selection is restricted in some test runs. 'Auto' indicates the client's automatic model selection. Results for specific models will be added as they become available.

### Overall Performance

| Metric | Control | MCP | Improvement |
|--------|---------|-----|-------------|
| Average Duration (s) | 43.2 | 42.4 | -1.9% |
| Average API Calls | 6.4 | 2.5 | -60.9% |
| Average Interactions | 1.2 | 1.0 | -16.7% |
| Success Rate | 100.0% | 100.0% | 0.0% |

*Environment:* Twilio (MCP Server), Cursor (MCP Client), Mixed models

### Task-Specific Performance

#### Task 1: Purchase a Canadian Phone Number

| Model | Mode | Duration (s) | API Calls | Interactions | Success |
|-------|------|--------------|-----------|--------------|---------|
| auto | Control | 20.7 | 3.5 | 1.0 | 100% |
| auto | MCP | 38.4 | 2.3 | 1.0 | 100% |
| claude-3.7-sonnet | Control | 64.3 | 9.0 | 1.0 | 100% |
| claude-3.7-sonnet | MCP | 42.2 | 3.0 | 1.0 | 100% |

#### Task 2: Create a Task Router Activity

| Model | Mode | Duration (s) | API Calls | Interactions | Success |
|-------|------|--------------|-----------|--------------|---------|
| auto | Control | 65.6 | 14.0 | 2.0 | 100% |
| auto | MCP | 43.5 | 3.0 | 1.0 | 100% |
| claude-3.7-sonnet | Control | 35.3 | 4.0 | 1.0 | 100% |
| claude-3.7-sonnet | MCP | N/A | N/A | N/A | N/A |

#### Task 3: Create a Queue with Task Filter

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

### Metric Collection Limitations

Some metrics are collected with different methods due to client limitations:

- **Duration and Success/Failure:** Logged automatically by the metrics server
- **API Calls and Interactions:** Currently manually counted post-run by observing the agent's behavior in Cursor, as Cursor does not provide detailed execution logs that would allow for automatic extraction of these metrics

## Tasks

The current benchmark includes the following Twilio API tasks:

1. **Purchase a Canadian Phone Number:** Search for and purchase an available Canadian phone number (preferably with area code 416)
2. **Create a Task Router Activity:** Create a new Task Router activity named "Bathroom"
3. **Create a Queue with Task Filter:** Create a queue with a task filter that prevents routing tasks to workers in the "Bathroom" activity

While the initial task suite focuses on Twilio MCP, the MCP-TE framework is designed to be adaptable to other APIs and context protocols.

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

1. Open a terminal and navigate to the project directory
2. Start a test using:
   ```
   ./scripts/run-test.sh [control|mcp] [1|2|3] [model]
   ```
   Where:
   - First parameter is the test mode (control or mcp)
   - Second parameter is the task number (1, 2, or 3)
   - Third parameter is the model name (e.g., "claude-3.7-sonnet")
3. Follow the on-screen instructions
4. When the test is complete, view results using one of the methods below

### Batch Testing

To run all tests in sequence:
```
./scripts/run-test.sh run-all --model [model-name]
```

## Viewing Results

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

## Contributing

Contributions to MCP-TE Benchmark are welcome! Here are some ways to contribute:

1. Adding new API tasks
2. Improving metrics collection
3. Enhancing the dashboard visualization
4. Testing with different AI models

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

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