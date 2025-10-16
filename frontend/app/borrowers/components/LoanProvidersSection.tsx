import { useState, useEffect } from 'react'
import { Users, ArrowRight, Loader2, AlertCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatAddress } from '@/lib/utils'
import { loanApi } from '@/lib/services/api'

interface LoanProvidersSectionProps {
  loanAmount: number
  loanDuration: number
  onSelectProvider: (provider: any) => void
}

export default function LoanProvidersSection({
  loanAmount,
  loanDuration,
  onSelectProvider
}: LoanProvidersSectionProps) {
  const [loans, setLoans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLoans()
  }, [])

  const fetchLoans = async () => {
    setLoading(true)
    try {
      console.log('📊 Fetching available loans from blockchain...')
      const availableLoans = await loanApi.getAvailableLoans()
      console.log('✅ Fetched loans:', availableLoans)
      setLoans(availableLoans)
    } catch (error) {
      console.error('❌ Failed to fetch loans:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatStrkAmount = (amount: string) => {
    const amountBigInt = BigInt(amount)
    const decimals = 18
    const formatted = Number(amountBigInt) / Math.pow(10, decimals)
    return formatted.toFixed(2)
  }

  const calculateDaysFromSeconds = (seconds: number) => {
    return Math.floor(seconds / 86400)
  }

  return (
    <Card className="bg-neutral-900/80 border-white/10 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
            <Users className="w-6 h-6 text-purple-500" />
            Available Loan Offers
          </h2>
          <Button 
            onClick={fetchLoans} 
            disabled={loading}
            variant="outline"
            size="sm"
            className="border-white/10"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-purple-500" />
            <p className="text-white/60">Loading loans from blockchain...</p>
          </div>
        ) : loans.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
            <p className="text-white/60">No active loans available</p>
            <Button 
              onClick={fetchLoans}
              className="mt-4"
              variant="outline"
            >
              Refresh
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loans.map((loan) => {
              const loanAmountFormatted = formatStrkAmount(loan.loanAmount)
              const repaymentDays = calculateDaysFromSeconds(loan.repaymentPeriod)
              const slotsAvailable = loan.numberOfBorrowers - loan.currentBorrowers
              const isFull = slotsAvailable <= 0

              return (
                <Card 
                  key={loan.loanId} 
                  className={`bg-neutral-800/50 border-white/10 p-6 hover:border-purple-500/50 transition-all ${
                    isFull ? 'opacity-50' : 'cursor-pointer'
                  }`}
                  onClick={() => !isFull && onSelectProvider(loan)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white">Loan #{loan.loanId}</h3>
                      <p className="text-xs text-white/60 font-mono">{formatAddress(loan.lender)}</p>
                    </div>
                    <Badge className={
                      isFull 
                        ? 'bg-red-500/20 text-red-400 border-red-500/30'
                        : loan.isActive
                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                        : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                    }>
                      {isFull ? 'FULL' : loan.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-white/60">Loan Amount</span>
                      <span className="text-sm font-bold text-white">{loanAmountFormatted} STRK</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-sm text-white/60">Interest Rate</span>
                      <span className="text-sm font-bold text-green-400">{loan.interestRate}% APR</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-sm text-white/60">Duration</span>
                      <span className="text-sm font-bold text-white">{repaymentDays} days</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-sm text-white/60">Available Slots</span>
                      <span className="text-sm font-bold text-white">
                        {slotsAvailable}/{loan.numberOfBorrowers}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-sm text-white/60">Min Score Required</span>
                      <span className="text-sm font-bold text-purple-400">{loan.minActivityScore}</span>
                    </div>
                  </div>

                  <Button 
                    className="w-full mt-4 bg-purple-600 hover:bg-purple-700"
                    disabled={isFull || !loan.isActive}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectProvider(loan)
                    }}
                  >
                    {isFull ? 'Full' : 'Apply for Loan'} <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Card>
              )
            })}
          </div>
        )}
    </Card>
  )
}
