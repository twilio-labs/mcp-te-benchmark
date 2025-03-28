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

echo "===================================="
echo "Starting $MODE test for Task $TASK_ID using model $MODEL"
echo "===================================="
echo ""
echo "Instructions:"
echo "1. Open Cursor and start a new chat"
echo "2. Load the docs/${MODE}_instructions.md file as context"
echo "3. Start the test by sending: 'Complete Task $TASK_ID using the commands in the instructions'"
echo ""
echo "Press Enter when the task has been completed to generate the summary file, or Ctrl+C to cancel..."
read

echo ""
echo "Generating summary..."
echo ""
npm run generate-summary

echo ""
echo "View dashboard with: open src/client/dashboard/index.html"
