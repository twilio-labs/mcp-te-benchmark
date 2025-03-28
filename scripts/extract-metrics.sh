#!/bin/bash

# Script to extract metrics from Claude chat logs
# This script runs the extract-chat-metrics.js file to generate metrics

# Get the directory of the script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Run the extract-chat-metrics.js script
echo "Extracting metrics from Claude chat logs..."
node "$PROJECT_ROOT/src/cli/extract-chat-metrics.js"

# Check if the script ran successfully
if [ $? -eq 0 ]; then
    echo "Metrics extraction completed successfully."
    echo "Metrics are available in $PROJECT_ROOT/src/server/metrics/"
    echo "You can view the metrics dashboard by running: npm start"
else
    echo "Error: Metrics extraction failed."
    exit 1
fi
