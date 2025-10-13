'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, FileCheck, Loader2, CheckCircle, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import RevealOnView from '@/components/reveal-on-view'
import DotGridShader from '@/components/DotGridShader'

export default function LoanRequestPage() {
  const [walletAddress, setWalletAddress] = useState<string>('')
  const [loanAmount, setLoanAmount] = useState<string>('')
  const [interestRate, setInterestRate] = useState<string>('5')
  const [duration, setDuration] = useState<string>('12')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [requestId, setRequestId] = useState<string>('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!walletAddress || !loanAmount) {
      toast.error('Please fill in all required fields')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await api.createLoanRequest({
        walletAddress,
        loanAmount: parseFloat(loanAmount),
        walletProof: 'mock-proof-hash', // This would come from wallet analysis
      })
      
      setRequestId(result.id || 'mock-request-id')
      toast.success('Loan request submitted successfully!')
    } catch (error) {
      toast.error('Failed to submit loan request')
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const monthlyPayment = loanAmount && interestRate && duration
    ? (parseFloat(loanAmount) * (1 + parseFloat(interestRate) / 100)) / parseFloat(duration)
    : 0

  return (
    <main className="bg-neutral-950 text-white min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        {/* Header */}
        <div className="mb-12">
          <Button asChild variant="ghost" className="mb-4 text-white/70 hover:text-white">
            <Link href="/wallet-analysis">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Analysis
            </Link>
          </Button>
          <h1 className="text-4xl font-black tracking-tight mb-2">Loan Request</h1>
          <p className="text-white/70">Submit your privacy-preserving loan application</p>
        </div>

        {!requestId ? (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left: Form */}
            <div className="lg:col-span-2">
              <RevealOnView>
                <Card className="bg-neutral-900/60 border-white/10">
                  <CardHeader>
                    <CardTitle>Loan Application</CardTitle>
                    <CardDescription>Enter your loan details</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="walletAddress">Wallet Address</Label>
                        <Input
                          id="walletAddress"
                          placeholder="0x..."
                          value={walletAddress}
                          onChange={(e) => setWalletAddress(e.target.value)}
                          className="bg-neutral-800 border-white/10"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="loanAmount">Loan Amount (USD)</Label>
                        <Input
                          id="loanAmount"
                          type="number"
                          placeholder="5000"
                          value={loanAmount}
                          onChange={(e) => setLoanAmount(e.target.value)}
                          className="bg-neutral-800 border-white/10"
                          required
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="interestRate">Interest Rate (%)</Label>
                          <Input
                            id="interestRate"
                            type="number"
                            step="0.1"
                            value={interestRate}
                            onChange={(e) => setInterestRate(e.target.value)}
                            className="bg-neutral-800 border-white/10"
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="duration">Duration (months)</Label>
                          <Input
                            id="duration"
                            type="number"
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                            className="bg-neutral-800 border-white/10"
                            required
                          />
                        </div>
                      </div>

                      <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                        <div className="flex items-start gap-3">
                          <Shield className="h-5 w-5 text-purple-500 mt-0.5" />
                          <div>
                            <h4 className="font-semibold mb-1 text-purple-500">Privacy Protected</h4>
                            <p className="text-sm text-white/70">
                              Your loan request includes a zero-knowledge proof. Lenders can verify your 
                              creditworthiness without seeing your financial details.
                            </p>
                          </div>
                        </div>
                      </div>

                      <Button 
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-white text-black hover:bg-white/90"
                        size="lg"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <FileCheck className="mr-2 h-4 w-4" />
                            Submit Loan Request
                          </>
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </RevealOnView>
            </div>

            {/* Right: Summary */}
            <div className="space-y-6">
              <RevealOnView>
                <Card className="bg-neutral-900/60 border-white/10 relative overflow-hidden">
                  <div className="pointer-events-none absolute inset-0 opacity-5">
                    <DotGridShader />
                  </div>
                  <CardHeader>
                    <CardTitle>Loan Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-xs text-white/50 mb-1">Requested Amount</p>
                      <p className="text-2xl font-bold">
                        {loanAmount ? formatCurrency(parseFloat(loanAmount)) : '$0'}
                      </p>
                    </div>

                    <div className="h-px bg-white/10" />

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-white/70">Interest Rate</span>
                        <span className="font-medium">{interestRate}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Duration</span>
                        <span className="font-medium">{duration} months</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Monthly Payment</span>
                        <span className="font-medium">{formatCurrency(monthlyPayment)}</span>
                      </div>
                    </div>

                    <div className="h-px bg-white/10" />

                    <div>
                      <p className="text-xs text-white/50 mb-1">Total Repayment</p>
                      <p className="text-xl font-bold text-purple-500">
                        {loanAmount && interestRate 
                          ? formatCurrency(parseFloat(loanAmount) * (1 + parseFloat(interestRate) / 100))
                          : '$0'
                        }
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </RevealOnView>

              <RevealOnView>
                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <h4 className="font-semibold mb-2 text-sm">What happens next?</h4>
                  <ol className="text-xs text-white/70 space-y-2">
                    <li>1. Your request is posted on-chain</li>
                    <li>2. Lenders review your ZK proof</li>
                    <li>3. Lender approves and funds escrow</li>
                    <li>4. Funds transferred to your wallet</li>
                  </ol>
                </div>
              </RevealOnView>
            </div>
          </div>
        ) : (
          <RevealOnView>
            <Card className="bg-neutral-900/60 border-white/10 max-w-2xl mx-auto">
              <CardContent className="py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
                <h2 className="text-3xl font-bold mb-2">Request Submitted!</h2>
                <p className="text-white/70 mb-6">
                  Your loan request has been submitted to the StarkNet network
                </p>

                <div className="p-4 rounded-lg bg-neutral-800 border border-white/10 mb-6">
                  <p className="text-xs text-white/50 mb-1">Request ID</p>
                  <p className="text-sm font-mono">{requestId}</p>
                </div>

                <div className="flex gap-3 justify-center">
                  <Button asChild variant="outline" className="border-white/20">
                    <Link href="/dashboard">View Dashboard</Link>
                  </Button>
                  <Button asChild className="bg-white text-black hover:bg-white/90">
                    <Link href="/">Back to Home</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </RevealOnView>
        )}
      </div>
    </main>
  )
}
