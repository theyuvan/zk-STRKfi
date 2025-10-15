'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Wallet, Activity, Shield, FileText, Loader2, CheckCircle, XCircle, Upload, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { connectWallet, disconnectWallet } from '@/lib/wallet'
import { starknetService } from '@/lib/services/starknetService'
import { activityScoreCalculator } from '@/lib/services/activityScoreCalculator'
import { zkProofService } from '@/lib/services/zkProofService'
import axios from 'axios'
import toast, { Toaster } from 'react-hot-toast'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000'

export default function BorrowersPage() {
  // Wallet state
  const [wallet, setWallet] = useState<any>(null)
  const [walletAddress, setWalletAddress] = useState<string>('')
  const [isConnecting, setIsConnecting] = useState(false)

  // Step 1: Activity data
  const [strkBalance, setStrkBalance] = useState<any>(null)
  const [activityMetrics, setActivityMetrics] = useState<any>(null)
  const [activityScore, setActivityScore] = useState<number>(0)
  const [isFetchingActivity, setIsFetchingActivity] = useState(false)

  // Step 2: Identity verification
  const [identityVerified, setIdentityVerified] = useState(false)
  const [identityCommitment, setIdentityCommitment] = useState<string>('')
  const [identityData, setIdentityData] = useState<any>(null)
  const [isVerifyingIdentity, setIsVerifyingIdentity] = useState(false)
  const [passportNumber, setPassportNumber] = useState('')
  const [address, setAddress] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [documentPhoto, setDocumentPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string>('')

  // Step 3: Loan application ZK proof
  const [loanZkProof, setLoanZkProof] = useState<any>(null)
  const [isGeneratingLoanProof, setIsGeneratingLoanProof] = useState(false)

  // Loan state
  const [availableLoans, setAvailableLoans] = useState<any[]>([])
  const [myApplications, setMyApplications] = useState<any[]>([])
  const [isLoadingLoans, setIsLoadingLoans] = useState(false)
  const [isApplying, setIsApplying] = useState(false)

  // Current step
  const [currentStep, setCurrentStep] = useState<'analyze' | 'identity' | 'loanProof' | 'dashboard'>('analyze')

  // Check saved state on mount
  useEffect(() => {
    checkSavedState()
    checkWalletConnection()
  }, [])

  const checkSavedState = () => {
    // Check identity
    const savedIdentity = localStorage.getItem('identityCommitment')
    const savedIdentityVerified = localStorage.getItem('identityVerified')
    if (savedIdentity && savedIdentityVerified === 'true') {
      setIdentityCommitment(savedIdentity)
      setIdentityVerified(true)
      console.log('✅ Loaded saved identity')
    }

    // Check loan ZK proof
    const savedLoanProof = localStorage.getItem('loanZkProof')
    if (savedLoanProof) {
      setLoanZkProof(JSON.parse(savedLoanProof))
      console.log('✅ Loaded saved loan ZK proof')
    }
  }

  const checkWalletConnection = async () => {
    try {
      const starknet = await connectWallet()
      if (starknet?.address) {
        setWallet(starknet)
        setWalletAddress(starknet.address)
        console.log('✅ Wallet already connected:', starknet.address)
      }
    } catch (error) {
      console.log('No wallet connected')
    }
  }

  /**
   * Connect StarkNet Wallet
   */
  const handleConnectStarkNet = async () => {
    setIsConnecting(true)
    try {
      toast.loading('Connecting wallet...', { id: 'connect' })

      const starknet = await connectWallet()
      if (!starknet?.address) {
        throw new Error('Failed to connect wallet')
      }

      setWallet(starknet)
      setWalletAddress(starknet.address)

      toast.success('Wallet connected!', { id: 'connect' })
      console.log('✅ Wallet connected:', starknet.address)

    } catch (error: any) {
      console.error('❌ Connection failed:', error)
      toast.error(error.message || 'Failed to connect', { id: 'connect' })
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      await disconnectWallet()
      setWallet(null)
      setWalletAddress('')
      setStrkBalance(null)
      setActivityMetrics(null)
      setActivityScore(0)
      setIdentityVerified(false)
      setIdentityCommitment('')
      setLoanZkProof(null)
      setAvailableLoans([])
      setCurrentStep('analyze')
      toast.success('Wallet disconnected')
    } catch (error) {
      console.error('❌ Disconnect failed:', error)
    }
  }

  /**
   * STEP 1: Analyze Activity
   */
  const analyzeActivity = async () => {
    if (!walletAddress) return

    try {
      setIsFetchingActivity(true)
      toast.loading('Analyzing wallet activity...', { id: 'analyze' })

      console.log('🔍 Fetching activity for:', walletAddress)

      // Fetch balance and metrics
      const [balance, metrics] = await Promise.all([
        starknetService.fetchStrkBalance(walletAddress),
        starknetService.calculateActivityMetrics(walletAddress)
      ])

      setStrkBalance(balance)
      setActivityMetrics(metrics)

      // Calculate score
      const scoreData = activityScoreCalculator.calculateScore(metrics)
      setActivityScore(scoreData.total)

      toast.success(`Activity analyzed! Score: ${scoreData.total}/1000`, { id: 'analyze' })
      
      console.log('✅ Activity data loaded:', {
        balance: balance.formatted,
        score: scoreData.total
      })

      // Auto-advance to identity step
      setCurrentStep('identity')

    } catch (error: any) {
      console.error('❌ Analysis failed:', error)
      toast.error('Failed to analyze activity: ' + error.message, { id: 'analyze' })
    } finally {
      setIsFetchingActivity(false)
    }
  }

  /**
   * STEP 2: Verify Identity
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      toast.error('Only JPEG, PNG, or PDF files allowed')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be less than 5MB')
      return
    }

    setDocumentPhoto(file)

    // Preview
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    } else {
      setPhotoPreview('')
    }
  }

  const verifyIdentity = async () => {
    // Validate
    if (!passportNumber.trim()) {
      toast.error('Passport/ID number required')
      return
    }
    if (!address.trim()) {
      toast.error('Address required')
      return
    }
    if (!dateOfBirth) {
      toast.error('Date of birth required')
      return
    }
    if (!documentPhoto) {
      toast.error('Please upload document photo')
      return
    }

    // Check age
    const birthDate = new Date(dateOfBirth)
    const today = new Date()
    const age = today.getFullYear() - birthDate.getFullYear()
    if (age < 18) {
      toast.error('You must be 18 years or older')
      return
    }

    try {
      setIsVerifyingIdentity(true)
      toast.loading('Verifying identity...', { id: 'identity' })

      console.log('📝 Uploading identity document...')

      // Upload document
      const formData = new FormData()
      formData.append('passportNumber', passportNumber)
      formData.append('address', address)
      formData.append('dateOfBirth', dateOfBirth)
      formData.append('walletAddress', walletAddress)
      formData.append('documentPhoto', documentPhoto)

      const uploadResponse = await axios.post(
        `${BACKEND_URL}/api/identity/upload`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )

      console.log('📄 Document uploaded:', uploadResponse.data)

      // Generate identity ZK proof
      console.log('🔐 Generating identity ZK proof...')

      const zkResponse = await axios.post(`${BACKEND_URL}/api/proof/generate-identity`, {
        passportNumber,
        address,
        dateOfBirth,
        walletAddress
      })

      console.log('✅ Identity ZK proof generated:', zkResponse.data)

      const commitment = zkResponse.data.commitment
      setIdentityCommitment(commitment)
      setIdentityVerified(true)
      setIdentityData(zkResponse.data)

      // Save to localStorage
      localStorage.setItem('identityCommitment', commitment)
      localStorage.setItem('identityVerified', 'true')

      toast.success('Identity verified successfully!', { id: 'identity' })

      // Auto-advance to loan proof step
      setCurrentStep('loanProof')

    } catch (error: any) {
      console.error('❌ Identity verification failed:', error)
      toast.error(
        'Verification failed: ' + (error.response?.data?.error || error.message),
        { id: 'identity' }
      )
    } finally {
      setIsVerifyingIdentity(false)
    }
  }

  /**
   * STEP 3: Generate Loan Application ZK Proof
   */
  const generateLoanProof = async () => {
    if (!activityScore || !walletAddress) return

    try {
      setIsGeneratingLoanProof(true)
      toast.loading('Generating loan application proof...', { id: 'loanProof' })

      console.log('🔐 Generating loan ZK proof for score:', activityScore)

      // Generate proof using zkProofService
      const proof = await zkProofService.generateLenderProof(
        walletAddress,
        activityScore,
        100 // minimum threshold
      )

      setLoanZkProof(proof)

      // Save to localStorage
      localStorage.setItem('loanZkProof', JSON.stringify(proof))

      toast.success('Loan proof generated!', { id: 'loanProof' })
      console.log('✅ Loan proof generated:', {
        commitment: proof.commitment,
        commitmentHash: proof.commitmentHash
      })

      // Auto-fetch available loans and go to dashboard
      setCurrentStep('dashboard')
      setTimeout(() => fetchAvailableLoans(), 500)

    } catch (error: any) {
      console.error('❌ Proof generation failed:', error)
      toast.error('Failed to generate proof: ' + error.message, { id: 'loanProof' })
    } finally {
      setIsGeneratingLoanProof(false)
    }
  }

  /**
   * Fetch Available Loans
   */
  const fetchAvailableLoans = async () => {
    try {
      setIsLoadingLoans(true)
      console.log('📋 Fetching available loans...')

      const response = await axios.get(`${BACKEND_URL}/api/loan/available`)
      
      setAvailableLoans(response.data.loans || [])
      console.log('✅ Loaded', response.data.loans?.length || 0, 'loans')

    } catch (error: any) {
      console.error('❌ Failed to fetch loans:', error)
      toast.error('Failed to load loans')
    } finally {
      setIsLoadingLoans(false)
    }
  }

  /**
   * Fetch My Applications
   */
  const fetchMyApplications = async () => {
    if (!loanZkProof?.commitment) return

    try {
      console.log('📋 Fetching my applications...')

      const response = await axios.get(
        `${BACKEND_URL}/api/loan/my-applications/${loanZkProof.commitment}`
      )
      
      setMyApplications(response.data.applications || [])

    } catch (error: any) {
      console.error('❌ Failed to fetch applications:', error)
    }
  }

  /**
   * Apply for Loan
   */
  const applyForLoan = async (loan: any) => {
    if (!loanZkProof || !walletAddress) return

    try {
      setIsApplying(true)
      toast.loading('Applying for loan...', { id: 'apply' })

      console.log('📋 Applying for loan:', loan.loanId)

      // Check eligibility
      const eligibility = activityScoreCalculator.checkLoanEligibility(
        activityScore,
        loan.minScore
      )

      if (!eligibility.eligible) {
        toast.error(eligibility.message, { id: 'apply' })
        return
      }

      // Submit application
      const response = await axios.post(`${BACKEND_URL}/api/loan/apply`, {
        borrowerAddress: walletAddress,
        loanId: loan.loanId,
        commitment: loanZkProof.commitment,
        commitmentHash: loanZkProof.commitmentHash,
        identityCommitment: identityCommitment,
        activityScore: activityScore,
        proof: loanZkProof.proof,
        publicSignals: loanZkProof.publicSignals
      })

      toast.success('Loan application submitted!', { id: 'apply' })

      console.log('✅ Application submitted:', response.data)

      // Refresh applications
      await fetchMyApplications()

    } catch (error: any) {
      console.error('❌ Application failed:', error)
      toast.error(
        'Application failed: ' + (error.response?.data?.error || error.message),
        { id: 'apply' }
      )
    } finally {
      setIsApplying(false)
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
                <p className="text-white/60 mt-1">Get loans with privacy-preserving ZK proofs</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {walletAddress ? (
                <>
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
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
                <Button
                  onClick={handleConnectStarkNet}
                  disabled={isConnecting}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-full"
                >
                  {isConnecting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Wallet className="w-4 h-4 mr-2" />
                  )}
                  Connect StarkNet
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="relative z-10 px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          {!walletAddress ? (
            <Card className="bg-neutral-900/80 border-white/10 p-12 text-center">
              <Wallet className="w-16 h-16 mx-auto mb-4 text-purple-500" />
              <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
              <p className="text-white/60 mb-6">
                Connect your StarkNet wallet to get started
              </p>
              <Button
                onClick={handleConnectStarkNet}
                disabled={isConnecting}
                className="bg-gradient-to-r from-purple-600 to-blue-600"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4 mr-2" />
                    Connect StarkNet
                  </>
                )}
              </Button>
            </Card>
          ) : (
            <Tabs value={currentStep} onValueChange={(v) => setCurrentStep(v as any)}>
              <TabsList className="grid w-full grid-cols-4 mb-8">
                <TabsTrigger value="analyze">1. Analyze</TabsTrigger>
                <TabsTrigger value="identity" disabled={activityScore === 0}>
                  2. Identity
                </TabsTrigger>
                <TabsTrigger value="loanProof" disabled={!identityVerified}>
                  3. Loan Proof
                </TabsTrigger>
                <TabsTrigger value="dashboard" disabled={!loanZkProof}>
                  Dashboard
                </TabsTrigger>
              </TabsList>

              {/* STEP 1: Analyze Activity */}
              <TabsContent value="analyze">
                <Card className="bg-neutral-900/80 border-white/10 p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <Activity className="w-6 h-6 text-blue-500" />
                    <h2 className="text-2xl font-bold">Wallet Activity Analysis</h2>
                  </div>

                  {activityScore === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-white/60 mb-6">
                        Analyze your wallet activity to calculate your credit score
                      </p>
                      <Button
                        onClick={analyzeActivity}
                        disabled={isFetchingActivity}
                        className="bg-gradient-to-r from-blue-600 to-cyan-600"
                      >
                        {isFetchingActivity ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Activity className="w-4 h-4 mr-2" />
                            Analyze Activity
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Score and Balance */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="bg-neutral-800/50 border-white/10 p-6">
                          <h3 className="text-sm text-white/60 mb-2">Activity Score</h3>
                          <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-bold">{activityScore}</span>
                            <span className="text-white/40">/1000</span>
                          </div>
                          <Badge className="mt-3 bg-blue-500/20 text-blue-400 border-blue-500/30">
                            {activityScore >= 750
                              ? 'Platinum'
                              : activityScore >= 500
                              ? 'Gold'
                              : activityScore >= 250
                              ? 'Silver'
                              : 'Bronze'}
                          </Badge>
                        </Card>

                        <Card className="bg-neutral-800/50 border-white/10 p-6">
                          <h3 className="text-sm text-white/60 mb-2">Balance</h3>
                          <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-bold">
                              {strkBalance?.formatted || '0'}
                            </span>
                            <span className="text-white/40">STRK</span>
                          </div>
                        </Card>
                      </div>

                      {/* Metrics */}
                      <Card className="bg-neutral-800/50 border-white/10 p-6">
                        <h3 className="text-lg font-bold mb-4">Activity Metrics</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm text-white/60">Transactions</p>
                            <p className="text-2xl font-bold">{activityMetrics?.txCount || 0}</p>
                          </div>
                          <div>
                            <p className="text-sm text-white/60">Total Volume</p>
                            <p className="text-2xl font-bold">
                              {activityMetrics?.totalVolume?.toFixed(2) || 0} STRK
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-white/60">Wallet Age</p>
                            <p className="text-2xl font-bold">
                              {activityMetrics?.walletAge || 0} days
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-white/60">Recent Activity</p>
                            <p className="text-2xl font-bold">
                              {activityMetrics?.recentTxCount || 0} txs
                            </p>
                          </div>
                        </div>
                      </Card>

                      <Button
                        onClick={() => setCurrentStep('identity')}
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600"
                        size="lg"
                      >
                        Continue to Identity Verification
                      </Button>
                    </div>
                  )}
                </Card>
              </TabsContent>

              {/* STEP 2: Identity Verification */}
              <TabsContent value="identity">
                <Card className="bg-neutral-900/80 border-white/10 p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <User className="w-6 h-6 text-purple-500" />
                    <h2 className="text-2xl font-bold">Identity Verification</h2>
                  </div>

                  {!identityVerified ? (
                    <div className="space-y-6 max-w-2xl mx-auto">
                      <p className="text-white/60 text-center">
                        Upload your identity document to verify your identity with zero-knowledge proofs
                      </p>

                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="passportNumber">Passport/ID Number</Label>
                          <Input
                            id="passportNumber"
                            value={passportNumber}
                            onChange={(e) => setPassportNumber(e.target.value)}
                            placeholder="Enter passport or ID number"
                            className="bg-neutral-800 border-white/10"
                          />
                        </div>

                        <div>
                          <Label htmlFor="address">Address</Label>
                          <Input
                            id="address"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="Enter your address"
                            className="bg-neutral-800 border-white/10"
                          />
                        </div>

                        <div>
                          <Label htmlFor="dob">Date of Birth</Label>
                          <Input
                            id="dob"
                            type="date"
                            value={dateOfBirth}
                            onChange={(e) => setDateOfBirth(e.target.value)}
                            className="bg-neutral-800 border-white/10"
                          />
                        </div>

                        <div>
                          <Label htmlFor="document">Document Photo</Label>
                          <div className="mt-2">
                            <label
                              htmlFor="document"
                              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-lg cursor-pointer hover:border-white/40 transition-colors"
                            >
                              {photoPreview ? (
                                <img
                                  src={photoPreview}
                                  alt="Preview"
                                  className="h-full object-contain"
                                />
                              ) : (
                                <div className="flex flex-col items-center">
                                  <Upload className="w-8 h-8 text-white/40 mb-2" />
                                  <p className="text-sm text-white/60">
                                    Click to upload (JPEG, PNG, PDF)
                                  </p>
                                  <p className="text-xs text-white/40 mt-1">Max 5MB</p>
                                </div>
                              )}
                            </label>
                            <input
                              id="document"
                              type="file"
                              onChange={handleFileChange}
                              accept="image/jpeg,image/jpg,image/png,application/pdf"
                              className="hidden"
                            />
                          </div>
                        </div>
                      </div>

                      <Button
                        onClick={verifyIdentity}
                        disabled={isVerifyingIdentity}
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                        size="lg"
                      >
                        {isVerifyingIdentity ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Verifying Identity...
                          </>
                        ) : (
                          <>
                            <FileText className="w-4 h-4 mr-2" />
                            Verify Identity
                          </>
                        )}
                      </Button>

                      <p className="text-xs text-white/40 text-center">
                        Your identity data is encrypted and used only for ZK proof generation
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <CheckCircle className="w-6 h-6 text-green-500" />
                          <h3 className="text-xl font-bold text-green-500">Identity Verified!</h3>
                        </div>
                        <p className="text-white/60">
                          Your identity has been verified with zero-knowledge proofs. Your data is
                          secure and private.
                        </p>
                      </div>

                      <Card className="bg-neutral-800/50 border-white/10 p-6">
                        <h3 className="text-lg font-bold mb-4">Identity Commitment</h3>
                        <p className="text-sm text-white/60 mb-2">Your unique identity hash:</p>
                        <p className="text-white/90 font-mono text-xs break-all">
                          {identityCommitment}
                        </p>
                      </Card>

                      <Button
                        onClick={() => setCurrentStep('loanProof')}
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600"
                        size="lg"
                      >
                        Continue to Loan Proof Generation
                      </Button>
                    </div>
                  )}
                </Card>
              </TabsContent>

              {/* STEP 3: Generate Loan Application ZK Proof */}
              <TabsContent value="loanProof">
                <Card className="bg-neutral-900/80 border-white/10 p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <Shield className="w-6 h-6 text-purple-500" />
                    <h2 className="text-2xl font-bold">Loan Application Proof</h2>
                  </div>

                  {!loanZkProof ? (
                    <div className="text-center py-8">
                      <p className="text-white/60 mb-6">
                        Generate a zero-knowledge proof to apply for loans anonymously
                      </p>
                      <Button
                        onClick={generateLoanProof}
                        disabled={isGeneratingLoanProof}
                        className="bg-gradient-to-r from-purple-600 to-pink-600"
                      >
                        {isGeneratingLoanProof ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Generating Proof...
                          </>
                        ) : (
                          <>
                            <Shield className="w-4 h-4 mr-2" />
                            Generate Loan Proof
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <CheckCircle className="w-6 h-6 text-green-500" />
                          <h3 className="text-xl font-bold text-green-500">Proof Generated!</h3>
                        </div>
                        <p className="text-white/60">
                          Your loan application proof is ready. You can now browse and apply for
                          loans.
                        </p>
                      </div>

                      <Card className="bg-neutral-800/50 border-white/10 p-6">
                        <h3 className="text-lg font-bold mb-4">Proof Details</h3>
                        <div className="space-y-3 font-mono text-sm">
                          <div>
                            <p className="text-white/60 mb-1">Commitment</p>
                            <p className="text-white/90 break-all">{loanZkProof.commitment}</p>
                          </div>
                          <div>
                            <p className="text-white/60 mb-1">Commitment Hash</p>
                            <p className="text-white/90 break-all">{loanZkProof.commitmentHash}</p>
                          </div>
                          <div>
                            <p className="text-white/60 mb-1">Activity Score</p>
                            <p className="text-white/90">{loanZkProof.activityScore}</p>
                          </div>
                        </div>
                      </Card>

                      <Button
                        onClick={() => {
                          setCurrentStep('dashboard')
                          fetchAvailableLoans()
                        }}
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600"
                        size="lg"
                      >
                        Go to Loan Dashboard
                      </Button>
                    </div>
                  )}
                </Card>
              </TabsContent>

              {/* DASHBOARD: Browse and Apply for Loans */}
              <TabsContent value="dashboard">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold">Available Loan Offers</h2>
                    <Button
                      onClick={fetchAvailableLoans}
                      disabled={isLoadingLoans}
                      variant="outline"
                      className="border-white/10"
                    >
                      {isLoadingLoans ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Refresh'
                      )}
                    </Button>
                  </div>

                  {isLoadingLoans ? (
                    <Card className="bg-neutral-900/80 border-white/10 p-12 text-center">
                      <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-purple-500" />
                      <p className="text-white/60">Loading loans...</p>
                    </Card>
                  ) : availableLoans.length === 0 ? (
                    <Card className="bg-neutral-900/80 border-white/10 p-12 text-center">
                      <p className="text-white/60 mb-4">No loans available</p>
                      <Button onClick={fetchAvailableLoans} variant="outline">
                        Refresh
                      </Button>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 gap-6">
                      {availableLoans.map((loan) => (
                        <LoanCard
                          key={loan.loanId}
                          loan={loan}
                          activityScore={activityScore}
                          onApply={() => applyForLoan(loan)}
                          isApplying={isApplying}
                        />
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

// Loan Card Component
function LoanCard({
  loan,
  activityScore,
  onApply,
  isApplying
}: {
  loan: any
  activityScore: number
  onApply: () => void
  isApplying: boolean
}) {
  const eligibility = activityScoreCalculator.checkLoanEligibility(activityScore, loan.minScore)
  const loanAmountStrk = parseInt(loan.totalAmount) / 1e18 / loan.maxBorrowers
  const interestAmount = (loanAmountStrk * loan.interestRate) / 100
  const repaymentAmount = loanAmountStrk + interestAmount

  return (
    <Card className="bg-neutral-900/80 border-white/10 overflow-hidden hover:border-purple-500/50 transition-all">
      <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 p-6 border-b border-white/10">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-bold">Loan #{loan.loanId}</h3>
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            {loan.currentBorrowers}/{loan.maxBorrowers} Slots
          </Badge>
        </div>
        <p className="text-white/60 text-sm font-mono">
          Lender: {loan.lenderAddress.slice(0, 10)}...{loan.lenderAddress.slice(-8)}
        </p>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-neutral-800/50 rounded-lg p-4">
            <p className="text-xs text-white/60 mb-1">Loan Amount</p>
            <p className="text-2xl font-bold">{loanAmountStrk.toFixed(2)} STRK</p>
          </div>
          <div className="bg-neutral-800/50 rounded-lg p-4">
            <p className="text-xs text-white/60 mb-1">Interest Rate</p>
            <p className="text-2xl font-bold">{loan.interestRate}%</p>
          </div>
          <div className="bg-neutral-800/50 rounded-lg p-4">
            <p className="text-xs text-white/60 mb-1">Repayment</p>
            <p className="text-2xl font-bold">{repaymentAmount.toFixed(2)} STRK</p>
          </div>
          <div className="bg-neutral-800/50 rounded-lg p-4">
            <p className="text-xs text-white/60 mb-1">Duration</p>
            <p className="text-2xl font-bold">{loan.duration.toLocaleString()} sec</p>
          </div>
        </div>

        <Card className="bg-blue-500/10 border-blue-500/30 p-4 mb-4">
          <h4 className="text-sm font-semibold mb-3">Requirements</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/60">Minimum Score</span>
              <span className="text-sm font-bold">{loan.minScore}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/60">Your Score</span>
              <span
                className={`text-sm font-bold ${
                  eligibility.eligible ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {activityScore}
              </span>
            </div>
          </div>
        </Card>

        {eligibility.eligible ? (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <p className="text-sm font-semibold text-green-400">{eligibility.message}</p>
            </div>
          </div>
        ) : (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <p className="text-sm font-semibold text-red-400">{eligibility.message}</p>
            </div>
          </div>
        )}

        <Button
          onClick={onApply}
          disabled={!eligibility.eligible || isApplying || loan.currentBorrowers >= loan.maxBorrowers}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 disabled:opacity-50"
          size="lg"
        >
          {isApplying ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Applying...
            </>
          ) : loan.currentBorrowers >= loan.maxBorrowers ? (
            'Loan Full'
          ) : (
            `Apply for ${loanAmountStrk.toFixed(2)} STRK`
          )}
        </Button>
      </div>
    </Card>
  )
}
