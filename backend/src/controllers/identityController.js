const ipfsService = require('../services/ipfsService');
const shamirService = require('../services/shamirService');
const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Controller for identity encryption and share distribution
 */
class IdentityController {
  /**
   * Encrypt identity data and upload to IPFS
   */
  async encryptAndStore(req, res) {
    try {
      const { identityData, borrowerAddress } = req.body;

      if (!identityData || !borrowerAddress) {
        return res.status(400).json({
          error: 'Missing required fields: identityData, borrowerAddress'
        });
      }

      // Generate encryption key
      const encryptionKey = shamirService.generateRandomSecret(32);

      // Encrypt identity data
      const encryptedData = ipfsService.encryptData(identityData, encryptionKey);

      // Upload to IPFS
      const cid = await ipfsService.uploadToIPFS(encryptedData);

      // Split encryption key into shares
      const { shares, threshold, total, shareIds } = shamirService.splitEncryptionKey(
        encryptionKey
      );

      logger.info('Identity encrypted and stored', {
        borrowerAddress,
        cid,
        threshold,
        totalShares: total
      });

      res.json({
        message: 'Identity encrypted and stored successfully',
        cid,
        gatewayUrl: ipfsService.getGatewayURL(cid),
        shares: shares.map((share, idx) => ({
          shareId: shareIds[idx],
          share,
          trusteeEndpoint: process.env[`TRUSTEE_${idx + 1}_ENDPOINT`]
        })),
        threshold,
        total,
        borrowerAddress
      });
    } catch (error) {
      logger.error('Encrypt and store failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Distribute shares to trustees
   */
  async distributeShares(req, res) {
    try {
      const { shares, loanId, borrowerAddress } = req.body;

      if (!shares || !loanId || !borrowerAddress) {
        return res.status(400).json({
          error: 'Missing required fields: shares, loanId, borrowerAddress'
        });
      }

      const distributionResults = [];

      for (const shareData of shares) {
        try {
          const { shareId, share, trusteeEndpoint } = shareData;

          if (!trusteeEndpoint) {
            logger.warn('No trustee endpoint configured', { shareId });
            distributionResults.push({
              shareId,
              status: 'skipped',
              reason: 'No endpoint configured'
            });
            continue;
          }

          // Send share to trustee
          const response = await axios.post(
            trusteeEndpoint,
            {
              loanId,
              borrowerAddress,
              shareId,
              share,
              timestamp: Date.now()
            },
            {
              headers: { 'Content-Type': 'application/json' },
              timeout: 10000
            }
          );

          distributionResults.push({
            shareId,
            status: 'delivered',
            trusteeResponse: response.data
          });

          logger.info('Share distributed to trustee', {
            shareId,
            loanId,
            trusteeEndpoint
          });
        } catch (error) {
          logger.error('Failed to distribute share', {
            shareId: shareData.shareId,
            error: error.message
          });

          distributionResults.push({
            shareId: shareData.shareId,
            status: 'failed',
            error: error.message
          });
        }
      }

      const successCount = distributionResults.filter(r => r.status === 'delivered').length;

      res.json({
        message: 'Share distribution completed',
        loanId,
        totalShares: shares.length,
        successfulDeliveries: successCount,
        results: distributionResults
      });
    } catch (error) {
      logger.error('Distribute shares failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Reconstruct identity from trustee shares
   */
  async reconstructIdentity(req, res) {
    try {
      const { shares, cid } = req.body;

      if (!shares || !cid) {
        return res.status(400).json({
          error: 'Missing required fields: shares, cid'
        });
      }

      const threshold = parseInt(process.env.TRUSTEE_THRESHOLD) || 2;

      if (shares.length < threshold) {
        return res.status(400).json({
          error: `Insufficient shares: need ${threshold}, got ${shares.length}`
        });
      }

      // Reconstruct encryption key
      const encryptionKey = shamirService.reconstructEncryptionKey(shares);

      // Retrieve encrypted data from IPFS
      const encryptedData = await ipfsService.retrieveFromIPFS(cid);

      // Decrypt identity data
      const identityData = ipfsService.decryptData(encryptedData, encryptionKey);

      logger.info('Identity reconstructed from shares', {
        cid,
        sharesUsed: shares.length
      });

      res.json({
        message: 'Identity reconstructed successfully',
        identityData,
        sharesUsed: shares.length,
        threshold
      });
    } catch (error) {
      logger.error('Reconstruct identity failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get identity encryption status
   */
  async getShareStatus(req, res) {
    try {
      const { loanId } = req.params;

      if (!loanId) {
        return res.status(400).json({ error: 'Loan ID required' });
      }

      // In production, this would query trustee nodes for share status
      const status = {
        loanId,
        threshold: parseInt(process.env.TRUSTEE_THRESHOLD) || 2,
        total: parseInt(process.env.TRUSTEE_TOTAL) || 3,
        sharesDistributed: 0,
        sharesCollected: 0
      };

      logger.info('Share status retrieved', { loanId });

      res.json(status);
    } catch (error) {
      logger.error('Get share status failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Decrypt identity from IPFS (requires encryption key)
   */
  async decryptFromIPFS(req, res) {
    try {
      const { cid, encryptionKey } = req.body;

      if (!cid || !encryptionKey) {
        return res.status(400).json({
          error: 'Missing required fields: cid, encryptionKey'
        });
      }

      // Retrieve encrypted data
      const encryptedData = await ipfsService.retrieveFromIPFS(cid);

      // Decrypt
      const identityData = ipfsService.decryptData(encryptedData, encryptionKey);

      logger.info('Identity decrypted from IPFS', { cid });

      res.json({
        message: 'Identity decrypted successfully',
        identityData
      });
    } catch (error) {
      logger.error('Decrypt from IPFS failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new IdentityController();
