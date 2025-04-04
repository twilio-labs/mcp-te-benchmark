const fs = require('fs').promises;
const path = require('path');
const logger = require('../../utils/logger');

/**
 * Result class for consistent error handling
 */
class SummaryResult {
  /**
   * Create a new SummaryResult
   * @param {boolean} success Whether the operation was successful
   * @param {string} message A message describing the result
   * @param {Array} data The metrics data
   * @param {Array} failedFiles Any files that failed to process
   */
  constructor(success, message, data = [], failedFiles = []) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.failedFiles = failedFiles;
  }

  /**
   * Create a success result
   * @param {string} message Success message
   * @param {Array} data Metrics data
   * @param {Array} failedFiles Any files that failed to process
   * @returns {SummaryResult} A success result
   */
  static success(message, data = [], failedFiles = []) {
    return new SummaryResult(true, message, data, failedFiles);
  }

  /**
   * Create an error result
   * @param {string} message Error message
   * @param {Array} data Any partial data that was collected
   * @param {Array} failedFiles Any files that failed to process
   * @returns {SummaryResult} An error result
   */
  static error(message, data = [], failedFiles = []) {
    return new SummaryResult(false, message, data, failedFiles);
  }
}

/**
 * Generator for summary metrics from task data
 */
class SummaryGenerator {
  /**
   * Create a new SummaryGenerator
   * @param {string} metricsDir Directory containing metrics files
   */
  constructor(metricsDir) {
    this.metricsDir = metricsDir;
  }

  /**
   * Generate a summary from task metrics
   * @param {Array} taskMetrics Array of task metrics
   * @returns {Promise<SummaryResult>} Result of the operation
   */
  async generateSummary(taskMetrics) {
    if (!taskMetrics?.length) {
      return SummaryResult.error('No task metrics provided');
    }

    try {
      // Deduplicate metrics by directoryId - keep the entry with the most activity
      const directoryMap = new Map();
      
      for (const metric of taskMetrics) {
        const existing = directoryMap.get(metric.directoryId);
        if (!existing || this.hasMoreActivity(metric, existing)) {
          directoryMap.set(metric.directoryId, metric);
        }
      }

      // Convert back to array
      const uniqueMetrics = Array.from(directoryMap.values());

      // Write the summary file
      const summaryPath = path.join(this.metricsDir, 'summary.json');
      await fs.writeFile(
        summaryPath,
        JSON.stringify(uniqueMetrics, null, 2)
      );

      this.printSummaryStatistics(uniqueMetrics);
      
      return SummaryResult.success(
        `Generated summary with ${uniqueMetrics.length} metrics`,
        uniqueMetrics
      );
    } catch (error) {
      logger.error('Error generating summary:', error);
      return SummaryResult.error(
        `Failed to generate summary: ${error.message}`,
        taskMetrics
      );
    }
  }

  /**
   * Compare metrics to determine which has more activity
   * @param {Object} newMetric New metric
   * @param {Object} existingMetric Existing metric
   * @returns {boolean} True if new metric has more activity
   */
  hasMoreActivity(newMetric, existingMetric) {
    if (!newMetric || !existingMetric) {
      return !!newMetric;
    }
    
    // Compare metrics to determine which one represents more actual activity
    const newScore = (newMetric.apiCalls ?? 0) + 
                    (newMetric.interactions ?? 0) + 
                    (newMetric.tokensIn ?? 0) + 
                    (newMetric.tokensOut ?? 0);
                    
    const existingScore = (existingMetric.apiCalls ?? 0) + 
                         (existingMetric.interactions ?? 0) + 
                         (existingMetric.tokensIn ?? 0) + 
                         (existingMetric.tokensOut ?? 0);
                         
    return newScore > existingScore;
  }

  /**
   * Sort metrics by task ID, mode, and model
   * @param {Array} metrics Array of metrics to sort
   */
  sortMetrics(metrics) {
    if (!metrics?.length) return;
    
    metrics.sort((a, b) => {
      if (a.taskId === b.taskId) {
        if (a.mode === b.mode) {
          return (a.model ?? '').localeCompare(b.model ?? '');
        }
        return (a.mode ?? '').localeCompare(b.mode ?? '');
      }
      return (a.taskId ?? 0) - (b.taskId ?? 0);
    });
  }

