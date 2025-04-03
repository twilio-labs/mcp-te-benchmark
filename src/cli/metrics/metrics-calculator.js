const logger = require('../../utils/logger');

const DEFAULT_METRICS = {
  tokensIn: 0,
  tokensOut: 0,
  totalCost: 0,
  cacheWrites: 0,
  cacheReads: 0,
  conversationHistoryIndex: 0
};

/**
 * Calculator for processing and extracting metrics from task segments
 */
class MetricsCalculator {
  /**
   * Create a default metrics result object
   * @param {Object} segment The task segment (or null)
   * @param {string} directoryId The directory ID
   * @returns {Object} A default metrics object with zero values
   */
  static createDefaultResult(segment, directoryId) {
    return {
      taskId: segment?.taskNumber ?? 0,
      directoryId: directoryId ?? '',
      mode: 'unknown',
      model: 'unknown',
      mcpServer: 'Twilio',
      mcpClient: 'Cline',
      startTime: segment?.startTime ?? 0,
      endTime: segment?.endTime ?? 0,
      duration: 0,
      apiCalls: 0,
      interactions: 0,
      tokensIn: 0,
      tokensOut: 0,
      totalTokens: 0,
      cacheWrites: 0,
      cacheReads: 0,
      conversationHistoryIndex: 0,
      cost: 0,
      success: false,
      notes: 'Failed to calculate metrics'
    };
  }

  /**
   * Constructor for MetricsCalculator
   * @param {Object} segment The task segment
   * @param {string} testType The test type (control or mcp)
   * @param {string} directoryId The directory ID
   * @param {string} modelArg The model argument from command line
   * @param {string} clientArg The client argument from command line
   * @param {string} serverArg The server argument from command line
   */
  constructor(segment, testType, directoryId, modelArg, clientArg, serverArg) {
    this.segment = segment;
    this.testType = testType;
    this.directoryId = directoryId ?? '';
    this.modelArg = modelArg;
    this.clientArg = clientArg;
    this.serverArg = serverArg;
  }

  /**
   * Calculate metrics for the task segment
   * @returns {Promise<Object>} The calculated metrics
   */
  async calculate() {
    // Validate input
    if (!this.segment) {
      logger.error('Cannot calculate metrics: segment is missing');
      return MetricsCalculator.createDefaultResult(null, this.directoryId);
    }

    try {
      // Check for MCP usage in API calls
      const hasMcpUsage = this.checkForMcpUsage();
      const finalMode = hasMcpUsage ? 'mcp' : (this.segment.testType ?? this.testType);

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
        this.determineModel()
      ]);

      const { 
        tokensIn = 0, 
        tokensOut = 0, 
        totalCost = 0, 
        cacheWrites = 0, 
        cacheReads = 0, 
        conversationHistoryIndex = 0 
      } = tokenMetrics ?? {};

      // Validate and calculate duration
      let duration = this.segment.endTime - this.segment.startTime;
      
      // Check for unreasonable duration (more than 24 hours)
      const MAX_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      if (duration < 0 || duration > MAX_DURATION) {
        logger.warn(`Invalid duration detected for task ${this.segment.taskNumber}: ${duration}ms. Capping at 24 hours.`);
        duration = Math.max(0, Math.min(duration, MAX_DURATION));
      }

