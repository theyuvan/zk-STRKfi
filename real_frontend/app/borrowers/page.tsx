'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { connectWallet } from '@/lib/wallet'
import { connectMetaMask, onAccountsChanged, onChainChanged, removeListeners } from '@/lib/ethereum-wallet'
import WalletAnalysisSection from './components/WalletAnalysisSection'
import LoanProvidersSection from './components/LoanProvidersSection'
import LoanSummarySection from './components/LoanSummarySection'
import ZKProofDialog from './components/ZKProofDialog'

export interface WalletAnalysis {
  balance: number
  transactions: number
  totalReceived: number
  accountAge: number
  eligibilityScore: number
  isEligible: boolean
  criteria: {
    balanceCheck: boolean
    transactionCheck: boolean
    inflowCheck: boolean
    ageCheck: boolean
  }
}

export interface LoanProvider {
  id: string
  name: string
  address: string
  minInterestRate: number
  maxInterestRate: number
  maxLoanAmount: number
  totalLent: number
  activeLoans: number
  rating: number
  responseTime: string
}

export default function BorrowersPage() {
  const [walletAddress, setWalletAddress] = useState<string>('')
  const [walletType, setWalletType] = useState<'starknet' | 'ethereum' | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<WalletAnalysis | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<LoanProvider | null>(null)
  const [loanAmount, setLoanAmount] = useState<number>(1000)
  const [loanDuration, setLoanDuration] = useState<number>(12)
  const [showZkProofDialog, setShowZkProofDialog] = useState(false)

  useEffect(() => {
    // Listen for MetaMask account changes
    onAccountsChanged((accounts) => {
      if (accounts.length === 0) {
        setWalletAddress('')
        setWalletType(null)
        setAnalysis(null)
      } else if (walletType === 'ethereum') {
        setWalletAddress(accounts[0])
      }
    })

    onChainChanged(() => {
      // Reload when chain changes
      window.location.reload()
    })

    return () => {
      removeListeners()
    }
  }, [walletType])

  const handleConnectStarkNet = async () => {
    setIsConnecting(true)
    try {
      const wallet = await connectWallet()
      if (wallet.address) {
        setWalletAddress(wallet.address)
        setWalletType('starknet')
        analyzeWallet()
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error)
      alert('Failed to connect wallet. Please make sure you have Ready Wallet or Braavos installed.')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleConnectMetaMask = async () => {
    setIsConnecting(true)
    try {
      const wallet = await connectMetaMask()
      if (wallet.address) {
        setWalletAddress(wallet.address)
        setWalletType('ethereum')
        analyzeWallet()
      }
    } catch (error: any) {
      console.error('Failed to connect MetaMask:', error)
      alert(error.message || 'Failed to connect MetaMask. Please make sure MetaMask is installed.')
    } finally {
      setIsConnecting(false)
    }
  }

  const analyzeWallet = () => {
    setIsAnalyzing(true)
    setTimeout(() => {
      const mockAnalysis: WalletAnalysis = {
        balance: 2500,
        transactions: 15,
        totalReceived: 5000,
        accountAge: 60,
        eligibilityScore: 85,
        isEligible: true,
        criteria: {
          balanceCheck: true,
          transactionCheck: true,
          inflowCheck: true,
          ageCheck: true
        }
      }
      setAnalysis(mockAnalysis)
      setIsAnalyzing(false)
    }, 2000)
  }

  const handleRequestLoan = () => {
    setShowZkProofDialog(true)
  }

  return (
    <main className="bg-neutral-950 text-white min-h-screen pt-20">
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
            {!walletAddress && !isConnecting && (
              <div className="flex gap-3">
                <Button 
                  onClick={handleConnectStarkNet}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-full"
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  StarkNet
                </Button>
                <Button 
                  onClick={handleConnectMetaMask}
                  className="bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-700 hover:to-yellow-700 rounded-full"
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  MetaMask
                </Button>
              </div>
            )}
            {isConnecting && (
              <Button 
                disabled
                className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-full"
              >
                <Wallet className="w-4 h-4 mr-2" />
                Connecting...
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="relative z-10 px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          {!walletAddress ? (
            <Card className="bg-neutral-900/80 border-white/10 p-12 text-center max-w-2xl mx-auto">
                <Wallet className="w-16 h-16 text-purple-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2 text-white">Connect Your Wallet</h2>
                <p className="text-white/70 mb-6">
                  Choose your wallet to analyze eligibility and request a loan
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button 
                    onClick={handleConnectStarkNet}
                    disabled={isConnecting}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    size="lg"
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    {isConnecting ? 'Connecting...' : 'StarkNet (Ready/Braavos)'}
                  </Button>
                  <Button 
                    onClick={handleConnectMetaMask}
                    disabled={isConnecting}
                    className="bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-700 hover:to-yellow-700"
                    size="lg"
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    {isConnecting ? 'Connecting...' : 'MetaMask'}
                  </Button>
                </div>
            </Card>
          ) : isAnalyzing ? (
            <Card className="bg-neutral-900/80 border-white/10 p-12 text-center max-w-2xl mx-auto">
              <div className="animate-spin w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2 text-white">Analyzing Your Wallet</h2>
              <p className="text-white/70">
                Checking your balance, transactions, and account history...
              </p>
            </Card>
          ) : analysis ? (
            <>
              <WalletAnalysisSection 
                walletAddress={walletAddress}
                analysis={analysis}
              />

              {analysis.isEligible && !selectedProvider && (
                <LoanProvidersSection
                  loanAmount={loanAmount}
                  loanDuration={loanDuration}
                  onSelectProvider={setSelectedProvider}
                />
              )}

              {selectedProvider && (
                <LoanSummarySection
                  selectedProvider={selectedProvider}
                  loanAmount={loanAmount}
                  loanDuration={loanDuration}
                  onBack={() => setSelectedProvider(null)}
                  onRequestLoan={handleRequestLoan}
                />
              )}
            </>
          ) : null}
        </div>
      </section>

      <ZKProofDialog
        open={showZkProofDialog}
        onOpenChange={setShowZkProofDialog}
        loanAmount={loanAmount}
      />
    </main>
  )
}