  /**
   * Write individual metric files for each task
   * @param {Array} taskMetrics Array of task metrics
   * @returns {Promise<SummaryResult>} Result of the operation
   */
  async writeIndividualMetricFiles(taskMetrics) {
    if (!taskMetrics?.length) {
      return SummaryResult.error('No task metrics provided');
    }

    const successfulWrites = [];
    const failedWrites = [];

    for (const metric of taskMetrics) {
      try {
        // Include directoryId in the filename for better identification
        // If directoryId is empty, use the startTime as a fallback
        const directoryId = metric.directoryId ?? metric.startTime?.toString() ?? Date.now().toString();
        const filename = `${metric.mode ?? 'unknown'}_task${metric.taskId ?? 0}_${directoryId}.json`;
        const tasksDir = path.join(this.metricsDir, 'tasks');
        
        // Ensure tasks directory exists
        try {
          await fs.mkdir(tasksDir, { recursive: true });
        } catch (mkdirError) {
          logger.warn(`Could not create tasks directory: ${mkdirError.message}`);
        }
        
        const filePath = path.join(tasksDir, filename);
        
        // Log the metric before writing to help debug
        logger.info(`Writing metric file for task ${metric.taskId} with ${metric.apiCalls ?? 0} API calls`);
        
        await fs.writeFile(
          filePath,
          JSON.stringify({
            mode: metric.mode,
            taskNumber: metric.taskId,
            directoryId: metric.directoryId ?? '', 
            model: metric.model,
            startTime: metric.startTime,
            completed: true,
            apiCalls: metric.apiCalls ?? 0,
            interactions: metric.interactions ?? 0,
            tokensIn: metric.tokensIn ?? 0,
            tokensOut: metric.tokensOut ?? 0,
            totalTokens: metric.totalTokens ?? 0,
            cacheWrites: metric.cacheWrites ?? 0,
            cacheReads: metric.cacheReads ?? 0,
            conversationHistoryIndex: metric.conversationHistoryIndex ?? 0,
            cost: metric.cost ?? 0,
            success: metric.success ?? false,
            endTime: metric.endTime,
            duration: metric.duration
          }, null, 2)
        );
        
        successfulWrites.push(filename);
      } catch (error) {
        logger.error(`Error writing metric file for task ${metric.taskId}: ${error.message}`);
        failedWrites.push(`task${metric.taskId ?? 0}`);
      }
    }

    if (failedWrites.length > 0) {
      return SummaryResult.error(
        `Failed to write ${failedWrites.length} metric files`,
        successfulWrites,
        failedWrites
      );
    }

    return SummaryResult.success(
      `Successfully wrote ${successfulWrites.length} metric files`,
      successfulWrites
    );
  }

  /**
   * Generate summary from individual metric files
   * @returns {Promise<SummaryResult>} Result of the operation
   */
  async generateSummaryFromFiles() {
    logger.info('Generating summary from individual metric files...');
    
    // Look for metric files in the 'tasks' subdirectory
    const tasksDir = path.join(this.metricsDir, 'tasks');
    let files;
    try {
      files = await fs.readdir(tasksDir);
    } catch (error) {
      logger.error(`Failed to read tasks directory: ${error.message}`);
      return SummaryResult.error(`Failed to read tasks directory: ${error.message}`);
    }
    
    const metricFiles = files.filter(file => 
      file.match(/^(control|mcp)_task\d+_.*\.json$/)
    );
    
    if (metricFiles.length === 0) {
      logger.warn('No metric files found');
      return SummaryResult.error('No metric files found', []);
    }
    
    logger.info(`Found ${metricFiles.length} individual metric files`);
    
    // Read and parse each file
    const allMetrics = [];
    const failedFiles = [];
    
    for (const file of metricFiles) {
      const filePath = path.join(this.metricsDir, 'tasks', file);
      try {
        const fileContent = await fs.readFile(filePath, 'utf8');
        const metric = JSON.parse(fileContent);
        
        // Convert to the format expected by the summary
        allMetrics.push({
          taskId: metric.taskNumber,
          directoryId: metric.directoryId ?? '',
          mode: metric.mode,
          model: metric.model,
          mcpServer: metric.mcpServer ?? 'Twilio',
          mcpClient: metric.mcpClient ?? 'Cline',
          startTime: metric.startTime,
          endTime: metric.endTime,
          duration: metric.duration,
          apiCalls: metric.apiCalls ?? 0,
          interactions: metric.interactions ?? 0,
          tokensIn: metric.tokensIn ?? 0,
          tokensOut: metric.tokensOut ?? 0,
          totalTokens: metric.totalTokens ?? 0,
          cacheWrites: metric.cacheWrites ?? 0,
          cacheReads: metric.cacheReads ?? 0,
          conversationHistoryIndex: metric.conversationHistoryIndex ?? 0,
          cost: metric.cost ?? 0,
          success: metric.success !== false,
          notes: metric.notes ?? ''
        });
      } catch (error) {
        logger.error(`Error parsing metric file ${file}: ${error.message}`);
        failedFiles.push(file);
      }
    }
    
    if (allMetrics.length === 0) {
      return SummaryResult.error(
        'Failed to parse any metric files',
        [],
        failedFiles
      );
    }
    
    // Sort metrics
    this.sortMetrics(allMetrics);
    
    try {
      // Write the summary file
      const summaryPath = path.join(this.metricsDir, 'summary.json');
      await fs.writeFile(
        summaryPath,
        JSON.stringify(allMetrics, null, 2)
      );
      
      this.printSummaryStatistics(allMetrics);
      
      return SummaryResult.success(
        `Generated summary with ${allMetrics.length} metrics`,
        allMetrics,
        failedFiles
      );
    } catch (error) {
      logger.error(`Failed to write summary file: ${error.message}`);
      return SummaryResult.error(
        `Failed to write summary file: ${error.message}`,
        allMetrics,
        failedFiles
      );
    }
  }

