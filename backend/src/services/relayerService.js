const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Optional relayer service for meta-transactions
 * Allows users to interact without gas fees
 */
class RelayerService {
  constructor() {
    this.endpoint = process.env.RELAYER_ENDPOINT;
    this.feeAccount = process.env.RELAYER_FEE_ACCOUNT;
    this.enabled = process.env.USE_RELAYER === 'true';
    this.pendingTxs = new Map();
  }

  /**
   * Check if relayer is enabled
   * @returns {boolean} True if relayer is enabled
   */
  isEnabled() {
    return this.enabled && !!this.endpoint;
  }

  /**
   * Submit transaction to relayer
   * @param {object} txData - Transaction data
   * @param {string} signature - User signature
   * @returns {object} Relayer response with tx hash
   */
  async submitTransaction(txData, signature) {
    try {
      if (!this.isEnabled()) {
        throw new Error('Relayer service is not enabled');
      }

      const payload = {
        transaction: txData,
        signature: signature,
        feeAccount: this.feeAccount,
        timestamp: Date.now()
      };

      const response = await axios.post(
        `${this.endpoint}/submit`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const { txHash, relayerId } = response.data;

      this.pendingTxs.set(txHash, {
        relayerId,
        submittedAt: Date.now(),
        status: 'pending'
      });

      logger.info('Transaction submitted to relayer', {
        txHash,
        relayerId
      });

      return {
        txHash,
        relayerId,
        status: 'pending'
      };
    } catch (error) {
      logger.error('Failed to submit transaction to relayer', {
        error: error.message
      });
      throw new Error(`Relayer submission failed: ${error.message}`);
    }
  }

  /**
   * Get transaction status from relayer
   * @param {string} txHash - Transaction hash
   * @returns {object} Transaction status
   */
  async getTransactionStatus(txHash) {
    try {
      if (!this.isEnabled()) {
        throw new Error('Relayer service is not enabled');
      }

      const response = await axios.get(
        `${this.endpoint}/status/${txHash}`,
        { timeout: 10000 }
      );

      const status = response.data;

      // Update local cache
      if (this.pendingTxs.has(txHash)) {
        this.pendingTxs.set(txHash, {
          ...this.pendingTxs.get(txHash),
          status: status.status,
          updatedAt: Date.now()
        });
      }

      logger.info('Retrieved transaction status from relayer', {
        txHash,
        status: status.status
      });

      return status;
    } catch (error) {
      logger.error('Failed to get transaction status from relayer', {
        txHash,
        error: error.message
      });
      throw new Error(`Status retrieval failed: ${error.message}`);
    }
  }

  /**
   * Estimate relayer fee for transaction
   * @param {object} txData - Transaction data
   * @returns {object} Fee estimate
   */
  async estimateFee(txData) {
    try {
      if (!this.isEnabled()) {
        return { fee: 0, currency: 'ETH' };
      }

      const response = await axios.post(
        `${this.endpoint}/estimate`,
        { transaction: txData },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      logger.info('Estimated relayer fee', {
        fee: response.data.fee
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to estimate relayer fee', {
        error: error.message
      });
      throw new Error(`Fee estimation failed: ${error.message}`);
    }
  }

  /**
   * Get pending transactions
   * @returns {array} Array of pending transactions
   */
  getPendingTransactions() {
    return Array.from(this.pendingTxs.entries()).map(([txHash, data]) => ({
      txHash,
      ...data
    }));
  }

  /**
   * Clean up old pending transactions
   * @param {number} maxAge - Maximum age in milliseconds (default 24 hours)
   */
  cleanupOldTransactions(maxAge = 24 * 60 * 60 * 1000) {
    const now = Date.now();
    let cleaned = 0;

    for (const [txHash, data] of this.pendingTxs.entries()) {
      if (now - data.submittedAt > maxAge) {
        this.pendingTxs.delete(txHash);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Cleaned up old pending transactions', { cleaned });
    }
  }
}

module.exports = new RelayerService();
