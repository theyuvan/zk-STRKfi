const logger = require('./logger');

/**
 * Simple in-memory scheduler for dispute windows and delayed tasks
 */
class Scheduler {
  constructor() {
    this.tasks = new Map();
    this.taskIdCounter = 0;
  }

  /**
   * Schedule a task to run after a delay
   * @param {function} callback - Function to execute
   * @param {number} delayMs - Delay in milliseconds
   * @param {object} metadata - Metadata for logging
   * @returns {number} Task ID
   */
  schedule(callback, delayMs, metadata = {}) {
    const taskId = ++this.taskIdCounter;
    
    const timeout = setTimeout(() => {
      logger.info('Executing scheduled task', { taskId, metadata });
      try {
        callback();
        this.tasks.delete(taskId);
      } catch (error) {
        logger.error('Scheduled task failed', {
          taskId,
          metadata,
          error: error.message
        });
        this.tasks.delete(taskId);
      }
    }, delayMs);

    this.tasks.set(taskId, {
      timeout,
      scheduledAt: Date.now(),
      executeAt: Date.now() + delayMs,
      metadata
    });

    logger.info('Scheduled task', {
      taskId,
      delayMs,
      executeAt: new Date(Date.now() + delayMs).toISOString(),
      metadata
    });

    return taskId;
  }

  /**
   * Cancel a scheduled task
   * @param {number} taskId - Task ID to cancel
   * @returns {boolean} True if task was cancelled
   */
  cancel(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) {
      logger.warn('Attempted to cancel non-existent task', { taskId });
      return false;
    }

    clearTimeout(task.timeout);
    this.tasks.delete(taskId);
    logger.info('Cancelled scheduled task', { taskId, metadata: task.metadata });
    return true;
  }

  /**
   * Schedule dispute window completion
   * @param {string} loanId - Loan ID
   * @param {function} callback - Callback to execute
   * @returns {number} Task ID
   */
  scheduleDisputeWindow(loanId, callback) {
    const delayMs = parseInt(process.env.DISPUTE_WINDOW_SECONDS || '604800') * 1000;
    return this.schedule(callback, delayMs, {
      type: 'dispute_window',
      loanId
    });
  }

  /**
   * Get all pending tasks
   * @returns {Array} Array of task info
   */
  getPendingTasks() {
    return Array.from(this.tasks.entries()).map(([taskId, task]) => ({
      taskId,
      scheduledAt: task.scheduledAt,
      executeAt: task.executeAt,
      metadata: task.metadata
    }));
  }

  /**
   * Clear all scheduled tasks
   */
  clearAll() {
    for (const [taskId, task] of this.tasks.entries()) {
      clearTimeout(task.timeout);
    }
    this.tasks.clear();
    logger.info('Cleared all scheduled tasks');
  }
}

module.exports = new Scheduler();
