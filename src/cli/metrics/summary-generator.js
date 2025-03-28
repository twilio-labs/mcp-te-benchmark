const fs = require('fs').promises;
const path = require('path');
const logger = require('../../utils/logger');

class SummaryGenerator {
  constructor(metricsDir) {
    this.metricsDir = metricsDir;
  }

  async generateSummary(taskMetrics) {
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
      await fs.writeFile(
        path.join(this.metricsDir, 'summary.json'),
        JSON.stringify(uniqueMetrics, null, 2)
      );

      this.printSummaryStatistics(uniqueMetrics);
    } catch (error) {
      logger.error('Error generating summary:', error);
    }
  }

  hasMoreActivity(newMetric, existingMetric) {
    // Compare metrics to determine which one represents more actual activity
    const newScore = (newMetric.apiCalls || 0) + 
                    (newMetric.interactions || 0) + 
                    (newMetric.tokensIn || 0) + 
                    (newMetric.tokensOut || 0);
                    
    const existingScore = (existingMetric.apiCalls || 0) + 
                         (existingMetric.interactions || 0) + 
                         (existingMetric.tokensIn || 0) + 
                         (existingMetric.tokensOut || 0);
                         
    return newScore > existingScore;
  }

  sortMetrics(metrics) {
    metrics.sort((a, b) => {
      if (a.taskId === b.taskId) {
        if (a.mode === b.mode) {
          return a.model.localeCompare(b.model);
        }
        return a.mode.localeCompare(b.mode);
      }
      return a.taskId - b.taskId;
    });
  }

  async writeIndividualMetricFiles(taskMetrics) {
    for (const metric of taskMetrics) {
      const filename = `${metric.mode}_task${metric.taskId}_${metric.startTime}.json`;
      const filePath = path.join(this.metricsDir, filename);
      
      // Log the metric before writing to help debug
      logger.info(`Writing metric file for task ${metric.taskId} with ${metric.apiCalls} API calls`);
      
      await fs.writeFile(
        filePath,
        JSON.stringify({
          mode: metric.mode,
          taskNumber: metric.taskId,
          model: metric.model,
          startTime: metric.startTime,
          completed: true,
          apiCalls: metric.apiCalls || 0, // Ensure apiCalls is always defined
          interactions: metric.interactions || 0, // Ensure interactions is always defined
          tokensIn: metric.tokensIn,
          tokensOut: metric.tokensOut,
          totalTokens: metric.totalTokens,
          cost: metric.cost,
          success: metric.success,
          endTime: metric.endTime,
          duration: metric.duration
        }, null, 2)
      );
    }
  }

  async mergeWithExistingSummary(newMetrics) {
    try {
      const summaryPath = path.join(this.metricsDir, 'summary.json');
      const existingMetrics = await fs.readFile(summaryPath, 'utf8')
        .then(data => JSON.parse(data))
        .catch(() => []);

      // Merge and deduplicate metrics
      const allMetrics = [...existingMetrics];
      
      // Add new metrics, replacing existing ones with same key
      for (const newMetric of newMetrics) {
        const key = `${newMetric.mode}_${newMetric.taskId}_${newMetric.startTime}`;
        const existingIndex = allMetrics.findIndex(metric => 
          metric.mode === newMetric.mode && 
          metric.taskId === newMetric.taskId && 
          metric.startTime === newMetric.startTime
        );

        if (existingIndex >= 0) {
          // Replace existing metric
          allMetrics[existingIndex] = {
            ...newMetric,
            apiCalls: newMetric.apiCalls || 0,
            interactions: newMetric.interactions || 0
          };
        } else {
          // Add new metric
          allMetrics.push({
            ...newMetric,
            apiCalls: newMetric.apiCalls || 0,
            interactions: newMetric.interactions || 0
          });
        }
      }

      // Sort metrics
      this.sortMetrics(allMetrics);

      return allMetrics;
    } catch (error) {
      logger.error(`Error merging with existing summary: ${error.message}`);
      return newMetrics.map(metric => ({
        ...metric,
        apiCalls: metric.apiCalls || 0,
        interactions: metric.interactions || 0
      }));
    }
  }

  async metricFileExists(mode, taskId) {
    try {
      const files = await fs.readdir(this.metricsDir);
      const pattern = new RegExp(`^${mode}_task${taskId}_\\d+\\.json$`);
      return files.some(file => pattern.test(file));
    } catch (error) {
      logger.error(`Error checking for existing metric file: ${error.message}`);
      return false;
    }
  }

  printSummaryStatistics(taskMetrics) {
    const controlTasks = taskMetrics.filter(t => t.mode === 'control');
    const mcpTasks = taskMetrics.filter(t => t.mode === 'mcp');

    logger.info('\nExtracted Metrics Summary:');
    logger.info('-------------------------');
    logger.info(`Total tasks processed: ${taskMetrics.length}`);
    logger.info(`Control tasks: ${controlTasks.length}`);
    logger.info(`MCP tasks: ${mcpTasks.length}`);

    logger.info('\nTask Details:');
    taskMetrics.forEach(task => {
      logger.info(`Task ${task.taskId} (${task.mode}): duration=${(task.duration/1000).toFixed(1)}s, interactions=${task.interactions}, apiCalls=${task.apiCalls}, tokens=${task.tokensIn}`);
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
    console.log(`Cost ($): Control=${controlAvg.cost.toFixed(4)}, MCP=${mcpAvg.cost.toFixed(4)} (${this.percentageChange(mcpAvg.cost, controlAvg.cost)}% change)`);
  }

  calculateAverages(tasks) {
    const count = tasks.length;
    if (count === 0) return { duration: 0, apiCalls: 0, interactions: 0, tokens: 0, cost: 0 };

    return {
      duration: tasks.reduce((sum, t) => sum + t.duration, 0) / count,
      apiCalls: tasks.reduce((sum, t) => sum + t.apiCalls, 0) / count,
      interactions: tasks.reduce((sum, t) => sum + t.interactions, 0) / count,
      tokens: tasks.reduce((sum, t) => sum + (t.totalTokens || 0), 0) / count,
      cost: tasks.reduce((sum, t) => sum + (t.cost || 0), 0) / count
    };
  }

  percentageChange(newValue, oldValue) {
    if (oldValue === 0) return 'N/A';
    return ((newValue - oldValue) / oldValue * 100).toFixed(1);
  }
}

module.exports = SummaryGenerator;