  /**
   * Merge new metrics with existing summary
   * @param {Array} newMetrics New metrics to merge
   * @returns {Promise<SummaryResult>} Result of the operation
   */
  async mergeWithExistingSummary(newMetrics) {
    if (!newMetrics?.length) {
      return SummaryResult.error('No new metrics provided');
    }

    let existingMetrics = [];
    const summaryPath = path.join(this.metricsDir, 'summary.json');
    
    try {
      const content = await fs.readFile(summaryPath, 'utf8');
      existingMetrics = JSON.parse(content);
    } catch (error) {
      logger.warn(`Could not read existing summary: ${error.message}. Creating new summary.`);
    }

    // Merge and deduplicate metrics
    const allMetrics = [...existingMetrics];
    const updatedMetrics = [];
    const addedMetrics = [];
    
    // Add new metrics, replacing existing ones with same key
    for (const newMetric of newMetrics) {
      // Validate duration before merging
      const MAX_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      let duration = newMetric.duration;
      
      if (duration < 0 || duration > MAX_DURATION) {
        logger.warn(`Invalid duration detected in metric for task ${newMetric.taskId}: ${duration}ms. Adjusting...`);
        duration = Math.max(0, Math.min(duration, MAX_DURATION));
        newMetric.duration = duration;
        newMetric.endTime = newMetric.startTime + duration;
      }

      // Create a normalized metric with default values
      const normalizedMetric = {
        ...newMetric,
        apiCalls: newMetric.apiCalls ?? 0,
        interactions: newMetric.interactions ?? 0,
        cacheWrites: newMetric.cacheWrites ?? 0,
        cacheReads: newMetric.cacheReads ?? 0,
        conversationHistoryIndex: newMetric.conversationHistoryIndex ?? 0
      };

      // Find existing metric with same key
      const existingIndex = allMetrics.findIndex(metric => 
        metric.mode === newMetric.mode && 
        metric.taskId === newMetric.taskId && 
        metric.startTime === newMetric.startTime
      );

      if (existingIndex >= 0) {
        // Replace existing metric
        allMetrics[existingIndex] = normalizedMetric;
        updatedMetrics.push(normalizedMetric);
      } else {
        // Add new metric
        allMetrics.push(normalizedMetric);
        addedMetrics.push(normalizedMetric);
      }
    }

    // Sort metrics
    this.sortMetrics(allMetrics);

    try {
      // Write the merged summary
      await fs.writeFile(
        summaryPath,
        JSON.stringify(allMetrics, null, 2)
      );
      
      return SummaryResult.success(
        `Merged summary: updated ${updatedMetrics.length}, added ${addedMetrics.length} metrics`,
        allMetrics
      );
    } catch (error) {
      logger.error(`Error writing merged summary: ${error.message}`);
      return SummaryResult.error(
        `Failed to write merged summary: ${error.message}`,
        allMetrics
      );
    }
  }

  /**
   * Check if a metric file exists
   * @param {string} mode Mode (control or mcp)
   * @param {number} taskId Task ID
   * @param {string} directoryId Directory ID
   * @returns {Promise<boolean>} True if file exists
   */
  async metricFileExists(mode, taskId, directoryId) {
    if (!mode || !taskId) {
      return false;
    }
    
    try {
      const tasksDir = path.join(this.metricsDir, 'tasks');
      const files = await fs.readdir(tasksDir);
      
      if (directoryId) {
        const specificPattern = new RegExp(`^${mode}_task${taskId}_${directoryId}\\.json$`);
        return files.some(file => specificPattern.test(file));
      }
      
      // Otherwise, check for any file matching the task and mode
      const pattern = new RegExp(`^${mode}_task${taskId}_.*\\.json$`);
      return files.some(file => pattern.test(file));
    } catch (error) {
      logger.error(`Error checking for existing metric file: ${error.message}`);
      return false;
    }
  }

