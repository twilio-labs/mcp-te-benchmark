// metrics-client.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Load configuration
require('dotenv').config();

const METRICS_URL = 'http://localhost:3000/metrics';
let currentSessionId = null;

// Start a new test session
async function startSession(taskId, mode) {
  try {
    const response = await axios.post(`${METRICS_URL}/start`, {
      taskId,
      mode
    });
    
    currentSessionId = response.data.sessionId;
    console.log(`Started metrics collection for ${mode} task ${taskId}`);
    console.log(`Session ID: ${currentSessionId}`);
    
    return currentSessionId;
  } catch (error) {
    console.error('Error starting session:', error.message);
    return null;
  }
}

// Log an API call
async function logApiCall(endpoint, method, success, details = {}) {
  if (!currentSessionId) {
    console.error('No active session. Start a session first.');
    return false;
  }
  
  try {
    await axios.post(`${METRICS_URL}/api-call`, {
      sessionId: currentSessionId,
      endpoint,
      method,
      success,
      details
    });
    
    console.log(`Logged API call to ${endpoint}`);
    return true;
  } catch (error) {
    console.error('Error logging API call:', error.message);
    return false;
  }
}

// Log an AI interaction
async function logInteraction(type, details = {}) {
  if (!currentSessionId) {
    console.error('No active session. Start a session first.');
    return false;
  }
  
  try {
    await axios.post(`${METRICS_URL}/interaction`, {
      sessionId: currentSessionId,
      type,
      details
    });
    
    console.log(`Logged interaction of type ${type}`);
    return true;
  } catch (error) {
    console.error('Error logging interaction:', error.message);
    return false;
  }
}

// Complete a test session
async function completeSession(success, notes = '') {
  if (!currentSessionId) {
    console.error('No active session. Start a session first.');
    return false;
  }
  
  try {
    const response = await axios.post(`${METRICS_URL}/complete`, {
      sessionId: currentSessionId,
      success,
      notes
    });
    
    console.log(`Completed metrics collection for session ${currentSessionId}`);
    console.log(`Duration: ${response.data.duration} seconds`);
    console.log(`API Calls: ${response.data.apiCalls}`);
    console.log(`Interactions: ${response.data.interactions}`);
    
    currentSessionId = null;
    return true;
  } catch (error) {
    console.error('Error completing session:', error.message);
    return false;
  }
}

// Export functions
module.exports = {
  startSession,
  logApiCall,
  logInteraction,
  completeSession
};