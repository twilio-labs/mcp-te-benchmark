// generate-summary.js
const fs = require('fs');
const path = require('path');
const config = require('../utils/config');
const readline = require('readline');

// Use the same metrics directory as the server
const METRICS_DIR = config.metrics.dataPath;
console.log('Reading metrics from:', METRICS_DIR);

if (!fs.existsSync(METRICS_DIR)) {
  fs.mkdirSync(METRICS_DIR, { recursive: true });
}

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisify readline question
function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// Process all session files and generate summary
async function generateSummary() {
  const files = fs.readdirSync(METRICS_DIR)
    .filter(file => file.endsWith('.json') && !file.startsWith('summary'));
  
  const sessions = [];
  
  // Ask for MCP server and client information
  const defaultServer = 'Twilio';
  const defaultClient = 'Cursor';
  
  const mcpServer = await askQuestion(`MCP Server name (default: ${defaultServer}): `) || defaultServer;
  const mcpClient = await askQuestion(`MCP Client name (default: ${defaultClient}): `) || defaultClient;
  
  rl.close();
  
  files.forEach(file => {
    try {
      const sessionData = JSON.parse(fs.readFileSync(path.join(METRICS_DIR, file)));
      
      // Only include completed sessions
      if (sessionData.endTime) {
        sessions.push({
          taskId: sessionData.taskNumber || sessionData.taskId,
          mode: sessionData.mode,
          model: sessionData.model || 'unknown', // Include model information
          mcpServer: mcpServer,
          mcpClient: mcpClient,
          startTime: sessionData.startTime,
          endTime: sessionData.endTime,
          duration: sessionData.duration,
          apiCalls: Array.isArray(sessionData.apiCalls) ? sessionData.apiCalls.length : sessionData.apiCalls,
          interactions: Array.isArray(sessionData.interactions) ? sessionData.interactions.length : sessionData.interactions,
          success: sessionData.success,
          notes: sessionData.notes || ''
        });
      }
    } catch (error) {
      console.error(`Error processing file ${file}:`, error);
    }
  });
  
  // Sort by task ID, mode, and model
  sessions.sort((a, b) => {
    if (a.taskId === b.taskId) {
      if (a.mode === b.mode) {
        return a.model.localeCompare(b.model);
      }
      return a.mode.localeCompare(b.mode);
    }
    return a.taskId - b.taskId;
  });
  
  // Write summary file
  fs.writeFileSync(
    path.join(METRICS_DIR, 'summary.json'),
    JSON.stringify(sessions, null, 2)
  );
  
  console.log(`Generated summary for ${sessions.length} completed sessions`);
  console.log(`MCP Server: ${mcpServer}`);
  console.log(`MCP Client: ${mcpClient}`);
  
  // Calculate overall metrics
  if (sessions.length > 0) {
    // Group sessions by model
    const modelGroups = groupBy(sessions, 'model');
    
    // Display performance by model
    console.log('\nPerformance by Model:');
    console.log('-------------------');
    
    for (const [model, modelSessions] of Object.entries(modelGroups)) {
      const modelControlSessions = modelSessions.filter(s => s.mode === 'control');
      const modelMcpSessions = modelSessions.filter(s => s.mode === 'mcp');
      
      if (modelSessions.length > 0) {
        console.log(`\nModel: ${model}`);
        
        if (modelControlSessions.length > 0 && modelMcpSessions.length > 0) {
          const modelControlAvgDuration = average(modelControlSessions.map(s => s.duration));
          const modelMcpAvgDuration = average(modelMcpSessions.map(s => s.duration));
          
          console.log(`  Average Duration: Control=${modelControlAvgDuration.toFixed(1)}s, MCP=${modelMcpAvgDuration.toFixed(1)}s (${percentageChange(modelMcpAvgDuration, modelControlAvgDuration)}% change)`);
        } else {
          console.log(`  Average Duration: ${average(modelSessions.map(s => s.duration)).toFixed(1)}s`);
        }
      }
    }
    
    // Original summary (all models combined)
    const controlSessions = sessions.filter(s => s.mode === 'control');
    const mcpSessions = sessions.filter(s => s.mode === 'mcp');
    
    const controlAvgDuration = average(controlSessions.map(s => s.duration));
    const mcpAvgDuration = average(mcpSessions.map(s => s.duration));
    
    const controlAvgApiCalls = average(controlSessions.map(s => s.apiCalls));
    const mcpAvgApiCalls = average(mcpSessions.map(s => s.apiCalls));
    
    const controlAvgInteractions = average(controlSessions.map(s => s.interactions));
    const mcpAvgInteractions = average(mcpSessions.map(s => s.interactions));
    
    const controlSuccessRate = percentage(controlSessions.filter(s => s.success).length, controlSessions.length);
    const mcpSuccessRate = percentage(mcpSessions.filter(s => s.success).length, mcpSessions.length);
    
    console.log('\nOverall Performance Summary (All Models):');
    console.log('-------------------');
    console.log(`Average Duration: Control=${controlAvgDuration.toFixed(1)}s, MCP=${mcpAvgDuration.toFixed(1)}s (${percentageChange(mcpAvgDuration, controlAvgDuration)}% change)`);
    console.log(`Average API Calls: Control=${controlAvgApiCalls.toFixed(1)}, MCP=${mcpAvgApiCalls.toFixed(1)} (${percentageChange(mcpAvgApiCalls, controlAvgApiCalls)}% change)`);
    console.log(`Average Interactions: Control=${controlAvgInteractions.toFixed(1)}, MCP=${mcpAvgInteractions.toFixed(1)} (${percentageChange(mcpAvgInteractions, controlAvgInteractions)}% change)`);
    console.log(`Success Rate: Control=${controlSuccessRate.toFixed(1)}%, MCP=${mcpSuccessRate.toFixed(1)}% (${percentageChange(mcpSuccessRate, controlSuccessRate)}% change)`);
  }
}

// Helper function to group sessions by a property
function groupBy(array, key) {
  return array.reduce((result, item) => {
    (result[item[key]] = result[item[key]] || []).push(item);
    return result;
  }, {});
}

function average(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function percentage(part, total) {
  if (total === 0) return 0;
  return (part / total) * 100;
}

function percentageChange(newValue, oldValue) {
  if (oldValue === 0) return "N/A";
  return (((newValue - oldValue) / oldValue) * 100).toFixed(1);
}

// Run the summary generation
generateSummary();