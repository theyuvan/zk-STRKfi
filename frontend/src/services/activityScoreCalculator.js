/**
 * Activity Score Calculator
 * Calculates wallet activity score (0-1000) based on real transaction data
 * NO MOCKS - Uses actual StarkNet blockchain data
 */

export class ActivityScoreCalculator {
  /**
   * Calculate comprehensive activity score from wallet metrics
   * @param {object} metrics - Activity metrics from starknetService
   * @returns {object} Detailed score breakdown
   */
  calculateScore(metrics) {
    console.log('🎯 Calculating activity score from metrics:', metrics);

    const scores = {
      // Component scores (each max 300-400 points)
      balanceScore: this.calculateBalanceScore(metrics.balance),
      transactionCountScore: this.calculateTransactionCountScore(metrics.txCount),
      volumeScore: this.calculateVolumeScore(metrics.totalVolume),
      consistencyScore: this.calculateConsistencyScore(metrics),
      
      // Bonus points
      recentActivityBonus: this.calculateRecentActivityBonus(metrics.recentTxCount),
      
      // Total score (max 1000)
      total: 0,
      
      // Raw metrics for reference
      metrics: {
        balance: metrics.balance,
        txCount: metrics.txCount,
        totalVolume: metrics.totalVolume,
        walletAge: metrics.walletAge,
        recentTxCount: metrics.recentTxCount
      }
    };

    // Calculate total (capped at 1000 for circuit constraint)
    scores.total = Math.min(
      scores.balanceScore +
      scores.transactionCountScore +
      scores.volumeScore +
      scores.consistencyScore +
      scores.recentActivityBonus,
      1000
    );

    console.log('✅ Activity score calculated:', scores.total);
    console.log('📊 Score breakdown:', {
      balance: scores.balanceScore,
      txCount: scores.transactionCountScore,
      volume: scores.volumeScore,
      consistency: scores.consistencyScore,
      bonus: scores.recentActivityBonus
    });

    return scores;
  }

  /**
   * Balance Score (0-300 points)
   * Rewards users for holding STRK tokens
   */
  calculateBalanceScore(balance) {
    // Score tiers:
    // 0-1 STRK: Linear (0-50 pts)
    // 1-10 STRK: Linear (50-150 pts)
    // 10-50 STRK: Linear (150-250 pts)
    // 50+ STRK: Capped (300 pts)

    if (balance >= 50) return 300;
    if (balance >= 10) return 150 + Math.round((balance - 10) * 2.5);
    if (balance >= 1) return 50 + Math.round((balance - 1) * 11.11);
    return Math.round(balance * 50);
  }

  /**
   * Transaction Count Score (0-400 points)
   * Rewards active wallets with many transactions
   */
  calculateTransactionCountScore(txCount) {
    // Score tiers:
    // 0-10 txs: 5 pts each
    // 10-50 txs: 3 pts each
    // 50-100 txs: 2 pts each
    // 100+ txs: 1 pt each, capped at 400

    if (txCount === 0) return 0;
    if (txCount <= 10) return txCount * 5;
    if (txCount <= 50) return 50 + ((txCount - 10) * 3);
    if (txCount <= 100) return 170 + ((txCount - 50) * 2);
    return Math.min(270 + (txCount - 100), 400);
  }

  /**
   * Volume Score (0-200 points)
   * Rewards high transaction volume
   */
  calculateVolumeScore(totalVolume) {
    // Score tiers based on total STRK transacted:
    // 0-10 STRK: Linear (0-50 pts)
    // 10-100 STRK: Linear (50-150 pts)
    // 100+ STRK: Capped (200 pts)

    if (totalVolume >= 100) return 200;
    if (totalVolume >= 10) return 50 + Math.round((totalVolume - 10) * 1.11);
    return Math.round(totalVolume * 5);
  }

