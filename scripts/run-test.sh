#!/bin/bash
# run-test.sh

# Verify arguments
if [ $# -lt 2 ]; then
  echo "Usage: ./scripts/run-test.sh [control|mcp] [1|2|3]"
  echo "Example: ./scripts/run-test.sh control 1"
  exit 1
fi

MODE=$1
TASK_ID=$2

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
if ! curl -s http://localhost:3000/metrics/status/test > /dev/null; then
  echo "Error: Metrics server is not running. Start it with: npm run start:metrics"
  exit 1
fi

echo "===================================="
echo "Starting $MODE test for Task $TASK_ID"
echo "===================================="
echo ""
echo "Instructions:"
echo "1. Open Cursor and start a new chat"
echo "2. Load the docs/${MODE}_instructions.md file as context"
echo "3. Start the test by sending: 'Complete Task $TASK_ID using the commands in the instructions'"
echo ""
echo "Press Enter when you're ready to start, or Ctrl+C to cancel..."
read

START_TIME=$(date +%s)
echo "Test started at $(date)"
echo ""
echo "Press Enter when the test is complete..."
read
END_TIME=$(date +%s)

DURATION=$((END_TIME - START_TIME))
echo ""
echo "Test completed in $DURATION seconds"
echo ""
echo "Generating summary..."
npm run generate-summary

echo ""
echo "View dashboard with: open src/client/dashboard/index.html"