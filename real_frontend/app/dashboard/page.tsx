'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Wallet, TrendingUp, Clock, DollarSign, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { connectWallet } from '@/lib/wallet'
import { api } from '@/lib/api'
import { formatAddress, formatCurrency } from '@/lib/utils'
import RevealOnView from '@/components/reveal-on-view'
import DotGridShader from '@/components/DotGridShader'

interface Loan {
  id: string
  amount: number
  status: 'pending' | 'approved' | 'active' | 'repaid' | 'defaulted'
  interestRate: number
  duration: number
  monthlyPayment: number
  remainingBalance: number
  nextPaymentDate: string
  createdAt: string
}

export default function DashboardPage() {
  const [walletAddress, setWalletAddress] = useState<string>('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loans, setLoans] = useState<Loan[]>([])

  const handleConnectWallet = async () => {
    setIsConnecting(true)
    try {
      const wallet = await connectWallet()
      setWalletAddress(wallet.address || '')
      toast.success('Wallet connected!')
      loadLoans(wallet.address || '')
    } catch (error) {
      toast.error('Failed to connect wallet')
      console.error(error)
    } finally {
      setIsConnecting(false)
    }
  }

  const loadLoans = async (address: string) => {
    setIsLoading(true)
    try {
      const data = await api.getLoans(address)
      setLoans(data)
    } catch (error) {
      // Mock data for demo
      setLoans([
        {
          id: '0x123...abc',
          amount: 5000,
          status: 'active',
          interestRate: 5,
          duration: 12,
          monthlyPayment: 437.5,
          remainingBalance: 3500,
          nextPaymentDate: '2025-11-13',
          createdAt: '2025-01-13',
        },
        {
          id: '0x456...def',
          amount: 2000,
          status: 'pending',
          interestRate: 4.5,
          duration: 6,
          monthlyPayment: 348.33,
          remainingBalance: 2000,
          nextPaymentDate: '2025-11-13',
          createdAt: '2025-10-10',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const totalBorrowed = loans.reduce((sum, loan) => sum + loan.amount, 0)
  const totalRemaining = loans.reduce((sum, loan) => sum + loan.remainingBalance, 0)
  const activeLoans = loans.filter(l => l.status === 'active').length

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-500/20 text-green-500 border-green-500/30'
      case 'active': return 'bg-blue-500/20 text-blue-500 border-blue-500/30'
      case 'pending': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30'
      case 'repaid': return 'bg-purple-500/20 text-purple-500 border-purple-500/30'
      case 'defaulted': return 'bg-red-500/20 text-red-500 border-red-500/30'
      default: return 'bg-gray-500/20 text-gray-500 border-gray-500/30'
    }
  }

  return (
    <main className="bg-neutral-950 text-white min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        {/* Header */}
        <div className="mb-12">
          <Button asChild variant="ghost" className="mb-4 text-white/70 hover:text-white">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Link>
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-black tracking-tight mb-2">Dashboard</h1>
              <p className="text-white/70">Manage your loans and track repayments</p>
            </div>
            {!walletAddress && (
              <Button 
                onClick={handleConnectWallet}
                disabled={isConnecting}
                className="bg-white text-black hover:bg-white/90"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wallet className="mr-2 h-4 w-4" />
                    Connect Wallet
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {walletAddress ? (
          <>
            {/* Wallet Info */}
            <RevealOnView>
              <div className="mb-6 p-4 rounded-lg bg-neutral-900/60 border border-white/10">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Connected:</span>
                  <span className="text-sm font-mono text-white/70">{formatAddress(walletAddress)}</span>
                </div>
              </div>
            </RevealOnView>

            {/* Stats Grid */}
            <div className="grid gap-6 md:grid-cols-3 mb-8">
              <RevealOnView>
                <Card className="bg-neutral-900/60 border-white/10 relative overflow-hidden">
                  <div className="pointer-events-none absolute inset-0 opacity-5">
                    <DotGridShader />
                  </div>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-white/70">Total Borrowed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-purple-500" />
                      </div>
                      <div className="text-3xl font-bold">{formatCurrency(totalBorrowed)}</div>
                    </div>
                  </CardContent>
                </Card>
              </RevealOnView>

              <RevealOnView>
                <Card className="bg-neutral-900/60 border-white/10 relative overflow-hidden">
                  <div className="pointer-events-none absolute inset-0 opacity-5">
                    <DotGridShader />
                  </div>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-white/70">Remaining Balance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-blue-500" />
                      </div>
                      <div className="text-3xl font-bold">{formatCurrency(totalRemaining)}</div>
                    </div>
                  </CardContent>
                </Card>
              </RevealOnView>

              <RevealOnView>
                <Card className="bg-neutral-900/60 border-white/10 relative overflow-hidden">
                  <div className="pointer-events-none absolute inset-0 opacity-5">
                    <DotGridShader />
                  </div>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-white/70">Active Loans</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      </div>
                      <div className="text-3xl font-bold">{activeLoans}</div>
                    </div>
                  </CardContent>
                </Card>
              </RevealOnView>
            </div>

            {/* Loans List */}
            <RevealOnView>
              <Card className="bg-neutral-900/60 border-white/10">
                <CardHeader>
                  <CardTitle>Your Loans</CardTitle>
                  <CardDescription>All your loan requests and active loans</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="py-12 text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-white/50" />
                      <p className="text-white/50">Loading loans...</p>
                    </div>
                  ) : loans.length === 0 ? (
                    <div className="py-12 text-center">
                      <AlertCircle className="h-12 w-12 mx-auto mb-4 text-white/20" />
                      <p className="text-white/50 mb-4">No loans found</p>
                      <Button asChild className="bg-white text-black hover:bg-white/90">
                        <Link href="/wallet-analysis">Request a Loan</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {loans.map((loan) => (
                        <div 
                          key={loan.id}
                          className="p-4 rounded-lg bg-neutral-800/50 border border-white/10 hover:border-white/20 transition-all"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold">{formatCurrency(loan.amount)} Loan</h3>
                                <Badge className={getStatusColor(loan.status)}>
                                  {loan.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-white/50 font-mono">{loan.id}</p>
                            </div>
                            <Button variant="outline" size="sm" className="border-white/20">
                              View Details
                            </Button>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-white/50 text-xs mb-1">Interest Rate</p>
                              <p className="font-medium">{loan.interestRate}%</p>
                            </div>
                            <div>
                              <p className="text-white/50 text-xs mb-1">Duration</p>
                              <p className="font-medium">{loan.duration} months</p>
                            </div>
                            <div>
                              <p className="text-white/50 text-xs mb-1">Monthly Payment</p>
                              <p className="font-medium">{formatCurrency(loan.monthlyPayment)}</p>
                            </div>
                            <div>
                              <p className="text-white/50 text-xs mb-1">Remaining</p>
                              <p className="font-medium text-purple-500">{formatCurrency(loan.remainingBalance)}</p>
                            </div>
                          </div>

                          {loan.status === 'active' && (
                            <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2 text-sm">
                              <Clock className="h-4 w-4 text-white/50" />
                              <span className="text-white/70">Next payment due: {loan.nextPaymentDate}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </RevealOnView>
          </>
        ) : (
          <RevealOnView>
            <Card className="bg-neutral-900/60 border-white/10 max-w-2xl mx-auto">
              <CardContent className="py-16 text-center">
                <Wallet className="h-16 w-16 text-white/20 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
                <p className="text-white/70 mb-6">
                  Connect your StarkNet wallet to view your loans and dashboard
                </p>
                <Button 
                  onClick={handleConnectWallet}
                  disabled={isConnecting}
                  className="bg-white text-black hover:bg-white/90"
                  size="lg"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Wallet className="mr-2 h-4 w-4" />
                      Connect Wallet
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </RevealOnView>
        )}
      </div>
    </main>
  )
}
