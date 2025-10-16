import { DollarSign } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import RevealOnView from '@/components/reveal-on-view'
import { formatCurrency } from '@/lib/utils'

interface LoanConfigSectionProps {
  loanAmount: number
  setLoanAmount: (amount: number) => void
  loanDuration: number
  setLoanDuration: (duration: number) => void
}

export default function LoanConfigSection({
  loanAmount,
  setLoanAmount,
  loanDuration,
  setLoanDuration
}: LoanConfigSectionProps) {
  return (
    <RevealOnView>
      <Card className="bg-neutral-900/80 border-white/10 p-6 mb-8">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-white">
          <DollarSign className="w-6 h-6 text-purple-500" />
          Configure Your Loan
        </h2>

        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-white/80">Loan Amount</label>
              <span className="text-lg font-bold text-purple-400">{formatCurrency(loanAmount)}</span>
            </div>
            <Slider
              value={[loanAmount]}
              onValueChange={(value) => setLoanAmount(value[0])}
              min={500}
              max={10000}
              step={100}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-white/50 mt-1">
              <span>$500</span>
              <span>$10,000</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-white/80">Loan Duration</label>
              <span className="text-lg font-bold text-purple-400">{loanDuration} months</span>
            </div>
            <Slider
              value={[loanDuration]}
              onValueChange={(value) => setLoanDuration(value[0])}
              min={3}
              max={36}
              step={3}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-white/50 mt-1">
              <span>3 months</span>
              <span>36 months</span>
            </div>
          </div>
        </div>
      </Card>
    </RevealOnView>
  )
}
