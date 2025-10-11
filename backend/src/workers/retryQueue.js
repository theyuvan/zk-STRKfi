const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const logger = require('../utils/logger');

/**
 * Retry queue for handling transient failures
 */
class RetryQueue {
  constructor() {
    this.connection = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null
    });

    this.queue = new Queue('retry-queue', { connection: this.connection });
    this.worker = null;
  }

  /**
   * Add job to retry queue
   */
  async addJob(jobName, data, options = {}) {
    try {
      const job = await this.queue.add(jobName, data, {
        attempts: options.maxAttempts || 3,
        backoff: {
          type: 'exponential',
          delay: options.backoffDelay || 5000
        },
        removeOnComplete: true,
        removeOnFail: false,
        ...options
      });

      logger.info('Job added to retry queue', {
        jobName,
        jobId: job.id
      });

      return job.id;
    } catch (error) {
      logger.error('Failed to add job to queue', {
        jobName,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Start processing jobs
   */
  startProcessing() {
    if (this.worker) {
      logger.warn('Worker already running');
      return;
    }

    this.worker = new Worker(
      'retry-queue',
      async (job) => {
        return await this.processJob(job);
      },
      {
        connection: this.connection,
        concurrency: 5
      }
    );

    this.worker.on('completed', (job) => {
      logger.info('Job completed', {
        jobId: job.id,
        jobName: job.name
      });
    });

    this.worker.on('failed', (job, error) => {
      logger.error('Job failed', {
        jobId: job?.id,
        jobName: job?.name,
        error: error.message,
        attempts: job?.attemptsMade
      });
    });

    logger.info('Retry queue worker started');
  }

  /**
   * Process individual job
   */
  async processJob(job) {
    const { name, data } = job;

    logger.info('Processing job', {
      jobId: job.id,
      jobName: name,
      attempt: job.attemptsMade
    });

    switch (name) {
      case 'distribute_share':
        return await this.handleDistributeShare(data);

      case 'collect_share':
        return await this.handleCollectShare(data);

      case 'submit_transaction':
        return await this.handleSubmitTransaction(data);

      default:
        logger.warn('Unknown job type', { jobName: name });
        throw new Error(`Unknown job type: ${name}`);
    }
  }

  /**
   * Handle share distribution retry
   */
  async handleDistributeShare(data) {
    const { shareId, trusteeEndpoint, shareData } = data;
    const axios = require('axios');

    const response = await axios.post(
      trusteeEndpoint,
      shareData,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );

    logger.info('Share distributed successfully', { shareId });
    return response.data;
  }

  /**
   * Handle share collection retry
   */
  async handleCollectShare(data) {
    const { loanId, trusteeEndpoint } = data;
    const axios = require('axios');

    const response = await axios.post(
      `${trusteeEndpoint}/request-share`,
      { loanId, timestamp: Date.now() },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );

    logger.info('Share collected successfully', { loanId });
    return response.data;
  }

  /**
   * Handle transaction submission retry
   */
  async handleSubmitTransaction(data) {
    const { txData, relayerEndpoint } = data;
    const axios = require('axios');

    const response = await axios.post(
      `${relayerEndpoint}/submit`,
      txData,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );

    logger.info('Transaction submitted successfully');
    return response.data;
  }

  /**
   * Get queue status
   */
  async getStatus() {
    const waiting = await this.queue.getWaitingCount();
    const active = await this.queue.getActiveCount();
    const failed = await this.queue.getFailedCount();
    const delayed = await this.queue.getDelayedCount();

    return {
      waiting,
      active,
      failed,
      delayed,
      total: waiting + active + failed + delayed
    };
  }

  /**
   * Stop processing and close connections
   */
  async stop() {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }

    await this.queue.close();
    await this.connection.quit();

    logger.info('Retry queue stopped');
  }
}

module.exports = new RetryQueue();
