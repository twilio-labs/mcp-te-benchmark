# Twilio MCP Performance Testing Framework

A framework for evaluating performance gains when using Twilio's Model Context Protocol (MCP) with AI coding agents compared to traditional API approaches.

## Overview

This repository contains tools to measure and compare the efficiency of completing Twilio API tasks using:
- Traditional methods (web search & terminal) - Control group
- Twilio MCP-enabled implementation - Treatment group

## Key Metrics

- Task completion time
- Number of API calls
- Interaction count
- Success rate

## Setup

1. Clone this repository
2. Run the setup script:
   ```
   ./setup.sh
   ```
3. Create your `.env` file from the example:
   ```
   cp .env.example .env
   ```
4. Edit the `.env` file with your Twilio credentials
5. Start the metrics server:
   ```
   node metrics-server.js
   ```
6. Start the dashboard server (optional, for real-time visualization):
   ```
   node server.js
   ```

## Running Tests

1. Open a terminal and navigate to the project directory
2. Start a test using:
   ```
   ./run-test.sh [control|mcp] [1|2|3]
   ```
   Where:
   - First parameter is the test mode (control or mcp)
   - Second parameter is the task number (1, 2, or 3)
3. Follow the on-screen instructions
4. When the test is complete, view results using one of the methods below

## Viewing Results

### Interactive Dashboard

For a visual representation of results:

1. Start the dashboard server (if not already running):
   ```
   node server.js
   ```
2. Open your browser and navigate to:
   ```
   http://localhost:3001
   ```
3. Use the "Refresh Data" button to update the dashboard with latest results

### Static Dashboard

Alternatively, open the static HTML dashboard:
```
open dashboard.html
```

### Command Line Summary

Generate a text-based summary of results:
```
node generate-summary.js
```

## Tasks

1. **Purchase a Canadian Phone Number**
   - Find and purchase a phone number with a Canadian area code
   - Configure the number with a friendly name

2. **Create a Task Router Activity**
   - Create a new TaskRouter Activity named "Bathroom"
   - Set the activity as unavailable (not eligible to receive tasks)

3. **Create a Queue with Task Filter**
   - Create a new TaskQueue with an appropriate name
   - Configure a task filter that prevents routing to workers with the "Bathroom" activity

See the `docs` directory for detailed task instructions.

## Testing Protocol

Each task will be performed twice:
1. Using traditional methods (Control)
2. Using Twilio MCP (Treatment)

The metrics server automatically captures:
- Start and end times
- Duration
- API call count
- Interaction count
- Success status

## Results Analysis

The dashboard visualization provides:
- Bar charts comparing control vs. MCP performance
- Average completion times
- API call efficiency
- Success rates
- Detailed results table

## Directory Structure

```
└── twilio-mcp-performance/
    ├── README.md
    ├── metrics-server.js   # API for collecting metrics data (port 3000)
    ├── server.js           # Dashboard server (port 3001)
    ├── metrics-client.js
    ├── dashboard.html
    ├── generate-summary.js
    ├── results.md
    ├── run-test.sh
    ├── setup.sh
    ├── test-cli.js
    ├── .env.example
    ├── .env
    ├── metrics/
    └── docs/
        ├── control_instructions.md
        ├── mcp_instructions.md
        └── testing_protocol.md
```

## Requirements

- Node.js (v14 or higher)
- NPM
- Twilio account with API credentials
- TaskRouter workspace set up in your Twilio account

## Credits

Created by Twilio Emerging Technology & Innovation Team