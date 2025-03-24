#!/usr/bin/env node
// test-cli.js
const { program } = require('commander');
const inquirer = require('inquirer');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Set up CLI
program
  .name('twilio-mcp-test')
  .description('CLI for running Twilio MCP performance tests')
  .version('1.0.0');

// Command to run a single test
program
  .command('run')
  .description('Run a single test')
  .option('-m, --mode <mode>', 'Test mode (control or mcp)', 'control')
  .option('-t, --task <task>', 'Task number (1, 2, or 3)', '1')
  .option('-y, --yes', 'Skip confirmation', false)
  .action(async (options) => {
    // Validate inputs
    if (!['control', 'mcp'].includes(options.mode)) {
      console.error('Error: Mode must be "control" or "mcp"');
      process.exit(1);
    }
    
    if (!['1', '2', '3'].includes(options.task)) {
      console.error('Error: Task must be 1, 2, or 3');
      process.exit(1);
    }
    
    // Check if metrics server is running
    try {
      exec('curl -s http://localhost:3000/metrics/status', (error) => {
        if (error) {
          console.error('Error: Metrics server is not running. Start it with: node metrics-server.js');
          process.exit(1);
        }
      });
    } catch (error) {
      console.error('Error: Metrics server is not running. Start it with: node metrics-server.js');
      process.exit(1);
    }
    
    // Confirm test if not using --yes
    if (!options.yes) {
      const answers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Run ${options.mode} test for Task ${options.task}?`,
          default: true
        }
      ]);
      
      if (!answers.confirm) {
        console.log('Test canceled');
        process.exit(0);
      }
    }
    
    // Run the test
    console.log(`Running ${options.mode} test for Task ${options.task}...`);
    exec(`./run-test.sh ${options.mode} ${options.task}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
        return;
      }
      console.log(stdout);
    });
  });

// Command to run all tests
program
  .command('run-all')
  .description('Run all tests')
  .option('-y, --yes', 'Skip confirmation', false)
  .action(async (options) => {
    // Confirm test if not using --yes
    if (!options.yes) {
      const answers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Run all tests (6 total: 3 tasks x 2 modes)?',
          default: true
        }
      ]);
      
      if (!answers.confirm) {
        console.log('Tests canceled');
        process.exit(0);
      }
    }
    
    // Run all tests
    const modes = ['control', 'mcp'];
    const tasks = ['1', '2', '3'];
    
    console.log('Running all tests...');
    
    for (const mode of modes) {
      for (const task of tasks) {
        console.log(`\nRunning ${mode} test for Task ${task}...`);
        
        try {
          await new Promise((resolve, reject) => {
            exec(`./run-test.sh ${mode} ${task}`, (error, stdout, stderr) => {
              if (error) {
                reject(error);
                return;
              }
              console.log(stdout);
              resolve();
            });
          });
        } catch (error) {
          console.error(`Error running ${mode} test for Task ${task}: ${error.message}`);
        }
      }
    }
    
    // Generate summary
    console.log('\nGenerating summary...');
    exec('node generate-summary.js', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        return;
      }
      console.log(stdout);
      console.log('\nAll tests completed! View results with: open dashboard.html');
    });
  });

// Command to view results
program
  .command('results')
  .description('View test results')
  .action(() => {
    exec('open dashboard.html', (error) => {
      if (error) {
        console.error(`Error opening dashboard: ${error.message}`);
        return;
      }
      console.log('Opening dashboard...');
    });
  });

// Command to generate summary
program
  .command('summary')
  .description('Generate test summary')
  .action(() => {
    exec('node generate-summary.js', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        return;
      }
      console.log(stdout);
    });
  });

// Run the program
program.parse(process.argv);