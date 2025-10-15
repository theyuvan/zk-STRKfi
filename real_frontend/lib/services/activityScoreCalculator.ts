/**
 * Activity Score Calculator
 * Calculates wallet activity score (0-1000) based on real transaction data
 * Ported from test frontend - WORKING VERSION
 */

export class ActivityScoreCalculator {
  /**
   * Calculate comprehensive activity score from wallet metrics
   */
  calculateScore(metrics: any) {
    console.log('🎯 Calculating activity score from metrics:', metrics)

    const scores = {
      balanceScore: this.calculateBalanceScore(metrics.balance),
      transactionCountScore: this.calculateTransactionCountScore(metrics.txCount),
      volumeScore: this.calculateVolumeScore(metrics.totalVolume),
      consistencyScore: this.calculateConsistencyScore(metrics),
      recentActivityBonus: this.calculateRecentActivityBonus(metrics.recentTxCount),
      total: 0,
      metrics: {
        balance: metrics.balance,
        txCount: metrics.txCount,
        totalVolume: metrics.totalVolume,
        walletAge: metrics.walletAge,
        recentTxCount: metrics.recentTxCount
      }
    }

    // Calculate total (capped at 1000)
    scores.total = Math.min(
      scores.balanceScore +
      scores.transactionCountScore +
      scores.volumeScore +
      scores.consistencyScore +
      scores.recentActivityBonus,
      1000
    )

    console.log('✅ Activity score calculated:', scores.total)
    console.log('📊 Score breakdown:', {
      balance: scores.balanceScore,
      txCount: scores.transactionCountScore,
      volume: scores.volumeScore,
      consistency: scores.consistencyScore,
      bonus: scores.recentActivityBonus
    })

    return scores
  }

  /**
   * Balance Score (0-300 points)
   */
  calculateBalanceScore(balance: number) {
    if (balance >= 50) return 300
    if (balance >= 10) return 150 + Math.round((balance - 10) * 2.5)
    if (balance >= 1) return 50 + Math.round((balance - 1) * 11.11)
    return Math.round(balance * 50)
  }

  /**
   * Transaction Count Score (0-400 points)
   */
  calculateTransactionCountScore(txCount: number) {
    if (txCount === 0) return 0
    if (txCount <= 10) return txCount * 5
    if (txCount <= 50) return 50 + ((txCount - 10) * 3)
    if (txCount <= 100) return 170 + ((txCount - 50) * 2)
    return Math.min(270 + (txCount - 100), 400)
  }

  /**
   * Volume Score (0-200 points)
   */
  calculateVolumeScore(totalVolume: number) {
    if (totalVolume >= 100) return 200
    if (totalVolume >= 10) return 50 + Math.round((totalVolume - 10) * 1.11)
    return Math.round(totalVolume * 5)
  }

  /**
   * Consistency Score (0-150 points)
   */
  calculateConsistencyScore(metrics: any) {
    const { txCount, walletAge, recentTxCount } = metrics

    if (txCount === 0) return 0

    const walletAgeDays = walletAge / (24 * 60 * 60)
    const txPerDay = walletAgeDays > 0 ? txCount / walletAgeDays : 0

    let score = 0

    if (txPerDay >= 0.14) score += 50
    if (txPerDay >= 1) score += 50
    if (recentTxCount > 0) score += Math.min(recentTxCount * 10, 50)

    return Math.min(score, 150)
  }

  /**
   * Recent Activity Bonus (0-50 points)
   */
  calculateRecentActivityBonus(recentTxCount: number) {
    if (recentTxCount >= 11) return 50
    if (recentTxCount >= 6) return 25
    if (recentTxCount >= 1) return 10
    return 0
  }

  /**
   * Get score tier information
   */
  getScoreTier(score: number) {
    if (score >= 800) {
      return {
        tier: 'Excellent',
        color: 'green',
        description: 'Highly active wallet with strong transaction history',
        loanEligibility: 'Eligible for premium loan offers'
      }
    }
    if (score >= 600) {
      return {
        tier: 'Good',
        color: 'blue',
        description: 'Active wallet with solid transaction history',
        loanEligibility: 'Eligible for standard loan offers'
      }
    }
    if (score >= 400) {
      return {
        tier: 'Fair',
        color: 'yellow',
        description: 'Moderate wallet activity',
        loanEligibility: 'Eligible for basic loan offers'
      }
    }
    if (score >= 200) {
      return {
        tier: 'Low',
        color: 'orange',
        description: 'Limited wallet activity',
        loanEligibility: 'Limited loan options available'
      }
    }
    return {
      tier: 'Very Low',
      color: 'red',
      description: 'Minimal or no wallet activity',
      loanEligibility: 'Insufficient activity for most loans'
    }
  }

  /**
   * Get improvement suggestions
   */
  getImprovementSuggestions(scoreData: any) {
    const suggestions: string[] = []

    if (scoreData.balanceScore < 100) {
      suggestions.push(
        `💰 Increase your STRK balance to improve score (Current: ${scoreData.metrics.balance.toFixed(2)} STRK)`
      )
    }

    if (scoreData.transactionCountScore < 100) {
      suggestions.push(
        `📊 Make more transactions to demonstrate wallet activity (Current: ${scoreData.metrics.txCount} transactions)`
      )
    }

    if (scoreData.volumeScore < 50) {
      suggestions.push(
        `💸 Increase transaction volume to show financial activity (Current: ${scoreData.metrics.totalVolume.toFixed(2)} STRK total)`
      )
    }

    if (scoreData.recentActivityBonus === 0) {
      suggestions.push(
        '⏰ Make some recent transactions (last 7 days activity counts more)'
      )
    }

    if (suggestions.length === 0) {
      suggestions.push('🎉 Great score! Keep up the good activity!')
    }

    return suggestions
  }

  /**
   * Format score for ZK circuit input
   */
  formatForCircuit(score: number) {
    const validScore = Math.max(0, Math.min(1000, Math.round(score)))
    return validScore.toString()
  }

  /**
   * Check if score meets loan threshold
   */
  checkLoanEligibility(score: number, threshold: number) {
    const eligible = score >= threshold
    const difference = score - threshold

    return {
      eligible,
      score,
      threshold,
      difference,
      message: eligible
        ? `✅ Eligible! Your score (${score}) exceeds the threshold (${threshold})`
        : `❌ Not eligible. You need ${Math.abs(difference)} more points (Current: ${score}, Required: ${threshold})`
    }
  }
}

// Export singleton instance
export const activityScoreCalculator = new ActivityScoreCalculator()

// Default export
export default ActivityScoreCalculator
