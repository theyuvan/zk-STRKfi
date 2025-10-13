import StarkNetService from '../services/starknetService';
import { ActivityScoreCalculator } from '../services/activityScoreCalculator';

const starknetService = new StarkNetService();
const activityScoreCalculator = new ActivityScoreCalculator();

/**
 * Get complete activity data for a wallet address
 * @param {string} walletAddress - The StarkNet wallet address
 * @returns {Promise<{balance: string, txCount: number, score: number}>}
 */
export async function getActivityData(walletAddress) {
  console.log('📊 Getting activity data for:', walletAddress);

  // Fetch activity metrics
  const metrics = await starknetService.calculateActivityMetrics(walletAddress);
  console.log('📦 Activity metrics calculated:', metrics);

  // Calculate activity score
  const scoreResult = activityScoreCalculator.calculateScore(metrics);
  console.log('🎯 Activity score calculated:', scoreResult.total);
  console.log('📊 Score breakdown:', scoreResult);

  return {
    balance: metrics.balance.toFixed(6),
    txCount: metrics.txCount,
    score: scoreResult.total,
    metrics,
    scoreBreakdown: scoreResult
  };
}
