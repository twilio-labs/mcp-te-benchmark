/**
 * Result class for consistent error handling
 */
export default class SummaryResult {
  success: boolean;

  message: string;

  data: any[];

  failedFiles: string[];

  /**
   * Create a new SummaryResult
   * @param {boolean} success Whether the operation was successful
   * @param {string} message A message describing the result
   * @param {Array} data The metrics data
   * @param {Array} failedFiles Any files that failed to process
   */
  constructor(
    success: boolean,
    message: string,
    data: any[] = [],
    failedFiles: string[] = [],
  ) {
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
  static success(
    message: string,
    data: any[] = [],
    failedFiles: string[] = [],
  ): SummaryResult {
    return new SummaryResult(true, message, data, failedFiles);
  }

  /**
   * Create an error result
   * @param {string} message Error message
   * @param {Array} data Any partial data that was collected
   * @param {Array} failedFiles Any files that failed to process
   * @returns {SummaryResult} An error result
   */
  static error(
    message: string,
    data: any[] = [],
    failedFiles: string[] = [],
  ): SummaryResult {
    return new SummaryResult(false, message, data, failedFiles);
  }
}
