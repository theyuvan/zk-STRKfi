import { Zap, Shield } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { LoanProvider } from '../page'

interface LoanSummarySectionProps {
  selectedProvider: LoanProvider
  loanAmount: number
  loanDuration: number
  onBack: () => void
  onRequestLoan: () => void
}

export default function LoanSummarySection({
  selectedProvider,
  loanAmount,
  loanDuration,
  onBack,
  onRequestLoan
}: LoanSummarySectionProps) {
  const calculateInterestRate = (provider: LoanProvider) => {
    const baseRate = provider.minInterestRate
    const amountFactor = (loanAmount / provider.maxLoanAmount) * 2
    const durationFactor = (loanDuration / 24) * 1
    return Math.min(baseRate + amountFactor + durationFactor, provider.maxInterestRate)
  }

  const interestRate = calculateInterestRate(selectedProvider)
  const monthlyPayment = (loanAmount * (1 + interestRate / 100)) / loanDuration

  return (
    <Card className="bg-neutral-900/80 border-white/10 p-6">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-white">
          <Zap className="w-6 h-6 text-purple-500" />
          Loan Summary
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="text-lg font-semibold mb-4 text-white">Loan Details</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-white/60">Loan Amount</span>
                <span className="font-semibold text-white">{formatCurrency(loanAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Duration</span>
                <span className="font-semibold text-white">{loanDuration} months</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Interest Rate</span>
                <span className="font-semibold text-purple-400">{interestRate.toFixed(2)}% APR</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Monthly Payment</span>
                <span className="font-semibold text-white">{formatCurrency(monthlyPayment)}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4 text-white">Provider Details</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-white/60">Provider</span>
                <span className="font-semibold text-white">{selectedProvider.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Rating</span>
                <span className="font-semibold text-yellow-400">★ {selectedProvider.rating}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Response Time</span>
                <span className="font-semibold text-green-400">{selectedProvider.responseTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Total Lent</span>
                <span className="font-semibold text-white">{formatCurrency(selectedProvider.totalLent)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30 mb-6">
          <div className="flex items-start gap-2">
            <Shield className="w-5 h-5 text-purple-400 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-purple-400 mb-1">Zero-Knowledge Proof Required</p>
              <p className="text-xs text-white/70">
                Your eligibility will be verified using ZK proofs without revealing your personal data. 
                The loan will be transferred instantly upon verification.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 border-white/10 bg-white text-black hover:bg-white/90"
            onClick={onBack}
          >
            Back to Providers
          </Button>
          <Button
            className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            onClick={onRequestLoan}
          >
            <Shield className="w-4 h-4 mr-2" />
            Submit ZK Proof & Request Loan
          </Button>
        </div>
    </Card>
  )
}
