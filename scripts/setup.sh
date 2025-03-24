#!/bin/bash
# setup.sh

# Create directory structure
mkdir -p data/metrics src/client/dashboard/{css,js}

# Install dependencies
npm install

# Make run-test.js executable
chmod +x src/cli/run-test.js

# Create .env from example if it doesn't exist
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env file. Please edit with your Twilio credentials."
fi

# Create empty results.md if it doesn't exist
if [ ! -f data/metrics/results.md ]; then
  mkdir -p data/metrics
  cat > data/metrics/results.md << EOL
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
  echo "Created empty results.md file in data/metrics directory."
fi

echo "Setup complete! Start the metrics server with: npm run start:metrics"