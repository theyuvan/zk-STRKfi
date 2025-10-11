const secrets = require('secrets.js-34r7h');
const crypto = require('crypto');
const logger = require('../utils/logger');

class ShamirService {
  /**
   * Split a secret into shares using Shamir's Secret Sharing
   * @param {string} secret - Secret to split (hex string)
   * @param {number} totalShares - Total number of shares
   * @param {number} threshold - Minimum shares needed to reconstruct
   * @returns {array} Array of share strings
   */
  splitSecret(secret, totalShares = 3, threshold = 2) {
    try {
      if (threshold > totalShares) {
        throw new Error('Threshold cannot exceed total shares');
      }

      if (threshold < 2) {
        throw new Error('Threshold must be at least 2');
      }

      // Convert secret to hex if it's not already
      const hexSecret = Buffer.isBuffer(secret) 
        ? secret.toString('hex')
        : typeof secret === 'string' && !secret.match(/^[0-9a-f]+$/i)
        ? Buffer.from(secret).toString('hex')
        : secret;

      const shares = secrets.share(hexSecret, totalShares, threshold);

      logger.info('Secret split into shares', {
        totalShares,
        threshold,
        shareCount: shares.length
      });

      return shares;
    } catch (error) {
      logger.error('Secret splitting failed', { error: error.message });
      throw new Error(`Secret splitting failed: ${error.message}`);
    }
  }

  /**
   * Combine shares to reconstruct the secret
   * @param {array} shares - Array of share strings
   * @returns {string} Reconstructed secret (hex string)
   */
  combineShares(shares) {
    try {
      if (!Array.isArray(shares) || shares.length < 2) {
        throw new Error('At least 2 shares required to reconstruct secret');
      }

      const reconstructed = secrets.combine(shares);

      logger.info('Secret reconstructed from shares', {
        shareCount: shares.length
      });

      return reconstructed;
    } catch (error) {
      logger.error('Secret reconstruction failed', { error: error.message });
      throw new Error(`Secret reconstruction failed: ${error.message}`);
    }
  }

  /**
   * Generate a random secret key
   * @param {number} bytes - Number of bytes (default 32 for AES-256)
   * @returns {string} Random secret in hex
   */
  generateRandomSecret(bytes = 32) {
    return crypto.randomBytes(bytes).toString('hex');
  }

  /**
   * Split encryption key for identity data
   * @param {string} encryptionKey - Encryption key to split
   * @returns {object} { shares: array, threshold: number, total: number }
   */
  splitEncryptionKey(encryptionKey) {
    const threshold = parseInt(process.env.TRUSTEE_THRESHOLD) || 2;
    const total = parseInt(process.env.TRUSTEE_TOTAL) || 3;

    const shares = this.splitSecret(encryptionKey, total, threshold);

    return {
      shares,
      threshold,
      total,
      shareIds: shares.map((_, idx) => `trustee_${idx + 1}`)
    };
  }

  /**
   * Reconstruct encryption key from trustee shares
   * @param {array} shares - Array of shares from trustees
   * @returns {string} Reconstructed encryption key
   */
  reconstructEncryptionKey(shares) {
    const threshold = parseInt(process.env.TRUSTEE_THRESHOLD) || 2;

    if (shares.length < threshold) {
      throw new Error(`Insufficient shares: need ${threshold}, got ${shares.length}`);
    }

    return this.combineShares(shares);
  }

  /**
   * Validate share format
   * @param {string} share - Share to validate
   * @returns {boolean} True if valid
   */
  validateShare(share) {
    try {
      // Basic validation: shares should be hex strings with specific format
      return typeof share === 'string' && share.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get share metadata
   * @param {string} share - Share to analyze
   * @returns {object} Share metadata
   */
  getShareMetadata(share) {
    return {
      length: share.length,
      isValid: this.validateShare(share)
    };
  }
}

module.exports = new ShamirService();
