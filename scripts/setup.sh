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

echo "Setup complete! Start the metrics server with: npm run start:metrics"