const logger = require('../../utils/logger');

class MetricsCalculator {
  // Add modelArg, clientArg, and serverArg to the constructor
  constructor(segment, testType, directoryId, modelArg, clientArg, serverArg) {
    this.segment = segment;
    this.testType = testType;
    this.directoryId = directoryId || '';
    this.modelArg = modelArg; // Store the model argument
    this.clientArg = clientArg; // Store the client argument
    this.serverArg = serverArg; // Store the server argument
  }

  async calculate() {
    try {
      // Check for MCP usage in API calls
      const hasMcpUsage = this.checkForMcpUsage();
      const finalMode = hasMcpUsage ? 'mcp' : (this.segment.testType || this.testType);

      // Calculate metrics in parallel
      const [
        apiCallCount,
        userMessageCount,
        tokenMetrics,
        model
      ] = await Promise.all([
        this.calculateApiCalls(),
        this.calculateUserMessages(),
        this.calculateTokenMetrics(),
        this.determineModel() // Pass modelArg here
      ]);

      const { tokensIn, tokensOut, totalCost } = tokenMetrics;

      // Validate and calculate duration
      let duration = this.segment.endTime - this.segment.startTime;
      
      // Check for unreasonable duration (more than 24 hours)
      const MAX_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      if (duration < 0 || duration > MAX_DURATION) {
        logger.warn(`Invalid duration detected for task ${this.segment.taskNumber}: ${duration}ms. Capping at 24 hours.`);
        duration = Math.min(Math.max(0, duration), MAX_DURATION);
      }

      return {
        taskId: this.segment.taskNumber,
        directoryId: this.directoryId, // Use the directoryId passed in the constructor
        mode: finalMode,
        model: model, // Use the determined model
        mcpServer: this.serverArg || 'Twilio', // Prioritize serverArg, fallback to 'Twilio'
        mcpClient: this.clientArg || 'Cline', // Prioritize clientArg, fallback to 'Cline'
        startTime: this.segment.startTime,
        endTime: this.segment.startTime + duration, // Ensure endTime is consistent with duration
        duration: duration,
        apiCalls: apiCallCount,
        interactions: userMessageCount,
        tokensIn: tokensIn,
        tokensOut: tokensOut,
        totalTokens: tokensIn + tokensOut,
        cost: totalCost,
        success: true,
        notes: ''
      };
    } catch (error) {
      logger.error(`Error calculating metrics: ${error.message}`);
      return null;
    }
  }

  checkForMcpUsage() {
    for (const apiCall of this.segment.apiCalls) {
      if (apiCall.role === 'assistant' && apiCall.content && Array.isArray(apiCall.content)) {
        for (const content of apiCall.content) {
          if (content.type === 'text' && content.text && 
              (content.text.includes('use_mcp_tool') || 
               content.text.includes('use_mcp_server') || 
               content.text.includes('access_mcp_resource'))) {
            return true;
          }
        }
      }
    }
    return false;
  }

  async calculateApiCalls() {
    let apiCallCount = 0;
    
    // Count API calls from UI messages only - only counting api_req_started events
    for (const msg of this.segment.userMessages) {
      // Count API request operations
      if (msg.type === 'say' && msg.say === 'api_req_started') {
        apiCallCount++;
        logger.debug(`Found API request in task ${this.segment.taskNumber}: ${msg.text}`);
      }
      
      // No longer counting MCP tool requests as per requirements
    }

    logger.info(`API Call Count for Task ${this.segment.taskNumber}: ${apiCallCount}`);

    return apiCallCount || 0;
  }

  async calculateUserMessages() {
    // For benchmarking MCP tasks, we want the true number of human interactions
    // In most cases, this should be just 1 (the initial task instruction)
    
    // Set to track unique conversation turns
    let userInteractionCount = 0;
    
    // Search for the initial task message
    let foundInitialTask = false;
    
    // Look in API conversation history (most reliable source)
    if (this.segment.apiCalls && Array.isArray(this.segment.apiCalls)) {
      for (const entry of this.segment.apiCalls) {
        // Only process user messages
        if (entry.role === 'user' && entry.content && Array.isArray(entry.content)) {
          // Extract the text from all content items
          const fullText = entry.content
            .filter(item => item.type === 'text')
            .map(item => item.text || '')
            .join(' ');
          
          // Check if this is the initial task request
          if (!foundInitialTask && (
              fullText.includes('Complete Task') || 
              fullText.includes('agent-instructions/mcp_instructions.md') ||
              fullText.includes('agent-instructions/control_instructions.md')
            )) {
            foundInitialTask = true;
            userInteractionCount = 1;  // Set to exactly 1 for the initial task
            logger.info(`Found initial task instruction for task ${this.segment.taskNumber}`);
            continue;  // Skip to next message
          }
          
          // Only count additional user messages if they appear to be actual human follow-ups
          // and not system messages
          if (foundInitialTask && 
              !fullText.includes('<environment_details>') && 
              !fullText.startsWith('[') &&
              fullText.trim().length > 10) {  // Minimum length to exclude noise
            // This appears to be a genuine follow-up question
            userInteractionCount++;
            logger.info(`Found follow-up user message for task ${this.segment.taskNumber}: "${fullText.substring(0, 50)}..."`);
          }
        }
      }
    }
    
    // If we still haven't found any interactions, default to 1
    if (userInteractionCount === 0) {
      userInteractionCount = 1;
      logger.info(`No user messages found in logs, defaulting to 1 interaction for task ${this.segment.taskNumber}`);
    }
    
    return userInteractionCount;
  }

