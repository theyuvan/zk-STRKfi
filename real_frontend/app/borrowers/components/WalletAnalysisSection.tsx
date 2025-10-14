import { CheckCircle, XCircle, Shield } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatAddress } from '@/lib/utils'
import { WalletAnalysis } from '../page'

interface WalletAnalysisSectionProps {
  walletAddress: string
  analysis: WalletAnalysis
}

export default function WalletAnalysisSection({ walletAddress, analysis }: WalletAnalysisSectionProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400'
    if (score >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-500/20 border-green-500/30'
    if (score >= 60) return 'bg-yellow-500/20 border-yellow-500/30'
    return 'bg-red-500/20 border-red-500/30'
  }

  return (
    <>
      <div className="mb-6 p-4 rounded-lg bg-neutral-900/60 border border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-white">Connected:</span>
              <span className="text-sm font-mono text-white/80">{formatAddress(walletAddress)}</span>
            </div>
            <Badge className={`${getScoreBgColor(analysis.eligibilityScore)} ${getScoreColor(analysis.eligibilityScore)}`}>
              Score: {analysis.eligibilityScore}/100
            </Badge>
          </div>
      </div>

      <Card className="bg-neutral-900/80 border-white/10 p-6 mb-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-white">
            <Shield className="w-6 h-6 text-purple-500" />
            Eligibility Analysis
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-neutral-800/50 border border-white/10">
              <p className="text-sm text-white/60 mb-1">Current Balance</p>
              <p className="text-2xl font-bold text-white">{analysis.balance} ETH</p>
              <div className="flex items-center gap-1 mt-2">
                {analysis.criteria.balanceCheck ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className="text-xs text-white/60">≥ 2x loan amount</span>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-neutral-800/50 border border-white/10">
              <p className="text-sm text-white/60 mb-1">Transactions</p>
              <p className="text-2xl font-bold text-white">{analysis.transactions}</p>
              <div className="flex items-center gap-1 mt-2">
                {analysis.criteria.transactionCheck ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className="text-xs text-white/60">≥ 5 transactions</span>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-neutral-800/50 border border-white/10">
              <p className="text-sm text-white/60 mb-1">Total Received</p>
              <p className="text-2xl font-bold text-white">{analysis.totalReceived} ETH</p>
              <div className="flex items-center gap-1 mt-2">
                {analysis.criteria.inflowCheck ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className="text-xs text-white/60">≥ 3x loan amount</span>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-neutral-800/50 border border-white/10">
              <p className="text-sm text-white/60 mb-1">Account Age</p>
              <p className="text-2xl font-bold text-white">{analysis.accountAge} days</p>
              <div className="flex items-center gap-1 mt-2">
                {analysis.criteria.ageCheck ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className="text-xs text-white/60">≥ 30 days</span>
              </div>
            </div>
          </div>

          {analysis.isEligible ? (
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <p className="text-green-400 font-semibold">You are ELIGIBLE for a loan! 🎉</p>
              </div>
              <p className="text-sm text-white/70 mt-2">
                All criteria met. You can now browse loan providers and request a loan.
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-500" />
                <p className="text-red-400 font-semibold">Not eligible at this time</p>
              </div>
              <p className="text-sm text-white/70 mt-2">
                Please ensure you meet all the criteria to request a loan.
              </p>
            </div>
          )}
      </Card>
    </>
  )
}
