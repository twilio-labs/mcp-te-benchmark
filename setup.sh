#!/bin/bash
# setup.sh

# Create directory structure
mkdir -p metrics

# Install dependencies
npm init -y
npm install express axios commander inquirer dotenv

# Make test-cli.js executable
chmod +x test-cli.js

# Create .env from example if it doesn't exist
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env file. Please edit with your Twilio credentials."
fi

# Create empty results.md if it doesn't exist
if [ ! -f results.md ]; then
  cat > results.md << EOL
## Results Table

| Task | Mode      | Start Time | End Time | Duration | API Calls | Interactions | Success | Notes |
|------|-----------|------------|----------|----------|-----------|--------------|---------|-------|
| 1    | Control   |            |          |          |           |              |         |       |
| 1    | MCP       |            |          |          |           |              |         |       |
| 2    | Control   |            |          |          |           |              |         |       |
| 2    | MCP       |            |          |          |           |              |         |       |
| 3    | Control   |            |          |          |           |              |         |       |
| 3    | MCP       |            |          |          |           |              |         |       |
EOL
  echo "Created empty results.md file."
fi

echo "Setup complete! Start the metrics server with: node metrics-server.js"