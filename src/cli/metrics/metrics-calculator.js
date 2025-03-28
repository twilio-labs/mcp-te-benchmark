const logger = require('../../utils/logger');

class MetricsCalculator {
  constructor(segment, testType) {
    this.segment = segment;
    this.testType = testType;
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
        this.determineModel()
      ]);

      const { tokensIn, tokensOut, totalCost } = tokenMetrics;

      return {
        taskId: this.segment.taskNumber,
        directoryId: this.segment.directoryId,
        mode: finalMode,
        model: model,
        mcpServer: 'Twilio', // Default value
        mcpClient: 'Cline', // Changed from 'Cursor' to 'Cline'
        startTime: this.segment.startTime,
        endTime: this.segment.endTime,
        duration: this.segment.endTime - this.segment.startTime,
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
    let apiHistoryCount = 0;
    let apiReqCount = 0;
    let mcpReqCount = 0;
    let fileOpCount = 0;

    // Count API calls from API history
    for (const call of this.segment.apiCalls) {
      // Count API calls that represent actual tool usage or LLM calls
      if (call.role === 'assistant' && call.content) {
        const hasToolCall = call.content.some(content => 
          content.type === 'text' && content.text && (
            content.text.includes('<function_calls>') ||
            content.text.includes('<function_results>') ||
            content.text.includes('use_mcp_tool') ||
            content.text.includes('use_mcp_server')
          )
        );
        if (hasToolCall) {
          apiHistoryCount++;
          apiCallCount++;
          logger.debug(`Found API history call in task ${this.segment.taskNumber}: ${JSON.stringify(call.content)}`);
        }
      }
    }

    // Count additional API calls from UI messages
    for (const msg of this.segment.userMessages) {
      // Count API request operations
      if (msg.type === 'say' && msg.say === 'api_req_started') {
        apiReqCount++;
        apiCallCount++;
        logger.debug(`Found API request in task ${this.segment.taskNumber}: ${msg.text}`);
      }
      
      // Count MCP tool requests
      if (msg.type === 'say' && msg.say === 'mcp_server_request_started') {
        mcpReqCount++;
        apiCallCount++;
        logger.debug(`Found MCP request in task ${this.segment.taskNumber}: ${msg.text}`);
      }

      // Count file read operations and other tool calls
      if (msg.type === 'say' && msg.say === 'text' && msg.text) {
        const hasToolCall = 
          msg.text.includes('read_file') || 
          msg.text.includes('codebase_search') || 
          msg.text.includes('grep_search') ||
          msg.text.includes('file_search') ||
          msg.text.includes('<function_calls>') ||
          msg.text.includes('<function_results>') ||
          msg.text.includes('use_mcp_tool') ||
          msg.text.includes('use_mcp_server');

        if (hasToolCall) {
          fileOpCount++;
          apiCallCount++;
          logger.debug(`Found tool call in task ${this.segment.taskNumber}: ${msg.text}`);
        }
      }
    }

    logger.info(`API Call Breakdown for Task ${this.segment.taskNumber}:
      - API History Calls: ${apiHistoryCount}
      - API Request Operations: ${apiReqCount}
      - MCP Tool Requests: ${mcpReqCount}
      - File Operations: ${fileOpCount}
      Total API Calls: ${apiCallCount}`);

    // Ensure we return a number
    return apiCallCount || 0;
  }

  async calculateUserMessages() {
    let userMessageCount = 0;
    let uiMessageCount = 0;
    let apiMessageCount = 0;
    
    // Keep track of unique messages to prevent double counting
    const uniqueMessages = new Set();

    // Process UI messages
    for (const msg of this.segment.userMessages) {
      // Skip non-text messages
      if (msg.type !== 'say' || msg.say !== 'text' || !msg.text) {
        logger.debug(`Skipping non-text message: ${JSON.stringify(msg)}`);
        continue;
      }

      // Skip system/assistant messages
      if (msg.from === 'assistant' || msg.from === 'system') {
        logger.debug(`Skipping assistant/system message: ${JSON.stringify(msg)}`);
        continue;
      }

      // Skip messages that look like assistant responses
      if (msg.text && (
        // First person pronouns and phrases
        msg.text.includes('I will') ||
        msg.text.includes('Let me') ||
        msg.text.includes('I\'ll') ||
        msg.text.includes('I am') ||
        msg.text.includes('I can') ||
        msg.text.includes('I\'ve') ||
        msg.text.includes('I have') ||
        msg.text.includes('I see') ||
        msg.text.includes('I need') ||
        msg.text.includes('I found') ||
        msg.text.includes('I\'m') ||
        msg.text.includes('I think') ||
        // Common assistant starters
        msg.text.startsWith('Based on') ||
        msg.text.startsWith('Here\'s') ||
        msg.text.startsWith('Looking at') ||
        msg.text.startsWith('After analyzing') ||
        msg.text.startsWith('According to') ||
        msg.text.startsWith('The code') ||
        msg.text.startsWith('This is') ||
        msg.text.startsWith('Now') ||
        msg.text.startsWith('First') ||
        msg.text.startsWith('Next') ||
        // Question patterns
        msg.text.includes('?') ||
        msg.text.includes('should I') ||
        // File references that look like assistant analysis
        msg.text.includes('.env.example') ||
        msg.text.includes('credentials')
      )) {
        logger.debug(`Skipping message that looks like assistant response: ${msg.text}`);
        continue;
      }

      // Skip tool calls and system operations
      if (msg.text && (
        msg.text.includes('<function_calls>') ||
        msg.text.includes('<fnr>') ||
        msg.text.includes('read_file') ||
        msg.text.includes('codebase_search') ||
        msg.text.includes('grep_search') ||
        msg.text.includes('file_search') ||
        msg.text.includes('use_mcp_tool') ||
        msg.text.includes('use_mcp_server')
      )) {
        logger.debug(`Skipping tool call or system operation: ${msg.text}`);
        continue;
      }

      // Only count messages that match the task instruction format
      const taskInstructionMatch = msg.text.match(/@\/agent-instructions\/(mcp|control)_instructions\.md Complete Task \d+ using the commands in the instructions/);
      
      // Only count as user message if explicitly from user and matches task instruction format
      if ((!msg.from || msg.from === 'user') && taskInstructionMatch) {
        // Use a hash of the message text to prevent duplicates
        const msgHash = Buffer.from(msg.text).toString('base64');
        if (!uniqueMessages.has(msgHash)) {
          uniqueMessages.add(msgHash);
          uiMessageCount++;
          userMessageCount++;
          logger.info(`Counted UI user message: ${msg.text}`);
        } else {
          logger.debug(`Skipping duplicate message: ${msg.text}`);
        }
      } else {
        logger.debug(`Skipping non-task-instruction message: ${msg.text}`);
      }
    }

    // Process API history for user messages
    for (const call of this.segment.apiCalls) {
      if (call.role !== 'user' || !call.content) {
        logger.debug(`Skipping non-user API call: ${JSON.stringify(call)}`);
        continue;
      }

      // Only count if it contains actual user query
      const userQueries = call.content.filter(content => 
        content.type === 'text' && 
        content.text && 
        content.text.includes('<user_query>')
      );

      for (const query of userQueries) {
        // Extract the actual query text
        const queryMatch = query.text.match(/<user_query>(.*?)<\/user_query>/s);
        if (queryMatch && queryMatch[1]) {
          const queryText = queryMatch[1].trim();
          
          // Only count if it matches the task instruction format
          const taskInstructionMatch = queryText.match(/@\/agent-instructions\/(mcp|control)_instructions\.md Complete Task \d+ using the commands in the instructions/);
          
          if (taskInstructionMatch) {
            // Use a hash of the query text to prevent duplicates
            const queryHash = Buffer.from(queryText).toString('base64');
            
            if (!uniqueMessages.has(queryHash)) {
              uniqueMessages.add(queryHash);
              apiMessageCount++;
              userMessageCount++;
              logger.info(`Counted API user query: ${queryText}`);
            } else {
              logger.debug(`Skipping duplicate API query: ${queryText}`);
            }
          } else {
            logger.debug(`Skipping non-task-instruction query: ${queryText}`);
          }
        }
      }
    }

    logger.info(`User Message Breakdown for Task ${this.segment.taskNumber}:
      - UI Messages: ${uiMessageCount}
      - API Messages: ${apiMessageCount}
      - Unique Messages: ${uniqueMessages.size}
      Total User Messages: ${userMessageCount}
      
      Message Hashes: ${Array.from(uniqueMessages).join(', ')}
    `);

    return userMessageCount;
  }

  async calculateTokenMetrics() {
    let tokensIn = 0;
    let tokensOut = 0;
    let totalCost = 0;

    // Process API calls for token usage
    for (const apiCall of this.segment.apiCalls) {
      if (apiCall.usage) {
        tokensIn += apiCall.usage.input_tokens || 0;
        tokensOut += apiCall.usage.output_tokens || 0;
        if (apiCall.usage.cost) {
          totalCost += apiCall.usage.cost;
        }
      }
    }

    // Process UI messages for token usage
    for (const message of this.segment.userMessages) {
      // Check for completion_result messages which contain token usage
      if (message.say === 'completion_result' && message.text) {
        tokensIn += 32; // Standard system prompt tokens
        tokensOut += Math.ceil(message.text.length / 3); // Approximate output tokens
      }
      // Check for API request messages
      else if (message.say === 'api_req_started' && message.text) {
        try {
          // Try to parse the message text as JSON
          const data = JSON.parse(message.text);
          if (data.tokensIn) {
            tokensIn += parseInt(data.tokensIn, 10);
          }
          if (data.tokensOut) {
            tokensOut += parseInt(data.tokensOut, 10);
          }
          if (data.cost) {
            totalCost += parseFloat(data.cost);
          }
        } catch (e) {
          // If JSON parsing fails, try regex matching
          const tokensInMatch = message.text.match(/tokensIn["\s:]+(\d+)/i);
          const tokensOutMatch = message.text.match(/tokensOut["\s:]+(\d+)/i);
          const costMatch = message.text.match(/cost["\s:]+([0-9.]+)/i);

          if (tokensInMatch && tokensInMatch[1]) {
            tokensIn += parseInt(tokensInMatch[1], 10);
          }
          if (tokensOutMatch && tokensOutMatch[1]) {
            tokensOut += parseInt(tokensOutMatch[1], 10);
          }
          if (costMatch && costMatch[1]) {
            totalCost += parseFloat(costMatch[1]);
          }
        }
      }
    }

    // Calculate cost if not already set
    if (totalCost === 0) {
      // Claude 3 Opus pricing: $15 per million input tokens, $75 per million output tokens
      totalCost = ((tokensIn / 1000000) * 15) + ((tokensOut / 1000000) * 75);
    }

    return { tokensIn, tokensOut, totalCost };
  }

  async determineModel() {
    for (const apiCall of this.segment.apiCalls) {
      if (apiCall.role === 'assistant' && apiCall.content && Array.isArray(apiCall.content)) {
        for (const content of apiCall.content) {
          if (content.type === 'text' && content.text) {
            // Look for model in system prompt
            const systemPromptMatch = content.text.match(/You are a powerful agentic AI coding assistant, powered by Claude 3\.5 Sonnet/i);
            if (systemPromptMatch) {
              return 'claude-3.7-sonnet';  // Return the correct model name
            }
          }
        }
      }
    }
    
    // Default to the correct model if not found in logs
    return 'claude-3.7-sonnet';
  }
}

module.exports = MetricsCalculator;
