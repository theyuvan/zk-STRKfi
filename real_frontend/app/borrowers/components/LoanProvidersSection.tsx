import { Users, ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatAddress } from '@/lib/utils'
import { LoanProvider } from '../page'

interface LoanProvidersSectionProps {
  loanAmount: number
  loanDuration: number
  onSelectProvider: (provider: LoanProvider) => void
}

const loanProviders: LoanProvider[] = [
  {
    id: 'LP-001',
    name: 'DeFi Capital',
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    minInterestRate: 5.5,
    maxInterestRate: 8.5,
    maxLoanAmount: 50000,
    totalLent: 250000,
    activeLoans: 12,
    rating: 4.8,
    responseTime: '< 5 min'
  },
  {
    id: 'LP-002',
    name: 'Crypto Lend Pro',
    address: '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
    minInterestRate: 6.0,
    maxInterestRate: 9.0,
    maxLoanAmount: 30000,
    totalLent: 180000,
    activeLoans: 8,
    rating: 4.6,
    responseTime: '< 10 min'
  },
  {
    id: 'LP-003',
    name: 'Blockchain Finance',
    address: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    minInterestRate: 5.0,
    maxInterestRate: 7.5,
    maxLoanAmount: 75000,
    totalLent: 500000,
    activeLoans: 20,
    rating: 4.9,
    responseTime: '< 3 min'
  },
  {
    id: 'LP-004',
    name: 'StarkNet Loans',
    address: '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
    minInterestRate: 7.0,
    maxInterestRate: 10.0,
    maxLoanAmount: 25000,
    totalLent: 120000,
    activeLoans: 6,
    rating: 4.5,
    responseTime: '< 15 min'
  }
]

export default function LoanProvidersSection({
  loanAmount,
  loanDuration,
  onSelectProvider
}: LoanProvidersSectionProps) {
  const calculateInterestRate = (provider: LoanProvider) => {
    const baseRate = provider.minInterestRate
    const amountFactor = (loanAmount / provider.maxLoanAmount) * 2
    const durationFactor = (loanDuration / 24) * 1
    return Math.min(baseRate + amountFactor + durationFactor, provider.maxInterestRate)
  }

  return (
    <Card className="bg-neutral-900/80 border-white/10 p-6">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-white">
          <Users className="w-6 h-6 text-purple-500" />
          Available Loan Providers
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loanProviders.map((provider) => {
            const estimatedRate = calculateInterestRate(provider)
            const canAfford = loanAmount <= provider.maxLoanAmount

            return (
              <Card 
                key={provider.id} 
                className={`bg-neutral-800/50 border-white/10 p-6 hover:border-purple-500/50 transition-all ${
                  !canAfford ? 'opacity-50' : 'cursor-pointer'
                }`}
                onClick={() => canAfford && onSelectProvider(provider)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">{provider.name}</h3>
                    <p className="text-xs text-white/60 font-mono">{formatAddress(provider.address)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-yellow-400">★</span>
                    <span className="text-sm font-semibold text-white">{provider.rating}</span>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Interest Rate</span>
                    <span className="font-semibold text-purple-400">{estimatedRate.toFixed(2)}% APR</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Max Loan</span>
                    <span className="font-semibold text-white">{formatCurrency(provider.maxLoanAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Response Time</span>
                    <span className="font-semibold text-green-400">{provider.responseTime}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Active Loans</span>
                    <span className="font-semibold text-white">{provider.activeLoans}</span>
                  </div>
                </div>

                {canAfford ? (
                  <Button className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                    Select Provider
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button className="w-full" disabled>
                    Amount exceeds limit
                  </Button>
                )}
              </Card>
            )
          })}
        </div>
    </Card>
  )
}
