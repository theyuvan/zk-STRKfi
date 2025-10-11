const onchainService = require('../services/onchainService');
const logger = require('../utils/logger');

/**
 * Event watcher for on-chain loan events
 */
class EventWatcher {
  constructor() {
    this.isRunning = false;
    this.pollInterval = 15000; // 15 seconds
    this.lastProcessedBlock = null;
    this.intervalId = null;
  }

  /**
   * Start watching for events
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Event watcher already running');
      return;
    }

    this.isRunning = true;
    logger.info('Event watcher started');

    // Get current block
    try {
      this.lastProcessedBlock = await onchainService.getCurrentBlock();
      logger.info('Starting from block', { block: this.lastProcessedBlock });
    } catch (error) {
      logger.error('Failed to get starting block', { error: error.message });
      this.lastProcessedBlock = 'latest';
    }

    // Start polling
    this.intervalId = setInterval(() => {
      this.pollEvents().catch(error => {
        logger.error('Event polling failed', { error: error.message });
      });
    }, this.pollInterval);
  }

  /**
   * Stop watching for events
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    logger.info('Event watcher stopped');
  }

  /**
   * Poll for new events
   */
  async pollEvents() {
    try {
      const currentBlock = await onchainService.getCurrentBlock();

      if (currentBlock === this.lastProcessedBlock) {
        return;
      }

      logger.debug('Polling events', {
        from: this.lastProcessedBlock,
        to: currentBlock
      });

      // Get events from last processed block to current
      const events = await onchainService.getLoanEvents(
        this.lastProcessedBlock,
        currentBlock
      );

      if (events.length > 0) {
        logger.info('Processing events', { count: events.length });
        await this.processEvents(events);
      }

      this.lastProcessedBlock = currentBlock;
    } catch (error) {
      logger.error('Failed to poll events', { error: error.message });
    }
  }

  /**
   * Process discovered events
   */
  async processEvents(events) {
    for (const event of events) {
      try {
        await this.handleEvent(event);
      } catch (error) {
        logger.error('Failed to process event', {
          event: event.name,
          error: error.message
        });
      }
    }
  }

  /**
   * Handle individual event
   */
  async handleEvent(event) {
    const eventName = event.name;

    switch (eventName) {
      case 'LoanRequested':
        await this.handleLoanRequested(event);
        break;

      case 'LoanFunded':
        await this.handleLoanFunded(event);
        break;

      case 'PaymentReported':
        await this.handlePaymentReported(event);
        break;

      case 'DefaultTriggered':
        await this.handleDefaultTriggered(event);
        break;

      case 'IdentityRevealed':
        await this.handleIdentityRevealed(event);
        break;

      default:
        logger.debug('Unknown event type', { eventName });
    }
  }

  /**
   * Handle LoanRequested event
   */
  async handleLoanRequested(event) {
    logger.info('Loan requested', {
      loanId: event.data.loanId,
      borrower: event.data.borrower,
      amount: event.data.amount
    });

    // Trigger notifications, indexing, etc.
  }

  /**
   * Handle LoanFunded event
   */
  async handleLoanFunded(event) {
    logger.info('Loan funded', {
      loanId: event.data.loanId,
      lender: event.data.lender
    });

    // Trigger notifications
  }

  /**
   * Handle PaymentReported event
   */
  async handlePaymentReported(event) {
    logger.info('Payment reported', {
      loanId: event.data.loanId,
      amount: event.data.amount
    });

    // Update payment tracking
  }

  /**
   * Handle DefaultTriggered event
   */
  async handleDefaultTriggered(event) {
    logger.info('Default triggered', {
      loanId: event.data.loanId
    });

    // Start dispute window
    // Initiate trustee share collection
    const shareCollector = require('./shareCollector');
    await shareCollector.collectShares(event.data.loanId);
  }

  /**
   * Handle IdentityRevealed event
   */
  async handleIdentityRevealed(event) {
    logger.info('Identity revealed', {
      loanId: event.data.loanId
    });

    // Process revealed identity for collection
  }

  /**
   * Get watcher status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastProcessedBlock: this.lastProcessedBlock,
      pollInterval: this.pollInterval
    };
  }
}

// Create singleton instance
const eventWatcher = new EventWatcher();

// If this file is run directly, start the watcher
if (require.main === module) {
  require('dotenv').config();
  
  eventWatcher.start().then(() => {
    logger.info('Event watcher running as standalone process');
  }).catch(error => {
    logger.error('Failed to start event watcher', { error: error.message });
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, stopping event watcher');
    eventWatcher.stop();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, stopping event watcher');
    eventWatcher.stop();
    process.exit(0);
  });
}

module.exports = eventWatcher;
