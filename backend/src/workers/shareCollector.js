const axios = require('axios');
const shamirService = require('../services/shamirService');
const ipfsService = require('../services/ipfsService');
const logger = require('../utils/logger');

/**
 * Worker to collect Shamir shares from trustees
 */
class ShareCollector {
  constructor() {
    this.threshold = parseInt(process.env.TRUSTEE_THRESHOLD) || 2;
    this.total = parseInt(process.env.TRUSTEE_TOTAL) || 3;
    this.collectionTimeout = 48 * 60 * 60 * 1000; // 48 hours
  }

  /**
   * Collect shares from trustees for a defaulted loan
   */
  async collectShares(loanId) {
    try {
      logger.info('Starting share collection', { loanId });

      const trusteeEndpoints = this.getTrusteeEndpoints();
      const shares = [];
      const collectionResults = [];

      // Request shares from all trustees
      for (let i = 0; i < trusteeEndpoints.length; i++) {
        try {
          const endpoint = trusteeEndpoints[i];
          if (!endpoint) {
            logger.warn('Trustee endpoint not configured', { trusteeIndex: i });
            continue;
          }

          const response = await axios.post(
            `${endpoint}/request-share`,
            {
              loanId,
              timestamp: Date.now(),
              reason: 'default_triggered'
            },
            {
              headers: { 'Content-Type': 'application/json' },
              timeout: 30000
            }
          );

          if (response.data.share) {
            shares.push(response.data.share);
            collectionResults.push({
              trusteeIndex: i,
              status: 'collected',
              shareId: `trustee_${i + 1}`
            });

            logger.info('Share collected from trustee', {
              loanId,
              trusteeIndex: i
            });
          }
        } catch (error) {
          logger.error('Failed to collect share from trustee', {
            loanId,
            trusteeIndex: i,
            error: error.message
          });

          collectionResults.push({
            trusteeIndex: i,
            status: 'failed',
            error: error.message
          });
        }
      }

      logger.info('Share collection completed', {
        loanId,
        collected: shares.length,
        required: this.threshold
      });

      return {
        loanId,
        shares,
        threshold: this.threshold,
        collected: shares.length,
        sufficient: shares.length >= this.threshold,
        results: collectionResults
      };
    } catch (error) {
      logger.error('Share collection failed', {
        loanId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Reconstruct identity after collecting shares
   */
  async reconstructAndReveal(loanId, shares, cid) {
    try {
      if (shares.length < this.threshold) {
        throw new Error(`Insufficient shares: need ${this.threshold}, got ${shares.length}`);
      }

      logger.info('Reconstructing identity', { loanId, sharesUsed: shares.length });

      // Reconstruct encryption key
      const encryptionKey = shamirService.reconstructEncryptionKey(shares);

      // Retrieve and decrypt identity
      const encryptedData = await ipfsService.retrieveFromIPFS(cid);
      const identityData = ipfsService.decryptData(encryptedData, encryptionKey);

      logger.info('Identity reconstructed successfully', { loanId });

      return {
        loanId,
        identityData,
        sharesUsed: shares.length,
        reconstructedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Identity reconstruction failed', {
        loanId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get trustee endpoints from environment
   */
  getTrusteeEndpoints() {
    const endpoints = [];
    for (let i = 1; i <= this.total; i++) {
      const endpoint = process.env[`TRUSTEE_${i}_ENDPOINT`];
      endpoints.push(endpoint || null);
    }
    return endpoints;
  }

  /**
   * Request specific share from trustee
   */
  async requestShareFromTrustee(trusteeIndex, loanId) {
    try {
      const endpoints = this.getTrusteeEndpoints();
      const endpoint = endpoints[trusteeIndex];

      if (!endpoint) {
        throw new Error(`Trustee ${trusteeIndex} endpoint not configured`);
      }

      const response = await axios.post(
        `${endpoint}/request-share`,
        {
          loanId,
          timestamp: Date.now(),
          trusteeIndex
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        }
      );

      logger.info('Share requested from trustee', {
        loanId,
        trusteeIndex
      });

      return response.data.share;
    } catch (error) {
      logger.error('Failed to request share from trustee', {
        loanId,
        trusteeIndex,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new ShareCollector();
