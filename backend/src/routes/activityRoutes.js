/**
 * Activity & Transaction History Routes
 * Provides real transaction data and activity scores using Blast API
 */

const express = require('express');
const { fetchRealActivityData, getActivityScore } = require('../services/transactionFetcher');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/activity/:walletAddress
 * Get complete activity data with transaction history
 */
router.get('/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const maxBlocks = parseInt(req.query.maxBlocks) || 1000;
    
    logger.info(`📊 Fetching activity data for wallet: ${walletAddress}`);
    
    const activityData = await fetchRealActivityData(walletAddress, maxBlocks);
    
    res.json({
      success: true,
      data: activityData
    });
    
  } catch (error) {
    logger.error('❌ Error fetching activity data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/activity/:walletAddress/score
 * Get just the activity score (lightweight)
 */
router.get('/:walletAddress/score', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    logger.info(`🔢 Fetching activity score for wallet: ${walletAddress}`);
    
    const score = await getActivityScore(walletAddress);
    
    res.json({
      success: true,
      score,
      walletAddress
    });
    
  } catch (error) {
    logger.error('❌ Error fetching activity score:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/activity/:walletAddress/transactions
 * Get transaction breakdown (sent vs received)
 */
router.get('/:walletAddress/transactions', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const maxBlocks = parseInt(req.query.maxBlocks) || 1000;
    
    logger.info(`📜 Fetching transactions for wallet: ${walletAddress}`);
    
    const activityData = await fetchRealActivityData(walletAddress, maxBlocks);
    
    res.json({
      success: true,
      walletAddress,
      sent: activityData.sentTransactions,
      received: activityData.receivedTransactions,
      summary: {
        totalTransactions: activityData.totalTransactions,
        totalVolume: activityData.totalVolumeFormatted,
        score: activityData.score
      }
    });
    
  } catch (error) {
    logger.error('❌ Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
