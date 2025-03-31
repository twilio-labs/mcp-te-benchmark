// Types and interfaces for metrics processing
const CONTROL_MARKER = 'control_instructions.md';
const MCP_MARKER = 'mcp_instructions.md';
const TASK_START_MARKER = 'Complete Task';

/**
 * @typedef {Object} TaskSegment
 * @property {number} taskNumber
 * @property {number} startIndex
 * @property {number} startTime
 * @property {Array} apiCalls
 * @property {Array} userMessages
 * @property {number|null} endIndex
 * @property {number|null} endTime
 * @property {string} testType
 */

/**
 * @typedef {Object} TaskMetrics
 * @property {number} taskId
 * @property {string} mode
 * @property {string} model
 * @property {string} mcpServer
 * @property {string} mcpClient
 * @property {number} startTime
 * @property {number} endTime
 * @property {number} duration
 * @property {number} apiCalls
 * @property {number} interactions
 * @property {number} tokensIn
 * @property {number} tokensOut
 * @property {number} totalTokens
 * @property {number} cost
 * @property {boolean} success
 * @property {string} notes
 */

module.exports = {
  CONTROL_MARKER,
  MCP_MARKER,
  TASK_START_MARKER
};
