/**
 * Updated Borrower Page Component
 * Integrated with backend API
 */

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Wallet, Loader2, CheckCircle, AlertCircle, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useWalletAndLoans } from '@/lib/hooks/useWalletAndLoans'
import { formatAddress } from '@/lib/services/api'
import toast, { Toaster } from 'react-hot-toast'

export default function BorrowersPageNew() {
  const {
    wallet,
    handleConnectStarkNet,
    handleConnectMetaMask,
    handleDisconnect,
    activityData,
    isAnalyzing,
    analyzeActivity,
    zkProof,
    isGeneratingProof,
    generateZKProof,
    identityVerified,
    availableLoans,
    myApplications,
    loading,
    fetchAvailableLoans,
    fetchMyApplications,
    starknetService
  } = useWalletAndLoans()

  const [activeTab, setActiveTab] = useState('analyze')
  const [selectedLoan, setSelectedLoan] = useState<any>(null)

  // Fetch data when wallet connects
  useEffect(() => {
    if (wallet.isConnected) {
      fetchAvailableLoans()
    }
  }, [wallet.isConnected])

  // Fetch applications when ZK proof is ready
  useEffect(() => {
    if (zkProof?.commitment) {
      fetchMyApplications()
    }
  }, [zkProof])

  /**
   * Handle wallet activity analysis
   */
  const handleAnalyze = async () => {
    const data = await analyzeActivity()
    if (data) {
      setActiveTab('proof')
    }
  }

  /**
   * Handle ZK proof generation
   */
  const handleGenerateProof = async () => {
    const proof = await generateZKProof()
    if (proof) {
      setActiveTab('loans')
      await fetchAvailableLoans()
    }
  }

  /**
   * Handle loan application
   */
  const handleApplyForLoan = async (loan: any) => {
    if (!zkProof) {
      toast.error('Please generate ZK proof first')
      return
    }

    if (!wallet.isConnected) {
      toast.error('Please connect your wallet')
      return
    }

    try {
      // Prepare transaction data
      const txData = starknetService.prepareApplyForLoan(
        parseInt(loan.loanId),
        zkProof.commitment,
        zkProof.proofHash,
        zkProof.activityScore
      )

      toast.loading('Please confirm transaction in your wallet...')
      
      // Note: Actual transaction execution would happen here with the connected wallet
      // This is a placeholder - you'll need to integrate with get-starknet
      console.log('Transaction data prepared:', txData)
      
      toast.success('Application submitted! (Demo mode)')
      
      // Refresh applications
      await fetchMyApplications()
    } catch (error: any) {
      console.error('Failed to apply for loan:', error)
      toast.error(error.message || 'Failed to apply for loan')
    }
  }

  return (
    <main className="bg-neutral-950 text-white min-h-screen pt-20">
      <Toaster position="top-right" />

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
                <h1 className="text-3xl font-black">Borrower Portal</h1>
                <p className="text-white/60 mt-1">Get instant loans with zero-knowledge proofs</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {wallet.isConnected ? (
                <>
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    {formatAddress(wallet.address)}
                  </Badge>
                  <Button
                    onClick={handleDisconnect}
                    variant="outline"
                    className="border-white/10 hover:bg-white/5"
                  >
                    Disconnect
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={handleConnectStarkNet}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-full"
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    Connect StarkNet
                  </Button>
                  <Button
                    onClick={handleConnectMetaMask}
                    className="bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-700 hover:to-yellow-700 rounded-full"
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    Connect MetaMask
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="relative z-10 px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          {!wallet.isConnected ? (
            <Card className="bg-neutral-900/80 border-white/10 p-12 text-center">
              <Wallet className="w-16 h-16 mx-auto mb-4 text-purple-500" />
              <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
              <p className="text-white/60 mb-6">
                Connect your StarkNet or Ethereum wallet to get started
              </p>
              <div className="flex justify-center gap-4">
                <Button
                  onClick={handleConnectStarkNet}
                  className="bg-gradient-to-r from-purple-600 to-blue-600"
                >
                  Connect StarkNet
                </Button>
                <Button
                  onClick={handleConnectMetaMask}
                  className="bg-gradient-to-r from-orange-600 to-yellow-600"
                >
                  Connect MetaMask
                </Button>
              </div>
            </Card>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4 mb-8">
                <TabsTrigger value="analyze">1. Analyze</TabsTrigger>
                <TabsTrigger value="proof" disabled={!activityData}>
                  2. ZK Proof
                </TabsTrigger>
                <TabsTrigger value="loans" disabled={!zkProof}>
                  3. Browse Loans
                </TabsTrigger>
                <TabsTrigger value="applications" disabled={!zkProof}>
                  My Applications
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Analyze Activity */}
              <TabsContent value="analyze">
                <Card className="bg-neutral-900/80 border-white/10 p-8">
                  <h2 className="text-2xl font-bold mb-4">Wallet Activity Analysis</h2>
                  <p className="text-white/60 mb-6">
                    Analyze your wallet's on-chain activity to determine loan eligibility
                  </p>

                  {!activityData ? (
                    <Button
                      onClick={handleAnalyze}
                      disabled={isAnalyzing}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        'Analyze Wallet'
                      )}
                    </Button>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 rounded-lg bg-neutral-800/50">
                          <p className="text-sm text-white/60">Activity Score</p>
                          <p className="text-3xl font-bold text-green-400">
                            {activityData.score}
                          </p>
                        </div>
                        <div className="p-4 rounded-lg bg-neutral-800/50">
                          <p className="text-sm text-white/60">Transactions</p>
                          <p className="text-3xl font-bold">{activityData.totalTransactions}</p>
                        </div>
                        <div className="p-4 rounded-lg bg-neutral-800/50">
                          <p className="text-sm text-white/60">Total Volume</p>
                          <p className="text-2xl font-bold">{activityData.totalVolume}</p>
                        </div>
                        <div className="p-4 rounded-lg bg-neutral-800/50">
                          <p className="text-sm text-white/60">Status</p>
                          <p className="text-2xl font-bold text-green-400">✓ Eligible</p>
                        </div>
                      </div>

                      <Button
                        onClick={() => setActiveTab('proof')}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        Continue to ZK Proof
                      </Button>
                    </div>
                  )}
                </Card>
              </TabsContent>

              {/* Tab 2: Generate ZK Proof */}
              <TabsContent value="proof">
                <Card className="bg-neutral-900/80 border-white/10 p-8">
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <Shield className="w-6 h-6 text-purple-500" />
                    Zero-Knowledge Proof
                  </h2>
                  <p className="text-white/60 mb-6">
                    Generate a privacy-preserving proof of your eligibility
                  </p>

                  {!zkProof ? (
                    <Button
                      onClick={handleGenerateProof}
                      disabled={isGeneratingProof}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                    >
                      {isGeneratingProof ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating Proof...
                        </>
                      ) : (
                        'Generate ZK Proof'
                      )}
                    </Button>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="w-5 h-5 text-green-400" />
                          <span className="font-semibold text-green-400">Proof Generated!</span>
                        </div>
                        <div className="space-y-2 text-sm text-white/60">
                          <p>
                            <span className="font-medium">Commitment:</span>{' '}
                            {formatAddress(zkProof.commitment)}
                          </p>
                          <p>
                            <span className="font-medium">Proof Hash:</span>{' '}
                            {formatAddress(zkProof.proofHash)}
                          </p>
                          <p>
                            <span className="font-medium">Activity Score:</span>{' '}
                            {zkProof.activityScore}
                          </p>
                        </div>
                      </div>

                      <Button
                        onClick={() => setActiveTab('loans')}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        Browse Available Loans
                      </Button>
                    </div>
                  )}
                </Card>
              </TabsContent>

              {/* Tab 3: Browse Loans */}
              <TabsContent value="loans">
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold">Available Loans</h2>
                    <Button
                      onClick={fetchAvailableLoans}
                      disabled={loading}
                      variant="outline"
                      size="sm"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
                    </Button>
                  </div>

                  {loading ? (
                    <Card className="bg-neutral-900/80 border-white/10 p-12 text-center">
                      <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-purple-500" />
                      <p className="text-white/60">Loading loans...</p>
                    </Card>
                  ) : availableLoans.length === 0 ? (
                    <Card className="bg-neutral-900/80 border-white/10 p-12 text-center">
                      <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
                      <p className="text-white/60">No loans available at this time</p>
                    </Card>
                  ) : (
                    <div className="grid gap-4">
                      {availableLoans.map((loan) => (
                        <Card
                          key={loan.loanId}
                          className="bg-neutral-900/80 border-white/10 p-6 hover:border-purple-500/50 transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center gap-3">
                                <h3 className="text-xl font-bold">Loan #{loan.loanId}</h3>
                                <Badge className="bg-green-500/20 text-green-400">
                                  {loan.interestRate}% APR
                                </Badge>
                              </div>
                              <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                  <span className="text-white/60">Amount:</span>
                                  <span className="ml-2 font-semibold">{loan.loanAmount} STRK</span>
                                </div>
                                <div>
                                  <span className="text-white/60">Slots:</span>
                                  <span className="ml-2 font-semibold">
                                    {loan.currentBorrowers}/{loan.numberOfBorrowers}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-white/60">Period:</span>
                                  <span className="ml-2 font-semibold">
                                    {Math.floor(loan.repaymentPeriod / 86400)} days
                                  </span>
                                </div>
                              </div>
                            </div>
                            <Button
                              onClick={() => handleApplyForLoan(loan)}
                              disabled={loan.currentBorrowers >= loan.numberOfBorrowers}
                              className="bg-purple-600 hover:bg-purple-700"
                            >
                              Apply Now
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Tab 4: My Applications */}
              <TabsContent value="applications">
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold mb-4">My Applications</h2>

                  {loading ? (
                    <Card className="bg-neutral-900/80 border-white/10 p-12 text-center">
                      <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-purple-500" />
                      <p className="text-white/60">Loading applications...</p>
                    </Card>
                  ) : myApplications.length === 0 ? (
                    <Card className="bg-neutral-900/80 border-white/10 p-12 text-center">
                      <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
                      <p className="text-white/60">No applications yet</p>
                    </Card>
                  ) : (
                    <div className="grid gap-4">
                      {myApplications.map((app) => (
                        <Card
                          key={`${app.loanId}-${app.commitment}`}
                          className="bg-neutral-900/80 border-white/10 p-6"
                        >
                          <div className="flex items-center justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center gap-3">
                                <h3 className="text-xl font-bold">Loan #{app.loanId}</h3>
                                <Badge
                                  className={
                                    app.repaid
                                      ? 'bg-gray-500/20 text-gray-400'
                                      : app.approvalTime > 0
                                      ? 'bg-green-500/20 text-green-400'
                                      : 'bg-yellow-500/20 text-yellow-400'
                                  }
                                >
                                  {app.repaid ? 'Repaid' : app.approvalTime > 0 ? 'Approved' : 'Pending'}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                  <span className="text-white/60">Amount:</span>
                                  <span className="ml-2 font-semibold">{app.loanAmount} STRK</span>
                                </div>
                                <div>
                                  <span className="text-white/60">Score:</span>
                                  <span className="ml-2 font-semibold">{app.activityScore}</span>
                                </div>
                                {app.repaymentDeadline && (
                                  <div>
                                    <span className="text-white/60">Deadline:</span>
                                    <span className="ml-2 font-semibold">
                                      {new Date(app.repaymentDeadline).toLocaleDateString()}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </section>
    </main>
  )
}