  /**
   * Consistency Score (0-150 points)
   * Rewards regular, consistent activity over time
   */
  calculateConsistencyScore(metrics) {
    const { txCount, walletAge, recentTxCount } = metrics;

    // If no transactions, no consistency
    if (txCount === 0) return 0;

    // Calculate activity frequency (transactions per day)
    const walletAgeDays = walletAge / (24 * 60 * 60);
    const txPerDay = walletAgeDays > 0 ? txCount / walletAgeDays : 0;

    // Consistency tiers:
    let score = 0;

    // Regular activity (1+ tx per week)
    if (txPerDay >= 0.14) score += 50;

    // High activity (1+ tx per day)
    if (txPerDay >= 1) score += 50;

    // Recent activity (tx in last 7 days)
    if (recentTxCount > 0) score += Math.min(recentTxCount * 10, 50);

    return Math.min(score, 150);
  }

  /**
   * Recent Activity Bonus (0-50 points)
   * Extra points for very recent activity
   */
  calculateRecentActivityBonus(recentTxCount) {
    // Last 7 days activity:
    // 1-5 txs: +10 pts
    // 6-10 txs: +25 pts
    // 11+ txs: +50 pts

    if (recentTxCount >= 11) return 50;
    if (recentTxCount >= 6) return 25;
    if (recentTxCount >= 1) return 10;
    return 0;
  }

  /**
   * Get score tier information
   * @param {number} score - Activity score
   * @returns {object} Tier information
   */
  getScoreTier(score) {
    if (score >= 800) {
      return {
        tier: 'Excellent',
        color: 'green',
        description: 'Highly active wallet with strong transaction history',
        loanEligibility: 'Eligible for premium loan offers'
      };
    }
    if (score >= 600) {
      return {
        tier: 'Good',
        color: 'blue',
        description: 'Active wallet with solid transaction history',
        loanEligibility: 'Eligible for standard loan offers'
      };
    }
    if (score >= 400) {
      return {
        tier: 'Fair',
        color: 'yellow',
        description: 'Moderate wallet activity',
        loanEligibility: 'Eligible for basic loan offers'
      };
    }
    if (score >= 200) {
      return {
        tier: 'Low',
        color: 'orange',
        description: 'Limited wallet activity',
        loanEligibility: 'Limited loan options available'
      };
    }
    return {
      tier: 'Very Low',
      color: 'red',
      description: 'Minimal or no wallet activity',
      loanEligibility: 'Insufficient activity for most loans'
    };
  }

  /**
   * Get improvement suggestions based on score
   * @param {object} scoreData - Score breakdown
   * @returns {Array<string>} Suggestions
   */
  getImprovementSuggestions(scoreData) {
    const suggestions = [];

    if (scoreData.balanceScore < 100) {
      suggestions.push(
        `💰 Increase your STRK balance to improve score (Current: ${scoreData.metrics.balance.toFixed(2)} STRK)`
      );
    }

    if (scoreData.transactionCountScore < 100) {
      suggestions.push(
        `📊 Make more transactions to demonstrate wallet activity (Current: ${scoreData.metrics.txCount} transactions)`
      );
    }

    if (scoreData.volumeScore < 50) {
      suggestions.push(
        `💸 Increase transaction volume to show financial activity (Current: ${scoreData.metrics.totalVolume.toFixed(2)} STRK total)`
      );
    }

    if (scoreData.recentActivityBonus === 0) {
      suggestions.push(
        '⏰ Make some recent transactions (last 7 days activity counts more)'
      );
    }

    if (suggestions.length === 0) {
      suggestions.push('🎉 Great score! Keep up the good activity!');
    }

    return suggestions;
  }

  /**
   * Format score for ZK circuit input
   * @param {number} score - Activity score
   * @returns {string} Formatted score for circuit
   */
  formatForCircuit(score) {
    // Ensure score is integer and within valid range
    const validScore = Math.max(0, Math.min(1000, Math.round(score)));
    return validScore.toString();
  }

  /**
   * Check if score meets loan threshold
   * @param {number} score - Activity score
   * @param {number} threshold - Loan threshold
   * @returns {object} Eligibility result
   */
  checkLoanEligibility(score, threshold) {
    const eligible = score >= threshold;
    const difference = score - threshold;

    return {
      eligible,
      score,
      threshold,
      difference,
      message: eligible
        ? `✅ Eligible! Your score (${score}) exceeds the threshold (${threshold})`
        : `❌ Not eligible. You need ${Math.abs(difference)} more points (Current: ${score}, Required: ${threshold})`
    };
  }
}

// Export singleton instance
export const activityScoreCalculator = new ActivityScoreCalculator();