  async calculateTokenMetrics() {
    let tokensIn = 0;
    let tokensOut = 0;
    let totalCost = 0;
    let messagesWithTokens = 0;

    logger.info(`Starting token calculation for task ${this.segment.taskNumber}`);

    // First pass: Collect reported token usage from Claude
    for (const message of this.segment.userMessages) {
      if (message.type === 'say' && message.text) {
        try {
          const data = JSON.parse(message.text);
          if (data.tokensIn !== undefined) {
            tokensIn += parseInt(data.tokensIn, 10);
            tokensOut += parseInt(data.tokensOut || 0, 10);
            totalCost += parseFloat(data.cost || 0);
            messagesWithTokens++;
            logger.info(`Message ${messagesWithTokens} tokens - In: ${data.tokensIn}, Out: ${data.tokensOut || 0}`);
          }
        } catch (e) {
          // If JSON parsing fails, try regex matching
          const tokensInMatch = message.text.match(/tokensIn["\s:]+(\d+)/i);
          const tokensOutMatch = message.text.match(/tokensOut["\s:]+(\d+)/i);
          const costMatch = message.text.match(/cost["\s:]+([0-9.]+)/i);

          if (tokensInMatch || tokensOutMatch) {
            if (tokensInMatch && tokensInMatch[1]) tokensIn += parseInt(tokensInMatch[1], 10);
            if (tokensOutMatch && tokensOutMatch[1]) tokensOut += parseInt(tokensOutMatch[1], 10);
            if (costMatch && costMatch[1]) totalCost += parseFloat(costMatch[1]);
            messagesWithTokens++;
            logger.info(`Message ${messagesWithTokens} tokens - In: ${tokensInMatch ? tokensInMatch[1] : 0}, Out: ${tokensOutMatch ? tokensOutMatch[1] : 0}`);
          }
        }
      }
    }

    // Second pass: Check API calls for any additional token usage
    let apiCallsWithTokens = 0;
    for (const apiCall of this.segment.apiCalls) {
      if (apiCall.usage) {
        if (apiCall.usage.input_tokens) tokensIn += apiCall.usage.input_tokens;
        if (apiCall.usage.output_tokens) tokensOut += apiCall.usage.output_tokens;
        if (apiCall.usage.cost) totalCost += apiCall.usage.cost;
        apiCallsWithTokens++;
        logger.info(`API Call ${apiCallsWithTokens} tokens - In: ${apiCall.usage.input_tokens || 0}, Out: ${apiCall.usage.output_tokens || 0}`);
      }
    }

    // Calculate total cost if not already set
    if (totalCost === 0) {
      // Claude-3 pricing: $0.008/1K input tokens, $0.024/1K output tokens
      totalCost = (tokensIn * 0.008 / 1000) + (tokensOut * 0.024 / 1000);
    }

    logger.info(`Token metrics for task ${this.segment.taskNumber}:
      Messages with tokens: ${messagesWithTokens}
      API calls with tokens: ${apiCallsWithTokens}
      Total input tokens: ${tokensIn}
      Total output tokens: ${tokensOut}
      Total cost: ${totalCost}`);

    return { tokensIn, tokensOut, totalCost };
  }

  async determineModel() {
    // Prioritize the command-line argument if provided
    if (this.modelArg) {
      logger.info(`Using model from command-line argument: ${this.modelArg}`);
      return this.modelArg;
    }

    // Otherwise, try to determine from logs
    for (const apiCall of this.segment.apiCalls) {
      if (apiCall.role === 'assistant' && apiCall.content && Array.isArray(apiCall.content)) {
        for (const content of apiCall.content) {
          if (content.type === 'text' && content.text) {
            // Look for model in system prompt
            const systemPromptMatch = content.text.match(/You are a powerful agentic AI coding assistant, powered by (Claude [\d.]+ \w+)/i);
            if (systemPromptMatch && systemPromptMatch[1]) {
              // Attempt to normalize model name slightly if needed, or just return matched group
              const detectedModel = systemPromptMatch[1].toLowerCase().replace('claude ', 'claude-').replace(' ', '-');
              logger.info(`Detected model from logs: ${detectedModel}`);
              // Simple normalization example:
              if (detectedModel === 'claude-3.5-sonnet') return 'claude-3.5-sonnet'; // Keep known format
              // Add more normalization rules if needed
              return detectedModel; // Return the detected model string
            }
          }
        }
      }
    }
    
    // Default if not found in logs and no argument provided
    const defaultModel = 'claude-3.7-sonnet'; // Keep the original default
    logger.info(`Model not found in logs or args, defaulting to: ${defaultModel}`);
    return defaultModel;
  }
}

module.exports = MetricsCalculator;
