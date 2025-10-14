'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Wallet, TrendingUp, DollarSign, Users, Calendar, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import RevealOnView from '@/components/reveal-on-view'
import { formatCurrency } from '@/lib/utils'

interface LenderStats {
  totalLent: number
  activeLoans: number
  totalEarnings: number
  averageReturn: number
  upcomingPayments: number
}

export default function LendersPage() {
  // Mock data - replace with real data from blockchain/API
  const [stats] = useState<LenderStats>({
    totalLent: 125000,
    activeLoans: 8,
    totalEarnings: 12450,
    averageReturn: 9.96,
    upcomingPayments: 3
  })

  // Form state for creating loan offers
  const [amount, setAmount] = useState('')
  const [maxBorrowers, setMaxBorrowers] = useState('')
  const [duration, setDuration] = useState('')
  const [interestRate, setInterestRate] = useState('')

  const handleCreateOffer = () => {
    if (!amount || !maxBorrowers || !duration || !interestRate) {
      alert('Please fill in all fields')
      return
    }

    console.log('Creating loan offer:', {
      amount: parseFloat(amount),
      maxBorrowers: parseInt(maxBorrowers),
      duration: parseInt(duration),
      interestRate: parseFloat(interestRate)
    })

    alert('Loan offer created successfully!')
    
    // Reset form
    setAmount('')
    setMaxBorrowers('')
    setDuration('')
    setInterestRate('')
  }


  return (
    <main className="bg-neutral-950 text-white min-h-screen pt-20">
      {/* Header */}
      <section className="relative z-10 px-4 sm:px-6 lg:px-8 py-8 border-b border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button asChild variant="ghost" size="icon" className="rounded-full">
                <Link href="/">
                  <ArrowLeft className="w-5 h-5" />
                </Link>
              </Button>
              <div>
                <h1 className="text-3xl font-black">Lender Dashboard</h1>
                <p className="text-white/60 mt-1">Manage your loan portfolio</p>
              </div>
            </div>
            <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-full">
              <Wallet className="w-4 h-4 mr-2" />
              Connect Wallet
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Overview */}
      <section className="relative z-10 px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <RevealOnView>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card className="bg-neutral-900/80 border-white/10 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-white/70">Total Lent</p>
                    <p className="text-2xl font-bold text-white">{formatCurrency(stats.totalLent)}</p>
                  </div>
                </div>
              </Card>

              <Card className="bg-neutral-900/80 border-white/10 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-white/70">Active Loans</p>
                    <p className="text-2xl font-bold text-white">{stats.activeLoans}</p>
                  </div>
                </div>
              </Card>

              <Card className="bg-neutral-900/80 border-white/10 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-white/70">Total Earnings</p>
                    <p className="text-2xl font-bold text-white">{formatCurrency(stats.totalEarnings)}</p>
                  </div>
                </div>
              </Card>

              <Card className="bg-neutral-900/80 border-white/10 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-green-500 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-white/70">Avg Return</p>
                    <p className="text-2xl font-bold text-white">{stats.averageReturn}%</p>
                  </div>
                </div>
              </Card>

              <Card className="bg-neutral-900/80 border-white/10 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-yellow-500 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-white/70">Upcoming</p>
                    <p className="text-2xl font-bold text-white">{stats.upcomingPayments}</p>
                  </div>
                </div>
              </Card>
            </div>
          </RevealOnView>
        </div>
      </section>

      {/* Create Loan Offer Form */}
      <section className="relative z-10 px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-3xl mx-auto">
          <Card className="bg-neutral-900/80 border-white/10 p-8">
            <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2">
              <Plus className="w-6 h-6 text-purple-500" />
              Create Loan Offer
            </h2>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-white/90">STRK Tokens</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="Enter amount in STRK"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="bg-neutral-800 border-white/10 text-white placeholder:text-white/40"
                />
                <p className="text-xs text-white/60">Total amount of STRK tokens to lend</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="borrowers" className="text-white/90">Maximum Borrowers</Label>
                <Input
                  id="borrowers"
                  type="number"
                  placeholder="Enter number of borrowers"
                  value={maxBorrowers}
                  onChange={(e) => setMaxBorrowers(e.target.value)}
                  className="bg-neutral-800 border-white/10 text-white placeholder:text-white/40"
                />
                <p className="text-xs text-white/60">Maximum number of borrowers allowed</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration" className="text-white/90">Duration (seconds)</Label>
                <Input
                  id="duration"
                  type="number"
                  placeholder="Enter duration in seconds"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="bg-neutral-800 border-white/10 text-white placeholder:text-white/40"
                />
                <p className="text-xs text-white/60">Loan duration in seconds (e.g., 2592000 = 30 days)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="interest" className="text-white/90">Interest Rate (%)</Label>
                <Input
                  id="interest"
                  type="number"
                  step="0.1"
                  placeholder="Enter interest rate"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  className="bg-neutral-800 border-white/10 text-white placeholder:text-white/40"
                />
                <p className="text-xs text-white/60">Annual interest rate percentage</p>
              </div>

              <Button
                onClick={handleCreateOffer}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-6"
                size="lg"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create Loan Offer
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </main>
  )
}
