#!/bin/bash

# Script to regenerate the summary.json file from existing individual metric files
# This is useful if you've manually edited the individual JSON files and want to update the summary

# Get the directory of the script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Run the regenerate-summary.js script
echo "Regenerating summary.json from existing metric files..."
node "$PROJECT_ROOT/src/cli/regenerate-summary.js"

# Check if the script ran successfully
if [ $? -eq 0 ]; then
    echo "Summary regeneration completed successfully."
    echo "Summary file was generated at $PROJECT_ROOT/metrics/tasks/summary.json"
    echo "You can view the metrics dashboard by running: npm start"
else
    echo "Error: Summary regeneration failed."
    exit 1
fi
