// generate-summary.js
const fs = require('fs');
const path = require('path');

// Create metrics directory if it doesn't exist
const METRICS_DIR = path.join(__dirname, '..', 'server', 'metrics');
if (!fs.existsSync(METRICS_DIR)) {
  fs.mkdirSync(METRICS_DIR);
}

// Process all session files and generate summary
function generateSummary() {
  const files = fs.readdirSync(METRICS_DIR)
    .filter(file => file.endsWith('.json') && !file.startsWith('summary'));
  
  const sessions = [];
  
  files.forEach(file => {
    try {
      const sessionData = JSON.parse(fs.readFileSync(path.join(METRICS_DIR, file)));
      
      // Only include completed sessions
      if (sessionData.endTime) {
        sessions.push({
          taskId: sessionData.taskNumber || sessionData.taskId,
          mode: sessionData.mode,
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
  
  // Sort by task ID and mode
  sessions.sort((a, b) => {
    if (a.taskId === b.taskId) {
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
  
  // Calculate overall metrics
  if (sessions.length > 0) {
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
    
    console.log('\nPerformance Summary:');
    console.log('-------------------');
    console.log(`Average Duration: Control=${controlAvgDuration.toFixed(1)}s, MCP=${mcpAvgDuration.toFixed(1)}s (${percentageChange(mcpAvgDuration, controlAvgDuration)}% change)`);
    console.log(`Average API Calls: Control=${controlAvgApiCalls.toFixed(1)}, MCP=${mcpAvgApiCalls.toFixed(1)} (${percentageChange(mcpAvgApiCalls, controlAvgApiCalls)}% change)`);
    console.log(`Average Interactions: Control=${controlAvgInteractions.toFixed(1)}, MCP=${mcpAvgInteractions.toFixed(1)} (${percentageChange(mcpAvgInteractions, controlAvgInteractions)}% change)`);
    console.log(`Success Rate: Control=${controlSuccessRate.toFixed(1)}%, MCP=${mcpSuccessRate.toFixed(1)}% (${percentageChange(mcpSuccessRate, controlSuccessRate)}% change)`);
  }
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