  /**
   * Print summary statistics
   * @param {Array} taskMetrics Array of task metrics
   */
  printSummaryStatistics(taskMetrics) {
    if (!taskMetrics?.length) {
      logger.info('No metrics to display');
      return;
    }
    
    const controlTasks = taskMetrics.filter(t => t.mode === 'control');
    const mcpTasks = taskMetrics.filter(t => t.mode === 'mcp');

    logger.info('\nExtracted Metrics Summary:');
    logger.info('-------------------------');
    logger.info(`Total tasks processed: ${taskMetrics.length}`);
    logger.info(`Control tasks: ${controlTasks.length}`);
    logger.info(`MCP tasks: ${mcpTasks.length}`);

    logger.info('\nTask Details:');
    taskMetrics.forEach(task => {
      logger.info(`Task ${task.taskId ?? 'unknown'} (${task.mode ?? 'unknown'}): duration=${((task.duration ?? 0)/1000).toFixed(1)}s, interactions=${task.interactions ?? 0}, apiCalls=${task.apiCalls ?? 0}, tokens=${task.tokensIn ?? 0}`);
    });

    if (controlTasks.length > 0 && mcpTasks.length > 0) {
      this.printPerformanceComparison(controlTasks, mcpTasks);
    }

    logger.info(`Summary file generated at: ${path.join(this.metricsDir, 'summary.json')}`);
  }

  printPerformanceComparison(controlTasks, mcpTasks) {
    const controlAvg = this.calculateAverages(controlTasks);
    const mcpAvg = this.calculateAverages(mcpTasks);

    console.log('\nPerformance Comparison:');
    console.log(`Duration (s): Control=${controlAvg.duration.toFixed(1)}, MCP=${mcpAvg.duration.toFixed(1)} (${this.percentageChange(mcpAvg.duration, controlAvg.duration)}% change)`);
    console.log(`API Calls: Control=${controlAvg.apiCalls.toFixed(1)}, MCP=${mcpAvg.apiCalls.toFixed(1)} (${this.percentageChange(mcpAvg.apiCalls, controlAvg.apiCalls)}% change)`);
    console.log(`Interactions: Control=${controlAvg.interactions.toFixed(1)}, MCP=${mcpAvg.interactions.toFixed(1)} (${this.percentageChange(mcpAvg.interactions, controlAvg.interactions)}% change)`);
    console.log(`Tokens: Control=${controlAvg.tokens.toFixed(0)}, MCP=${mcpAvg.tokens.toFixed(0)} (${this.percentageChange(mcpAvg.tokens, controlAvg.tokens)}% change)`);
    console.log(`Cache Writes: Control=${controlAvg.cacheWrites.toFixed(0)}, MCP=${mcpAvg.cacheWrites.toFixed(0)} (${this.percentageChange(mcpAvg.cacheWrites, controlAvg.cacheWrites)}% change)`);
    console.log(`Cache Reads: Control=${controlAvg.cacheReads.toFixed(0)}, MCP=${mcpAvg.cacheReads.toFixed(0)} (${this.percentageChange(mcpAvg.cacheReads, controlAvg.cacheReads)}% change)`);
    console.log(`Conversation History: Control=${controlAvg.convHistoryIndex.toFixed(1)}, MCP=${mcpAvg.convHistoryIndex.toFixed(1)} (${this.percentageChange(mcpAvg.convHistoryIndex, controlAvg.convHistoryIndex)}% change)`);
    console.log(`Cost ($): Control=${controlAvg.cost.toFixed(4)}, MCP=${mcpAvg.cost.toFixed(4)} (${this.percentageChange(mcpAvg.cost, controlAvg.cost)}% change)`);
  }

  calculateAverages(tasks) {
    const count = tasks.length;
    if (count === 0) return { 
      duration: 0, 
      apiCalls: 0, 
      interactions: 0, 
      tokens: 0, 
      cacheWrites: 0, 
      cacheReads: 0, 
      convHistoryIndex: 0, 
      cost: 0 
    };

    return {
      duration: tasks.reduce((sum, t) => sum + t.duration, 0) / count,
      apiCalls: tasks.reduce((sum, t) => sum + t.apiCalls, 0) / count,
      interactions: tasks.reduce((sum, t) => sum + t.interactions, 0) / count,
      tokens: tasks.reduce((sum, t) => sum + (t.totalTokens || 0), 0) / count,
      cacheWrites: tasks.reduce((sum, t) => sum + (t.cacheWrites || 0), 0) / count,
      cacheReads: tasks.reduce((sum, t) => sum + (t.cacheReads || 0), 0) / count,
      convHistoryIndex: tasks.reduce((sum, t) => sum + (t.conversationHistoryIndex || 0), 0) / count,
      cost: tasks.reduce((sum, t) => sum + (t.cost || 0), 0) / count
    };
  }

  percentageChange(newValue, oldValue) {
    if (oldValue === 0) return 'N/A';
    return ((newValue - oldValue) / oldValue * 100).toFixed(1);
  }
}

module.exports = SummaryGenerator;
