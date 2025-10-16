'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Wallet, TrendingUp, Activity, Clock, DollarSign, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { connectWallet, getWalletState } from '@/lib/wallet'
import { api, WalletAnalysisResult } from '@/lib/api'
import { formatAddress, formatCurrency } from '@/lib/utils'
import DotGridShader from '@/components/DotGridShader'
import RevealOnView from '@/components/reveal-on-view'

export default function WalletAnalysisPage() {
  const [walletAddress, setWalletAddress] = useState<string>('')
  const [loanAmount, setLoanAmount] = useState<string>('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isGeneratingProof, setIsGeneratingProof] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<WalletAnalysisResult | null>(null)
  const [proofHash, setProofHash] = useState<string>('')

  const handleConnectWallet = async () => {
    setIsConnecting(true)
    try {
      const wallet = await connectWallet()
      setWalletAddress(wallet.address || '')
      toast.success('Wallet connected successfully!')
    } catch (error) {
      toast.error('Failed to connect wallet')
      console.error(error)
    } finally {
      setIsConnecting(false)
    }
  }

  const handleAnalyze = async () => {
    if (!walletAddress || !loanAmount) {
      toast.error('Please connect wallet and enter loan amount')
      return
    }

    setIsAnalyzing(true)
    try {
      const result = await api.analyzeWallet(walletAddress, parseFloat(loanAmount))
      setAnalysisResult(result)
      
      if (result.eligible) {
        toast.success(`Excellent! Your creditworthiness score is ${result.score}/100`)
      } else {
        toast.error(`Score: ${result.score}/100. You may not qualify for this loan amount.`)
      }
    } catch (error) {
      toast.error('Failed to analyze wallet')
      console.error(error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleGenerateProof = async () => {
    if (!walletAddress || !loanAmount) {
      toast.error('Please analyze wallet first')
      return
    }

    setIsGeneratingProof(true)
    try {
      const result = await api.generateWalletProof(walletAddress, parseFloat(loanAmount))
      setProofHash(result.proof)
      toast.success('Zero-knowledge proof generated!')
    } catch (error) {
      toast.error('Failed to generate proof')
      console.error(error)
    } finally {
      setIsGeneratingProof(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500'
    if (score >= 60) return 'text-yellow-500'
    return 'text-red-500'
  }

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent'
    if (score >= 60) return 'Good'
    return 'Needs Improvement'
  }

  return (
    <main className="bg-neutral-950 text-white min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        {/* Header */}
        <div className="mb-12">
          <Button asChild variant="ghost" className="mb-4 text-white/70 hover:text-white">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Link>
          </Button>
          <h1 className="text-4xl font-black tracking-tight mb-2">Wallet Analysis</h1>
          <p className="text-white/70">Analyze your on-chain creditworthiness with zero-knowledge proofs</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column: Input Form */}
          <div className="space-y-6">
            <RevealOnView>
              <Card className="bg-neutral-900/60 border-white/10">
                <CardHeader>
                  <CardTitle>Connect Wallet</CardTitle>
                  <CardDescription>Connect your StarkNet wallet to begin</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!walletAddress ? (
                    <Button 
                      onClick={handleConnectWallet} 
                      disabled={isConnecting}
                      className="w-full bg-white text-black hover:bg-white/90"
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
                          Connect StarkNet Wallet
                        </>
                      )}
                    </Button>
                  ) : (
                    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium text-green-500">Wallet Connected</span>
                      </div>
                      <p className="text-sm text-white/70 font-mono">{formatAddress(walletAddress)}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </RevealOnView>

            <RevealOnView>
              <Card className="bg-neutral-900/60 border-white/10">
                <CardHeader>
                  <CardTitle>Loan Details</CardTitle>
                  <CardDescription>Enter the amount you wish to borrow</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="loanAmount">Loan Amount (USD)</Label>
                    <Input
                      id="loanAmount"
                      type="number"
                      placeholder="1000"
                      value={loanAmount}
                      onChange={(e) => setLoanAmount(e.target.value)}
                      className="bg-neutral-800 border-white/10"
                    />
                  </div>

                  <Button 
                    onClick={handleAnalyze}
                    disabled={!walletAddress || !loanAmount || isAnalyzing}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                    size="lg"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Activity className="mr-2 h-4 w-4" />
                        Analyze Wallet
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </RevealOnView>

            {/* Privacy Notice */}
            <RevealOnView>
              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <span className="text-blue-500">🔒</span>
                  Privacy Guaranteed
                </h4>
                <ul className="text-sm text-white/70 space-y-1">
                  <li>• Your exact balance is never revealed</li>
                  <li>• Only boolean results are shown (meets criteria: yes/no)</li>
                  <li>• Zero-knowledge proofs protect your data</li>
                  <li>• Identity revealed only in case of default</li>
                </ul>
              </div>
            </RevealOnView>
          </div>

          {/* Right Column: Results */}
          <div className="space-y-6">
            {analysisResult ? (
              <>
                <RevealOnView>
                  <Card className="bg-neutral-900/60 border-white/10 relative overflow-hidden">
                    <div className="pointer-events-none absolute inset-0 opacity-5">
                      <DotGridShader />
                    </div>
                    <CardHeader>
                      <CardTitle>Creditworthiness Score</CardTitle>
                      <CardDescription>Based on on-chain wallet activity</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8">
                        <div className={`text-6xl font-black mb-2 ${getScoreColor(analysisResult.score)}`}>
                          {analysisResult.score}
                          <span className="text-2xl text-white/50">/100</span>
                        </div>
                        <Badge 
                          variant={analysisResult.eligible ? "default" : "destructive"}
                          className="text-sm px-4 py-1"
                        >
                          {getScoreLabel(analysisResult.score)}
                        </Badge>
                      </div>

                      {analysisResult.eligible && (
                        <div className="mt-4 p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                          <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                          <p className="font-semibold text-green-500">Eligible for Loan!</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </RevealOnView>

                <RevealOnView>
                  <Card className="bg-neutral-900/60 border-white/10">
                    <CardHeader>
                      <CardTitle>Metrics Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <MetricRow 
                        icon={DollarSign}
                        label="Balance"
                        meets={analysisResult.metrics.balance.meets}
                      />
                      <MetricRow 
                        icon={Activity}
                        label="Transaction Activity"
                        meets={analysisResult.metrics.activity.meets}
                      />
                      <MetricRow 
                        icon={TrendingUp}
                        label="Total Inflow"
                        meets={analysisResult.metrics.inflow.meets}
                      />
                      <MetricRow 
                        icon={Clock}
                        label="Account Age"
                        meets={analysisResult.metrics.age.meets}
                      />
                      <MetricRow 
                        icon={TrendingUp}
                        label="Net Flow"
                        meets={analysisResult.metrics.netFlow.meets}
                      />
                    </CardContent>
                  </Card>
                </RevealOnView>

                {analysisResult.eligible && (
                  <RevealOnView>
                    <Card className="bg-neutral-900/60 border-white/10">
                      <CardHeader>
                        <CardTitle>Generate Proof</CardTitle>
                        <CardDescription>Create a zero-knowledge proof of your creditworthiness</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Button 
                          onClick={handleGenerateProof}
                          disabled={isGeneratingProof || !!proofHash}
                          className="w-full bg-cyan-600 hover:bg-cyan-700"
                          size="lg"
                        >
                          {isGeneratingProof ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Generating Proof...
                            </>
                          ) : proofHash ? (
                            <>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Proof Generated
                            </>
                          ) : (
                            'Generate ZK Proof'
                          )}
                        </Button>

                        {proofHash && (
                          <div className="p-4 rounded-lg bg-neutral-800 border border-white/10">
                            <p className="text-xs text-white/50 mb-1">Proof Hash</p>
                            <p className="text-sm font-mono break-all">{proofHash}</p>
                          </div>
                        )}

                        {proofHash && (
                          <Button asChild className="w-full" size="lg">
                            <Link href="/loan-request">
                              Continue to Loan Request
                            </Link>
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  </RevealOnView>
                )}
              </>
            ) : (
              <RevealOnView>
                <Card className="bg-neutral-900/60 border-white/10">
                  <CardContent className="py-16 text-center">
                    <Activity className="h-16 w-16 text-white/20 mx-auto mb-4" />
                    <p className="text-white/50">Connect your wallet and analyze to see results</p>
                  </CardContent>
                </Card>
              </RevealOnView>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

function MetricRow({ icon: Icon, label, meets }: { icon: any, label: string, meets: boolean }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-800/50">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-white/50" />
        <span className="text-sm">{label}</span>
      </div>
      {meets ? (
        <CheckCircle className="h-5 w-5 text-green-500" />
      ) : (
        <XCircle className="h-5 w-5 text-red-500" />
      )}
    </div>
  )
}