      return {
        taskId: this.segment.taskNumber,
        directoryId: this.directoryId,
        mode: finalMode ?? 'unknown',
        model: model ?? 'unknown',
        mcpServer: this.serverArg ?? 'Twilio',
        mcpClient: this.clientArg ?? 'Cline',
        startTime: this.segment.startTime,
        endTime: this.segment.startTime + duration,
        duration,
        apiCalls: apiCallCount,
        interactions: userMessageCount,
        tokensIn,
        tokensOut,
        totalTokens: tokensIn + tokensOut,
        cacheWrites,
        cacheReads,
        conversationHistoryIndex,
        cost: totalCost,
        success: true,
        notes: ''
      };
    } catch (error) {
      logger.error(`Error calculating metrics: ${error.message}`);
      return MetricsCalculator.createDefaultResult(this.segment, this.directoryId);
    }
  }

  /**
   * Check if the task segment contains MCP usage
   * @returns {boolean} True if MCP was used
   */
  checkForMcpUsage() {
    if (!this.segment?.apiCalls?.length) {
      return false;
    }

    return this.segment.apiCalls.some(apiCall => {
      if (apiCall.role === 'assistant' && apiCall.content && Array.isArray(apiCall.content)) {
        return apiCall.content.some(content => 
          content.type === 'text' && content.text && 
          (content.text.includes('use_mcp_tool') || 
           content.text.includes('use_mcp_server') || 
           content.text.includes('access_mcp_resource'))
        );
      }
      return false;
    });
  }

  /**
   * Calculate the number of API calls in the task segment
   * @returns {Promise<number>} The number of API calls
   */
  async calculateApiCalls() {
    if (!this.segment?.userMessages?.length) {
      return 0;
    }
    
    let apiCallCount = 0;
    
    // Count API calls from UI messages only - only counting api_req_started events
    this.segment.userMessages.forEach(msg => {
      // Count API request operations
      if (msg.type === 'say' && msg.say === 'api_req_started') {
        apiCallCount++;
        logger.debug(`Found API request in task ${this.segment.taskNumber}: ${msg.text ?? '[no text]'}`);
      }
    });

    logger.info(`API Call Count for Task ${this.segment.taskNumber}: ${apiCallCount}`);

    return apiCallCount;
  }

  /**
   * Calculate the number of user messages in the task segment
   * @returns {Promise<number>} The number of user messages
   */
  async calculateUserMessages() {
    // Default to 1 interaction if no data is available
    if (!this.segment?.apiCalls?.length) {
      logger.info(`No API calls found, defaulting to 1 interaction for task ${this.segment?.taskNumber ?? 'unknown'}`);
      return 1;
    }
    
    // For benchmarking MCP tasks, we want the true number of human interactions
    // In most cases, this should be just 1 (the initial task instruction)
    
    // Set to track unique conversation turns
    let userInteractionCount = 0;
    
    // Search for the initial task message
    let foundInitialTask = false;
    
    // Look in API conversation history (most reliable source)
    this.segment.apiCalls.forEach(entry => {
      // Only process user messages
      if (entry.role !== 'user' || !entry.content || !Array.isArray(entry.content)) {
        return;
      }

      // Extract the text from all content items
      const fullText = entry.content
        .filter(item => item.type === 'text')
        .map(item => item.text ?? '')
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
        return;  // Skip to next message
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
    });
    
    // If we still haven't found any interactions, default to 1
    if (userInteractionCount === 0) {
      userInteractionCount = 1;
      logger.info(`No user messages found in logs, defaulting to 1 interaction for task ${this.segment.taskNumber}`);
    }
    
    return userInteractionCount;
  }

  /**
   * Calculate token metrics for the task segment
   * @returns {Promise<Object>} Token metrics
   */
  async calculateTokenMetrics() {
    // Default values
    const metrics = { ...DEFAULT_METRICS };

    if (!this.segment?.userMessages?.length) {
      return metrics;
    }

    let tokensIn = 0;
    let tokensOut = 0;
    let totalCost = 0;
    let messagesWithTokens = 0;
    let cacheWrites = 0;
    let cacheReads = 0;
    let highestConvHistoryIndex = -1;

    logger.info(`Starting token calculation for task ${this.segment.taskNumber}`);

    // First pass: Collect reported token usage from Claude
    this.segment.userMessages.forEach(message => {
      if (message.type === 'say' && message.text) {
        try {
          const data = JSON.parse(message.text);
          if (data.tokensIn !== undefined) {
            tokensIn += parseInt(data.tokensIn, 10);
            tokensOut += parseInt(data.tokensOut ?? 0, 10);
            totalCost += parseFloat(data.cost ?? 0);
            
            // Track cache metrics if available
            if (data.cacheWrites !== undefined) {
              cacheWrites += parseInt(data.cacheWrites, 10);
            }
            if (data.cacheReads !== undefined) {
              cacheReads += parseInt(data.cacheReads, 10);
            }
            
            messagesWithTokens++;
            logger.info(`Message ${messagesWithTokens} tokens - In: ${data.tokensIn}, Out: ${data.tokensOut ?? 0}`);
          }
        } catch (e) {
          // If JSON parsing fails, try regex matching
          const tokensInMatch = message.text.match(/tokensIn["\s:]+(\d+)/i);
          const tokensOutMatch = message.text.match(/tokensOut["\s:]+(\d+)/i);
          const costMatch = message.text.match(/cost["\s:]+([0-9.]+)/i);
          const cacheWritesMatch = message.text.match(/cacheWrites["\s:]+(\d+)/i);
          const cacheReadsMatch = message.text.match(/cacheReads["\s:]+(\d+)/i);

          if (tokensInMatch || tokensOutMatch) {
            if (tokensInMatch?.[1]) tokensIn += parseInt(tokensInMatch[1], 10);
            if (tokensOutMatch?.[1]) tokensOut += parseInt(tokensOutMatch[1], 10);
            if (costMatch?.[1]) totalCost += parseFloat(costMatch[1]);
            if (cacheWritesMatch?.[1]) cacheWrites += parseInt(cacheWritesMatch[1], 10);
            if (cacheReadsMatch?.[1]) cacheReads += parseInt(cacheReadsMatch[1], 10);
            messagesWithTokens++;
            logger.info(`Message ${messagesWithTokens} tokens - In: ${tokensInMatch?.[1] ?? 0}, Out: ${tokensOutMatch?.[1] ?? 0}`);
          }
        }
      }
      
      // Track conversation history index
      if (message.conversationHistoryIndex !== undefined) {
        const indexValue = parseInt(message.conversationHistoryIndex, 10);
        if (!isNaN(indexValue) && indexValue > highestConvHistoryIndex) {
          highestConvHistoryIndex = indexValue;
        }
      }
    });

    // Second pass: Check API calls for any additional token usage
    if (this.segment.apiCalls?.length) {
      let apiCallsWithTokens = 0;
      this.segment.apiCalls.forEach(apiCall => {
        if (apiCall.usage) {
          if (apiCall.usage.input_tokens) tokensIn += apiCall.usage.input_tokens;
          if (apiCall.usage.output_tokens) tokensOut += apiCall.usage.output_tokens;
          if (apiCall.usage.cost) totalCost += apiCall.usage.cost;
          apiCallsWithTokens++;
          logger.info(`API Call ${apiCallsWithTokens} tokens - In: ${apiCall.usage.input_tokens ?? 0}, Out: ${apiCall.usage.output_tokens ?? 0}`);
        }
      });
    }

    // Calculate total cost if not already set
    if (totalCost === 0 && (tokensIn > 0 || tokensOut > 0)) {
      // Claude-3 pricing: $0.008/1K input tokens, $0.024/1K output tokens
      totalCost = (tokensIn * 0.008 / 1000) + (tokensOut * 0.024 / 1000);
    }

    logger.info(`Token metrics for task ${this.segment.taskNumber}:
      Messages with tokens: ${messagesWithTokens}
      Total input tokens: ${tokensIn}
      Total output tokens: ${tokensOut}
      Cache writes: ${cacheWrites}
      Cache reads: ${cacheReads}
      Highest conversation history index: ${highestConvHistoryIndex}
      Total cost: ${totalCost}`);

    return { 
      tokensIn, 
      tokensOut, 
      totalCost,
      cacheWrites,
      cacheReads,
      conversationHistoryIndex: highestConvHistoryIndex > -1 ? highestConvHistoryIndex : 0
    };
  }

  /**
   * Determine the model used for the task
   * @returns {Promise<string>} The model name
   */
  async determineModel() {
    // Prioritize the command-line argument if provided
    if (this.modelArg) {
      logger.info(`Using model from command-line argument: ${this.modelArg}`);
      return this.modelArg;
    }

    // Check if we have API calls to analyze
    if (!this.segment?.apiCalls?.length) {
      const defaultModel = 'claude-3.7-sonnet';
      logger.info(`No API calls found, defaulting to: ${defaultModel}`);
      return defaultModel;
    }

    // Try to determine from logs
    const modelFromLogs = this.segment.apiCalls.find(apiCall => {
      if (apiCall.role === 'assistant' && apiCall.content && Array.isArray(apiCall.content)) {
        return apiCall.content.some(content => {
          if (content.type === 'text' && content.text) {
            // Look for model in system prompt
            const systemPromptMatch = content.text.match(/You are a powerful agentic AI coding assistant, powered by (Claude [\d.]+ \w+)/i);
            return systemPromptMatch?.[1];
          }
          return false;
        });
      }
      return false;
    });

    if (modelFromLogs) {
      const detectedModel = modelFromLogs.toLowerCase()
        .replace('claude ', 'claude-')
        .replace(' ', '-');
      
      logger.info(`Detected model from logs: ${detectedModel}`);
      return detectedModel;
    }
    
    // Default if not found in logs and no argument provided
    const defaultModel = 'claude-3.7-sonnet';
    logger.info(`Model not found in logs or args, defaulting to: ${defaultModel}`);
    return defaultModel;
  }
}

module.exports = MetricsCalculator;
