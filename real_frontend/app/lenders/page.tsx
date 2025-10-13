'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Wallet, TrendingUp, Clock, DollarSign, Users, Calendar, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import RevealOnView from '@/components/reveal-on-view'
import { formatCurrency, formatAddress } from '@/lib/utils'

interface Loan {
  id: string
  borrowerAddress: string
  borrowerName: string
  amount: number
  interestRate: number
  duration: number // in days
  startDate: string
  nextPaymentDate: string
  nextPaymentAmount: number
  totalPaid: number
  totalRemaining: number
  status: 'active' | 'overdue' | 'completed'
  creditScore: number
}

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

  const [loans] = useState<Loan[]>([
    {
      id: 'LOAN-001',
      borrowerAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      borrowerName: 'Anonymous Borrower #1',
      amount: 25000,
      interestRate: 8.5,
      duration: 365,
      startDate: '2025-01-15',
      nextPaymentDate: '2025-11-15',
      nextPaymentAmount: 2187.50,
      totalPaid: 6562.50,
      totalRemaining: 19687.50,
      status: 'active',
      creditScore: 750
    },
    {
      id: 'LOAN-002',
      borrowerAddress: '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
      borrowerName: 'Anonymous Borrower #2',
      amount: 15000,
      interestRate: 10.0,
      duration: 180,
      startDate: '2025-02-01',
      nextPaymentDate: '2025-10-20',
      nextPaymentAmount: 1500,
      totalPaid: 4500,
      totalRemaining: 11250,
      status: 'active',
      creditScore: 680
    },
    {
      id: 'LOAN-003',
      borrowerAddress: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
      borrowerName: 'Anonymous Borrower #3',
      amount: 30000,
      interestRate: 7.5,
      duration: 365,
      startDate: '2024-12-01',
      nextPaymentDate: '2025-10-13',
      nextPaymentAmount: 2625,
      totalPaid: 10500,
      totalRemaining: 21750,
      status: 'overdue',
      creditScore: 720
    },
    {
      id: 'LOAN-004',
      borrowerAddress: '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
      borrowerName: 'Anonymous Borrower #4',
      amount: 20000,
      interestRate: 9.0,
      duration: 270,
      startDate: '2025-03-10',
      nextPaymentDate: '2025-11-10',
      nextPaymentAmount: 1800,
      totalPaid: 3600,
      totalRemaining: 16200,
      status: 'active',
      creditScore: 700
    },
    {
      id: 'LOAN-005',
      borrowerAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
      borrowerName: 'Anonymous Borrower #5',
      amount: 10000,
      interestRate: 12.0,
      duration: 90,
      startDate: '2024-08-01',
      nextPaymentDate: '2024-10-31',
      nextPaymentAmount: 0,
      totalPaid: 11200,
      totalRemaining: 0,
      status: 'completed',
      creditScore: 780
    }
  ])

  const activeLoans = loans.filter(l => l.status === 'active')
  const overdueLoans = loans.filter(l => l.status === 'overdue')
  const completedLoans = loans.filter(l => l.status === 'completed')

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-500'
      case 'overdue': return 'text-red-500'
      case 'completed': return 'text-blue-500'
      default: return 'text-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Clock className="w-4 h-4" />
      case 'overdue': return <AlertCircle className="w-4 h-4" />
      case 'completed': return <CheckCircle className="w-4 h-4" />
      default: return null
    }
  }

  return (
    <main className="bg-neutral-950 text-white min-h-screen">
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

      {/* Loans Table */}
      <section className="relative z-10 px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <RevealOnView>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="bg-neutral-900/60 border border-white/10 mb-6">
                <TabsTrigger value="all">All Loans ({loans.length})</TabsTrigger>
                <TabsTrigger value="active">Active ({activeLoans.length})</TabsTrigger>
                <TabsTrigger value="overdue">Overdue ({overdueLoans.length})</TabsTrigger>
                <TabsTrigger value="completed">Completed ({completedLoans.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="all">
                <LoansList loans={loans} getStatusColor={getStatusColor} getStatusIcon={getStatusIcon} />
              </TabsContent>

              <TabsContent value="active">
                <LoansList loans={activeLoans} getStatusColor={getStatusColor} getStatusIcon={getStatusIcon} />
              </TabsContent>

              <TabsContent value="overdue">
                <LoansList loans={overdueLoans} getStatusColor={getStatusColor} getStatusIcon={getStatusIcon} />
              </TabsContent>

              <TabsContent value="completed">
                <LoansList loans={completedLoans} getStatusColor={getStatusColor} getStatusIcon={getStatusIcon} />
              </TabsContent>
            </Tabs>
          </RevealOnView>
        </div>
      </section>
    </main>
  )
}

interface LoansListProps {
  loans: Loan[]
  getStatusColor: (status: string) => string
  getStatusIcon: (status: string) => React.ReactNode
}

function LoansList({ loans, getStatusColor, getStatusIcon }: LoansListProps) {
  if (loans.length === 0) {
    return (
      <Card className="bg-neutral-900/60 border-white/10 p-12 text-center">
        <p className="text-white/60">No loans found in this category</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {loans.map((loan) => (
        <Card key={loan.id} className="bg-neutral-900/80 border-white/10 p-6 hover:border-white/20 transition-all">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Borrower Info */}
            <div className="lg:col-span-3">
              <p className="text-sm text-white/70 mb-1">Borrower</p>
              <p className="font-semibold text-white">{loan.borrowerName}</p>
              <p className="text-sm text-white/60 font-mono">{formatAddress(loan.borrowerAddress)}</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-400">
                  Credit: {loan.creditScore}
                </div>
              </div>
            </div>

            {/* Loan Details */}
            <div className="lg:col-span-3">
              <p className="text-sm text-white/70 mb-1">Loan Details</p>
              <p className="font-semibold text-xl text-white">{formatCurrency(loan.amount)}</p>
              <p className="text-sm text-white/70">
                {loan.interestRate}% APR • {loan.duration} days
              </p>
              <p className="text-xs text-white/60 mt-1">
                Started: {new Date(loan.startDate).toLocaleDateString()}
              </p>
            </div>

            {/* Payment Info */}
            <div className="lg:col-span-3">
              <p className="text-sm text-white/70 mb-1">Payment Status</p>
              <p className="font-semibold text-green-400">{formatCurrency(loan.totalPaid)} paid</p>
              <p className="text-sm text-white/70">{formatCurrency(loan.totalRemaining)} remaining</p>
              {loan.status !== 'completed' && (
                <p className="text-xs text-white/60 mt-1">
                  Next: {new Date(loan.nextPaymentDate).toLocaleDateString()}
                </p>
              )}
            </div>

            {/* Next Payment & Status */}
            <div className="lg:col-span-3 flex flex-col justify-between">
              <div>
                <p className="text-sm text-white/70 mb-1">Next Payment</p>
                {loan.status !== 'completed' ? (
                  <>
                    <p className="font-semibold text-lg text-white">{formatCurrency(loan.nextPaymentAmount)}</p>
                    <p className="text-xs text-white/60">
                      Due: {new Date(loan.nextPaymentDate).toLocaleDateString()}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-blue-400">Loan Completed</p>
                )}
              </div>
              <div className={`flex items-center gap-2 mt-3 ${getStatusColor(loan.status)}`}>
                {getStatusIcon(loan.status)}
                <span className="text-sm font-medium capitalize">{loan.status}</span>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all"
                style={{ width: `${(loan.totalPaid / loan.amount) * 100}%` }}
              />
            </div>
            <p className="text-xs text-white/70 mt-1">
              {((loan.totalPaid / loan.amount) * 100).toFixed(1)}% repaid
            </p>
          </div>
        </Card>
      ))}
    </div>
  )
}
