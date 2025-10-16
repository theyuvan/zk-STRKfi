/**
 * Activity Score Calculator for Real Frontend
 * Analyzes wallet activity and calculates eligibility score
 */

import { activityApi } from './api'

export interface ActivityMetrics {
  balance: { value: number; meets: boolean }
  activity: { value: number; meets: boolean }
  inflow: { value: number; meets: boolean }
  age: { value: number; meets: boolean }
  netFlow: { value: number; meets: boolean }
}

export interface ActivityAnalysis {
  eligible: boolean
  score: number
  metrics: ActivityMetrics
  rawData?: any
}

/**
 * Analyze wallet activity and calculate eligibility
 */
export async function analyzeWalletActivity(
  walletAddress: string,
  loanAmount: number
): Promise<ActivityAnalysis> {
  try {
    console.log('📊 Analyzing wallet activity...')
    
    // Fetch activity data from backend
    const activityData = await activityApi.getActivityData(walletAddress, 1000)
    
    // Calculate metrics
    const balance = parseFloat(activityData.totalVolumeFormatted) || 0
    const transactionCount = activityData.totalTransactions || 0
    const totalReceived = activityData.receivedTransactions?.reduce(
      (sum: number, tx: any) => sum + parseFloat(tx.value || '0'),
      0
    ) || 0
    const activityScore = activityData.score || 0
    
    // Calculate account age (mock - would need to fetch from blockchain)
    const accountAge = 60 // days
    
    // Calculate net flow
    const totalSent = activityData.sentTransactions?.reduce(
      (sum: number, tx: any) => sum + parseFloat(tx.value || '0'),
      0
    ) || 0
    const netFlow = totalReceived - totalSent
    
    // Check criteria
    const balanceCheck = balance >= loanAmount * 2
    const transactionCheck = transactionCount >= 5
    const inflowCheck = totalReceived >= loanAmount * 3
    const ageCheck = accountAge >= 30
    const netFlowCheck = netFlow > 0
    
    const metrics: ActivityMetrics = {
      balance: { value: balance, meets: balanceCheck },
      activity: { value: transactionCount, meets: transactionCheck },
      inflow: { value: totalReceived, meets: inflowCheck },
      age: { value: accountAge, meets: ageCheck },
      netFlow: { value: netFlow, meets: netFlowCheck }
    }
    
    // Calculate overall score (0-100)
    const criteriaCount = 5
    const metCriteriaCount = [
      balanceCheck,
      transactionCheck,
      inflowCheck,
      ageCheck,
      netFlowCheck
    ].filter(Boolean).length
    
    const calculatedScore = Math.round((metCriteriaCount / criteriaCount) * 100)
    
    // Determine eligibility (need at least 80% criteria met)
    const eligible = calculatedScore >= 80
    
    console.log('✅ Activity analysis complete:', {
      score: calculatedScore,
      eligible
    })
    
    return {
      eligible,
      score: calculatedScore,
      metrics,
      rawData: activityData
    }
  } catch (error) {
    console.error('❌ Activity analysis failed:', error)
    throw error
  }
}

/**
 * Get activity score only (lightweight)
 */
export async function getActivityScore(walletAddress: string): Promise<number> {
  try {
    const score = await activityApi.getActivityScore(walletAddress)
    return score
  } catch (error) {
    console.error('❌ Failed to fetch activity score:', error)
    return 0
  }
}

/**
 * Format activity score for display
 */
export function formatActivityScore(score: number): {
  label: string
  color: string
  bgColor: string
} {
  if (score >= 700) {
    return {
      label: 'Excellent',
      color: 'text-green-400',
      bgColor: 'bg-green-500/20 border-green-500/30'
    }
  } else if (score >= 500) {
    return {
      label: 'Good',
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20 border-yellow-500/30'
    }
  } else if (score >= 300) {
    return {
      label: 'Fair',
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/20 border-orange-500/30'
    }
  } else {
    return {
      label: 'Poor',
      color: 'text-red-400',
      bgColor: 'bg-red-500/20 border-red-500/30'
    }
  }
}

/**
 * Check if wallet meets minimum requirements
 */
export function meetsMinimumRequirements(analysis: ActivityAnalysis): boolean {
  const { metrics } = analysis
  return (
    metrics.balance.meets &&
    metrics.activity.meets &&
    metrics.inflow.meets &&
    metrics.age.meets
  )
}
