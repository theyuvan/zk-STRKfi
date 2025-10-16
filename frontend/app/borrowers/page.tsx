'use client'

// Force dynamic rendering - this page requires client-side wallet connection
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Wallet, Activity, Shield, FileText, Loader2, CheckCircle, XCircle, Upload, User, AlertCircle } from 'lucide-react'
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
import { RpcProvider, Contract, uint256, num, CallData } from 'starknet'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000'
const LOAN_ESCROW_ADDRESS = process.env.NEXT_PUBLIC_LOAN_ESCROW_ZK_ADDRESS || '0x06b058a0946bb36fa846e6a954da885fa20809f43a9e47038dc83b4041f7f012'
const ACTIVITY_VERIFIER_ADDRESS = process.env.NEXT_PUBLIC_ACTIVITY_VERIFIER_ADDRESS || '0x071b94eb84b81868b61fb0ec1bbb59df47bb508583bc79325e5fa997ee3eb4be'
const STRK_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_STRK_TOKEN_ADDRESS || '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d'
const RPC_URL = process.env.NEXT_PUBLIC_STARKNET_RPC || 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7'

// ActivityVerifier contract ABI (minimal)
const ACTIVITY_VERIFIER_ABI = [
  {
    "type": "function",
    "name": "register_proof",
    "inputs": [
      {
        "name": "proof_hash",
        "type": "core::felt252"
      },
      {
        "name": "commitment",
        "type": "core::felt252"
      },
      {
        "name": "activity_score",
        "type": "core::integer::u256"
      }
    ],
    "outputs": [],
    "state_mutability": "external"
  }
]

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
  const [myActiveLoans, setMyActiveLoans] = useState<any[]>([])
  const [isLoadingLoans, setIsLoadingLoans] = useState(false)
  const [isLoadingActiveLoans, setIsLoadingActiveLoans] = useState(false)
  const [isApplying, setIsApplying] = useState(false)

  // Current step
  const [currentStep, setCurrentStep] = useState<'analyze' | 'identity' | 'loanProof' | 'dashboard'>('analyze')

  // Check saved state on mount
  useEffect(() => {
    checkWalletConnection()
  }, [])

  // Load wallet-specific data when wallet connects
  useEffect(() => {
    if (walletAddress) {
      checkSavedState(walletAddress)
    }
  }, [walletAddress])

  // Auto-refresh active loans when on dashboard (every 30 seconds)
  useEffect(() => {
    if (currentStep === 'dashboard' && loanZkProof?.commitment) {
      // Initial fetch
      fetchMyActiveLoans()
      
      // Set up auto-refresh
      const interval = setInterval(() => {
        console.log('🔄 Auto-refreshing active loans...')
        fetchMyActiveLoans()
      }, 30000) // 30 seconds

      return () => clearInterval(interval)
    }
  }, [currentStep, loanZkProof?.commitment])

  const checkSavedState = (address: string) => {
    // Check identity (wallet-specific)
    const savedIdentity = localStorage.getItem(`identityCommitment_${address}`)
    const savedIdentityVerified = localStorage.getItem(`identityVerified_${address}`)
    if (savedIdentity && savedIdentityVerified === 'true') {
      setIdentityCommitment(savedIdentity)
      setIdentityVerified(true)
      console.log('✅ Loaded saved identity for wallet:', address)
    } else {
      // Reset if no data for this wallet
      setIdentityCommitment('')
      setIdentityVerified(false)
      console.log('⚠️ No identity found for wallet:', address)
    }

    // Check loan ZK proof (wallet-specific)
    const savedLoanProof = localStorage.getItem(`loanZkProof_${address}`)
    if (savedLoanProof) {
      setLoanZkProof(JSON.parse(savedLoanProof))
      console.log('✅ Loaded saved loan ZK proof for wallet:', address)
    } else {
      // Reset if no data for this wallet
      setLoanZkProof(null)
      console.log('⚠️ No ZK proof found for wallet:', address)
    }

    // Load activity score (wallet-specific)
    const savedScore = localStorage.getItem(`activityScore_${address}`)
    if (savedScore) {
      setActivityScore(parseInt(savedScore))
      console.log('✅ Loaded activity score for wallet:', address, savedScore)
    } else {
      setActivityScore(0)
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

      // Step 1: Upload document and get ZK inputs
      const formData = new FormData()
      formData.append('passportNumber', passportNumber)
      formData.append('address', address)
      formData.append('dateOfBirth', dateOfBirth)
      formData.append('walletAddress', walletAddress)
      formData.append('document', documentPhoto) // Note: backend expects 'document' not 'documentPhoto'

      const uploadResponse = await axios.post(
        `${BACKEND_URL}/api/identity/verify-document`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )

      console.log('📄 Document verified:', uploadResponse.data)
      
      // Show validation results if available
      if (uploadResponse.data.metadata?.validation) {
        const validation = uploadResponse.data.metadata.validation
        console.log('✅ OCR Validation Results:', validation)
        
        if (validation.ocrConfidence) {
          console.log(`📊 OCR Confidence: ${Math.round(validation.ocrConfidence)}%`)
        }
        
        if (validation.matches) {
          console.log('✅ Validated fields:', Object.keys(validation.matches))
        }
        
        if (validation.warnings && validation.warnings.length > 0) {
          console.warn('⚠️ Validation warnings:', validation.warnings)
        }
      }

      if (!uploadResponse.data.success) {
        throw new Error(uploadResponse.data.error || 'Document verification failed')
      }

      // Step 2: Generate identity ZK proof
      console.log('🔐 Generating identity ZK proof...')
      toast.loading('Generating zero-knowledge proof...', { id: 'identity' })

      const zkResponse = await axios.post(`${BACKEND_URL}/api/identity/generate-proof`, {
        identityInputs: uploadResponse.data.zkInputs
      })

      console.log('✅ Identity ZK proof generated:', zkResponse.data)

      if (!zkResponse.data.success) {
        throw new Error(zkResponse.data.error || 'Proof generation failed')
      }

      const commitment = zkResponse.data.identity_commitment
      setIdentityCommitment(commitment)
      setIdentityVerified(true)

      // Save to localStorage (wallet-specific)
      localStorage.setItem(`identityCommitment_${walletAddress}`, commitment)
      localStorage.setItem(`identityVerified_${walletAddress}`, 'true')

      console.log('✅ Identity saved for wallet:', walletAddress)

      toast.success('Identity verified successfully!', { id: 'identity' })

      // Auto-advance to loan proof step
      setCurrentStep('loanProof')

    } catch (error: any) {
      console.error('❌ Identity verification failed:', error)
      
      // Extract detailed error message from backend
      const errorData = error.response?.data
      let errorMessage = 'Verification failed'
      
      if (errorData?.error) {
        errorMessage = errorData.error
      } else if (errorData?.message) {
        errorMessage = errorData.message
      } else if (error.message) {
        errorMessage = error.message
      }
      
      // Show detailed validation errors if available
      if (errorData?.validation) {
        console.error('📋 Validation errors:', errorData.validation)
        
        const validationErrors = errorData.validation.errors || []
        const validationWarnings = errorData.validation.warnings || []
        
        if (validationErrors.length > 0) {
          errorMessage += '\n\n❌ Validation Errors:\n' + validationErrors.map((e: string) => `• ${e}`).join('\n')
        }
        
        if (validationWarnings.length > 0) {
          errorMessage += '\n\n⚠️ Warnings:\n' + validationWarnings.map((w: string) => `• ${w}`).join('\n')
        }
      }
      
      // Special handling for document validation errors
      if (errorMessage.includes('MISMATCH') || 
          errorMessage.includes('validation failed') || 
          errorMessage.includes('could not be read')) {
        errorMessage += '\n\n💡 Tips:\n' +
          '• Ensure document is clear and well-lit\n' +
          '• Check that entered data matches document exactly\n' +
          '• Use original document (not photocopy)\n' +
          '• Supported formats: JPEG, PNG, PDF'
      }
      
      toast.error(errorMessage, { id: 'identity', duration: 10000 })
    } finally {
      setIsVerifyingIdentity(false)
    }
  }

  /**
   * STEP 3: Generate Loan Application ZK Proof and Register On-Chain
   */
  const generateLoanProof = async () => {
    if (!activityScore || !walletAddress || !wallet) return

    try {
      setIsGeneratingLoanProof(true)
      toast.loading('Generating loan application proof...', { id: 'loanProof' })

      console.log('🔐 Generating loan ZK proof for score:', activityScore)

      // Generate proof using zkProofService
      const proof = await zkProofService.generateLenderProof(
        activityScore,
        100, // minimum threshold
        walletAddress
      )

      console.log('✅ Proof generated, now registering on-chain...')
      toast.loading('Registering proof on blockchain...', { id: 'loanProof' })

      // Check wallet balance first
      try {
        const provider = new RpcProvider({ nodeUrl: RPC_URL })
        // Use STRK token address (not ETH)
        const balance = await provider.callContract({
          contractAddress: STRK_TOKEN_ADDRESS,
          entrypoint: 'balanceOf',
          calldata: [walletAddress]
        })
        const balanceStrk = parseFloat(uint256.uint256ToBN({ low: balance[0], high: balance[1] }).toString()) / 1e18
        
        console.log('💰 Wallet STRK balance:', balanceStrk, 'STRK')
        console.log('📍 Checking token at:', STRK_TOKEN_ADDRESS)
        
        if (balanceStrk < 0.001) {
          toast.error(
            '⚠️ Insufficient balance! You need STRK tokens for gas fees.\n\n' +
            '💰 Current Balance: ' + balanceStrk.toFixed(4) + ' STRK\n' +
            '🔗 Get free testnet tokens at: https://starknet-faucet.vercel.app/',
            { id: 'loanProof', duration: 15000 }
          )
          return
        }
      } catch (balanceError) {
        console.warn('⚠️ Could not check balance:', balanceError)
        // Continue anyway - user might have balance but RPC call failed
      }

      // Register proof on ActivityVerifier contract
      const provider = new RpcProvider({ nodeUrl: RPC_URL })

      // Clean and truncate hex strings to fit in felt252 (max 252 bits = 63 hex chars)
      const cleanHex = (hexStr: string) => {
        if (!hexStr) return '0'
        const cleaned = hexStr.startsWith('0x') ? hexStr.slice(2) : hexStr
        return cleaned.slice(0, 63)
      }

      const proofHashHex = cleanHex(proof.commitment)
      const commitmentHex = cleanHex(proof.commitmentHash)

      const proofHashNum = BigInt('0x' + proofHashHex)
      const commitmentNum = BigInt('0x' + commitmentHex)

      // Convert activity score to u256
      const activityScoreU256 = uint256.bnToUint256(BigInt(activityScore))

      // CRITICAL: uint256.bnToUint256 returns hex strings ("0x13b"), not numbers!
      // We must convert them to decimal strings for the wallet
      const scoreLowDecimal = BigInt(activityScoreU256.low).toString()
      const scoreHighDecimal = BigInt(activityScoreU256.high).toString()

      // Prepare calldata array (all values as decimal strings)
      const calldata = [
        proofHashNum.toString(),              // proof_hash (felt252 as decimal string)
        commitmentNum.toString(),             // commitment (felt252 as decimal string)
        scoreLowDecimal,                      // activity_score.low (u128 as decimal string)
        scoreHighDecimal                      // activity_score.high (u128 as decimal string)
      ]

      console.log('📊 Registering proof with params:', {
        proof_hash: proofHashNum.toString(),
        commitment: commitmentNum.toString(),
        activity_score: activityScore,
        activity_score_u256: {
          low_hex: activityScoreU256.low,
          high_hex: activityScoreU256.high,
          low_decimal: scoreLowDecimal,
          high_decimal: scoreHighDecimal
        },
        calldata: calldata,
        calldata_types: calldata.map(v => typeof v),
        contract: ACTIVITY_VERIFIER_ADDRESS
      })

      // Register proof on-chain using raw execute (most compatible with wallets)
      let registerTx: any = null
      
      try {
        console.log('📤 Preparing transaction with raw execute()...')
        console.log('📊 Final calldata (all decimal strings):', calldata)
        console.log('🔢 Calldata validation:', {
          param1_type: typeof calldata[0],
          param2_type: typeof calldata[1],
          param3_type: typeof calldata[2],
          param4_type: typeof calldata[3],
          all_are_strings: calldata.every(v => typeof v === 'string'),
          no_hex_values: !calldata.some(v => String(v).startsWith('0x'))
        })

        // Show user-friendly message
        toast.loading(
          'Opening wallet... Please check your balance and approve the transaction',
          { id: 'loanProof', duration: 5000 }
        )

        // Use raw execute for maximum compatibility
        registerTx = await wallet.account.execute({
          contractAddress: ACTIVITY_VERIFIER_ADDRESS,
          entrypoint: 'register_proof',
          calldata: calldata  // Already prepared as decimal strings
        })

        console.log('⏳ Waiting for proof registration:', registerTx.transaction_hash)
        toast.loading('Waiting for confirmation...', { id: 'loanProof' })

        await provider.waitForTransaction(registerTx.transaction_hash)

        console.log('✅ Proof registered on-chain!')

        setLoanZkProof(proof)

        // Save to localStorage (wallet-specific)
        localStorage.setItem(`loanZkProof_${walletAddress}`, JSON.stringify(proof))
        localStorage.setItem(`zkCommitment_${walletAddress}`, proof.commitmentHash)
        localStorage.setItem(`zkProofHash_${walletAddress}`, proof.commitment)
        localStorage.setItem(`activityScore_${walletAddress}`, activityScore.toString())

        console.log('✅ Proof data saved for wallet:', walletAddress)

        toast.success(
          `Proof registered! Tx: ${registerTx.transaction_hash.slice(0, 10)}...`,
          { id: 'loanProof', duration: 8000 }
        )

        console.log('✅ Loan proof generated and registered:', {
          commitment: proof.commitment,
          commitmentHash: proof.commitmentHash,
          txHash: registerTx.transaction_hash
        })

        // Auto-fetch available loans and active loans, then go to dashboard
        setCurrentStep('dashboard')
        setTimeout(() => {
          fetchAvailableLoans()
          fetchMyActiveLoans()
        }, 500)

      } catch (contractError: any) {
        console.error('❌ Contract call failed:', contractError)
        throw contractError
      }

    } catch (error: any) {
      console.error('❌ Proof generation/registration failed:', error)
      
      if (error.message?.includes('User abort')) {
        toast.error('Transaction rejected by user', { id: 'loanProof' })
      } else {
        toast.error('Failed to register proof: ' + error.message, { id: 'loanProof' })
      }
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
      
      // Backend returns plain array, not {loans: [...]}
      const loans = Array.isArray(response.data) ? response.data : (response.data.loans || [])
      
      setAvailableLoans(loans)
      console.log('✅ Loaded', loans.length, 'loans')
      console.log('📦 Loan details:', loans)

    } catch (error: any) {
      console.error('❌ Failed to fetch loans:', error)
      toast.error('Failed to load loans')
    } finally {
      setIsLoadingLoans(false)
    }
  }

  /**
   * Fetch My Active Loans (approved loans that need repayment)
   */
  const fetchMyActiveLoans = async () => {
    if (!loanZkProof?.commitment) {
      console.log('⚠️ No ZK proof commitment available')
      return
    }

    try {
      setIsLoadingActiveLoans(true)
      console.log('💼 Fetching my active loans...')
      console.log('🔑 Using commitment:', loanZkProof.commitment)
      console.log('🔑 Commitment hash:', loanZkProof.commitmentHash)
      console.log('🔍 Full ZK proof object:', loanZkProof)

      // Try multiple commitment formats to ensure matching
      const commitmentVariants = [
        loanZkProof.commitment,
        loanZkProof.commitmentHash,
        // Also check localStorage for alternate values
        localStorage.getItem(`zkCommitment_${walletAddress}`),
        localStorage.getItem(`zkProofHash_${walletAddress}`)
      ].filter(Boolean)

      console.log('🔍 Trying commitment variants:', commitmentVariants)

      // Try each variant until we find active loans
      let allLoans: any[] = []
      for (const commitment of commitmentVariants) {
        try {
          console.log(`🔎 Trying commitment: ${commitment?.slice(0, 20)}...`)
          const response = await axios.get(
            `${BACKEND_URL}/api/loan/borrower/${commitment}/active`
          )
          
          const loans = response.data.loans || []
          if (loans.length > 0) {
            console.log(`✅ Found ${loans.length} loan(s) with commitment: ${commitment?.slice(0, 20)}...`)
            allLoans = [...allLoans, ...loans]
          }
        } catch (err) {
          console.log(`⚠️ No loans found with commitment: ${commitment?.slice(0, 20)}...`)
        }
      }

      // Remove duplicates by loanId
      const uniqueLoans = Array.from(
        new Map(allLoans.map(loan => [loan.loanId, loan])).values()
      )

      setMyActiveLoans(uniqueLoans)
      
      console.log(`✅ Total active loans found: ${uniqueLoans.length}`)
      if (uniqueLoans.length > 0) {
        console.log('📦 Active loan details:', uniqueLoans)
        console.log('📦 First loan structure:', JSON.stringify(uniqueLoans[0], null, 2))
      } else {
        console.warn('⚠️ No active loans found. Check if lender approved with correct commitment.')
        console.log('💡 Expected commitment (from approval):', '0x4961c7426ec28ea71c07307d9ea0bb66273c13f3cb901cfbc13c653e5dce726')
        console.log('💡 Your commitment:', loanZkProof.commitment)
      }

    } catch (error: any) {
      console.error('❌ Failed to fetch active loans:', error)
      // Don't show error toast, just log it
    } finally {
      setIsLoadingActiveLoans(false)
    }
  }

  /**
   * Apply for Loan - ON-CHAIN
   */
  const applyForLoan = async (loan: any) => {
    // VALIDATION: Check wallet connection
    if (!walletAddress || !wallet) {
      toast.error('Please connect your wallet first')
      return
    }

    // VALIDATION: Check identity verification
    if (!identityVerified || !identityCommitment) {
      toast.error('⚠️ Please verify your identity first (Step 2)', { duration: 5000 })
      setCurrentStep('identity')
      return
    }

    // VALIDATION: Check ZK proof
    if (!loanZkProof) {
      toast.error('⚠️ Please generate your ZK proof first (Step 3)', { duration: 5000 })
      setCurrentStep('loanProof')
      return
    }

    try {
      setIsApplying(true)
      toast.loading('Applying for loan on-chain...', { id: 'apply' })

      console.log('📋 Applying for loan:', loan.loanId)
      console.log('📊 Loan details:', {
        loanId: loan.loanId,
        minActivityScore: loan.minActivityScore,
        yourScore: activityScore,
        lender: loan.lender
      })

      // Check eligibility
      const eligibility = activityScoreCalculator.checkLoanEligibility(
        activityScore,
        loan.minActivityScore
      )

      console.log('✅ Eligibility check:', eligibility)

      if (!eligibility.eligible) {
        toast.error(eligibility.message, { id: 'apply' })
        return
      }

      // Validate ZK proof exists
      if (!loanZkProof.commitmentHash || !loanZkProof.commitment) {
        toast.error('ZK proof not complete. Please refresh.', { id: 'apply' })
        return
      }

      // Get provider
      const provider = new RpcProvider({ nodeUrl: RPC_URL })

      // Loan Escrow ABI for apply_for_loan
      const loanEscrowAbi = [
        {
          name: 'apply_for_loan',
          type: 'function',
          inputs: [
            { name: 'loan_id', type: 'u256' },
            { name: 'proof_hash', type: 'felt252' },
            { name: 'commitment', type: 'felt252' }
          ],
          outputs: [],
          stateMutability: 'external'
        }
      ]

      // Convert loan_id to u256
      const loanIdU256 = uint256.bnToUint256(BigInt(loan.loanId))

      // CRITICAL: uint256.bnToUint256 returns hex strings, convert to decimal
      const loanIdLowDecimal = BigInt(loanIdU256.low).toString()
      const loanIdHighDecimal = BigInt(loanIdU256.high).toString()

      // Clean and truncate hex strings to fit in felt252 (max 252 bits = 63 hex chars)
      const cleanHex = (hexStr: string) => {
        if (!hexStr) return '0'
        const cleaned = hexStr.startsWith('0x') ? hexStr.slice(2) : hexStr
        return cleaned.slice(0, 63)
      }

      // IMPORTANT: Use SAME order as registration in Step 3
      // Step 3 registered: proof_hash=proof.commitment, commitment=proof.commitmentHash
      const proofHashHex = cleanHex(loanZkProof.commitment)
      const commitmentHex = cleanHex(loanZkProof.commitmentHash)

      const proofHashNum = BigInt('0x' + proofHashHex)
      const commitmentNum = BigInt('0x' + commitmentHex)

      console.log('📊 Application parameters:', {
        loan_id: {
          low_hex: loanIdU256.low,
          high_hex: loanIdU256.high,
          low_decimal: loanIdLowDecimal,
          high_decimal: loanIdHighDecimal
        },
        proof_hash: proofHashNum.toString(),
        commitment: commitmentNum.toString(),
        contract: LOAN_ESCROW_ADDRESS,
        note: 'Using SAME values as registered in Step 3'
      })

      // Submit transaction to blockchain
      console.log('⏳ Submitting application to blockchain...')
      toast.loading('Submitting transaction...', { id: 'apply' })

      let registerTx: any
      const applyTx = await wallet.account.execute({
        contractAddress: LOAN_ESCROW_ADDRESS,
        entrypoint: 'apply_for_loan',
        calldata: [
          loanIdLowDecimal,
          loanIdHighDecimal,
          proofHashNum.toString(),
          commitmentNum.toString()
        ]
      })

      console.log('⏳ Waiting for transaction:', applyTx.transaction_hash)
      toast.loading('Waiting for confirmation...', { id: 'apply' })

      await provider.waitForTransaction(applyTx.transaction_hash)

      console.log('✅ Application submitted on blockchain!')

      const loanAmountStrk = parseFloat(loan.amountPerBorrower) / 1e18
      const interestAmount = (loanAmountStrk * loan.interestRate) / 100
      const repaymentAmount = loanAmountStrk + interestAmount

      toast.success(
        `✅ Application submitted! Tx: ${applyTx.transaction_hash.slice(0, 10)}... | View on Voyager`,
        { id: 'apply', duration: 10000 }
      )

      console.log('🔗 View transaction on Voyager:', `https://sepolia.voyager.online/tx/${applyTx.transaction_hash}`)

      // Refresh loans list and active loans (to see if approved)
      await fetchAvailableLoans()
      await fetchMyActiveLoans()

    } catch (error: any) {
      console.error('❌ Application failed:', error)
      toast.error(
        'Application failed: ' + (error.message || 'Unknown error'),
        { id: 'apply' }
      )
    } finally {
      setIsApplying(false)
    }
  }

  /**
   * Repay Loan - ON-CHAIN IMPLEMENTATION
   */
  const repayLoan = async (loan: any) => {
    if (!wallet || !walletAddress) {
      toast.error('Please connect your wallet first')
      return
    }

    try {
      console.log('💸 Repaying loan:', loan.loanId)
      toast.loading('Preparing repayment...', { id: 'repay' })

      // DEBUG: Verify contract addresses are loaded
      console.log('🔍 Contract addresses check:', {
        LOAN_ESCROW_ADDRESS,
        STRK_TOKEN_ADDRESS,
        escrowDefined: !!LOAN_ESCROW_ADDRESS,
        strkDefined: !!STRK_TOKEN_ADDRESS
      })

      if (!LOAN_ESCROW_ADDRESS || !STRK_TOKEN_ADDRESS) {
        throw new Error('Contract addresses not loaded. Please check your environment configuration.')
      }

      const provider = new RpcProvider({ nodeUrl: RPC_URL })

      // Calculate repayment amount (amount is in wei already from backend)
      const principalWei = BigInt(loan.amount)
      const interestRateBps = BigInt(loan.interestRate)
      const interestWei = (principalWei * interestRateBps) / BigInt(10000)
      const repaymentWei = principalWei + interestWei

      console.log('💰 Repayment breakdown:')
      console.log('  Principal:', (Number(principalWei) / 1e18).toFixed(4), 'STRK')
      console.log('  Interest:', (Number(interestWei) / 1e18).toFixed(4), 'STRK')
      console.log('  Total:', (Number(repaymentWei) / 1e18).toFixed(4), 'STRK')

      // 1. Approve STRK tokens
      console.log('📝 Approving STRK spending...')
      toast.loading('Step 1/2: Approving STRK tokens...', { id: 'repay' })

      const amountUint256 = uint256.bnToUint256(repaymentWei)

      console.log('📤 APPROVE TRANSACTION DETAILS:', {
        tokenAddress: STRK_TOKEN_ADDRESS,
        spender: LOAN_ESCROW_ADDRESS,
        amount_low: amountUint256.low.toString(),
        amount_high: amountUint256.high.toString()
      })

      const approveTx = await wallet.account.execute({
        contractAddress: STRK_TOKEN_ADDRESS,
        entrypoint: 'approve',
        calldata: [
          LOAN_ESCROW_ADDRESS,
          amountUint256.low.toString(),
          amountUint256.high.toString()
        ]
      })

      console.log('⏳ Waiting for approval tx:', approveTx.transaction_hash)
      await provider.waitForTransaction(approveTx.transaction_hash)
      console.log('✅ STRK spending approved!')

      // 2. Call repay_loan on contract
      console.log('💰 Calling repay_loan on contract...')
      toast.loading('Step 2/2: Submitting repayment...', { id: 'repay' })

      const loanIdU256 = uint256.bnToUint256(BigInt(loan.loanId))

      // IMPORTANT: Use the commitment that was used when applying for the loan
      // This should come from the loan object returned by the backend
      console.log('🔍 FULL Loan object for repayment:', JSON.stringify(loan, null, 2))
      console.log('🔍 Available commitment fields:', {
        loan_commitment: loan.commitment,
        loan_borrowerCommitment: loan.borrowerCommitment,
        loan_identityCommitment: loan.identityCommitment,
        zkProof_commitment: loanZkProof?.commitment,
        zkProof_commitmentHash: loanZkProof?.commitmentHash
      })

      // CRITICAL: The loan object from backend contains the actual commitment used in the contract
      // This MUST match what was stored when the lender approved the loan
      let borrowerCommitment = loan.commitment
      
      if (!borrowerCommitment) {
        console.error('❌ No commitment found in loan object!')
        console.error('❌ Loan object keys:', Object.keys(loan))
        throw new Error('Commitment not found in loan data. The loan must contain the commitment that was used when applying.')
      }

      console.log('🔑 Using commitment from loan object:', borrowerCommitment.slice(0, 20) + '...')
      console.log('🔑 Full commitment:', borrowerCommitment)
      console.log('🔑 Commitment length:', borrowerCommitment.length)

      // Clean and truncate commitment to fit felt252 (max 63 hex characters)
      const cleanHex = (hexStr: string) => {
        if (!hexStr) return '0'
        const cleaned = hexStr.startsWith('0x') ? hexStr.slice(2) : hexStr
        return cleaned.slice(0, 63) // Max 63 hex chars for felt252
      }

      const commitmentHex = cleanHex(borrowerCommitment)
      const commitmentNum = BigInt('0x' + commitmentHex)

      console.log('📤 REPAY TRANSACTION DETAILS:', {
        contractAddress: LOAN_ESCROW_ADDRESS,
        entrypoint: 'repay_loan',
        calldata: {
          loanId_low: loanIdU256.low.toString(),
          loanId_high: loanIdU256.high.toString(),
          commitment: commitmentNum.toString()
        }
      })

      const repayTx = await wallet.account.execute({
        contractAddress: LOAN_ESCROW_ADDRESS,
        entrypoint: 'repay_loan',
        calldata: [
          loanIdU256.low.toString(),
          loanIdU256.high.toString(),
          commitmentNum.toString()
        ]
      })

      console.log('⏳ Waiting for repayment tx:', repayTx.transaction_hash)
      toast.loading('Confirming repayment...', { id: 'repay' })

      await provider.waitForTransaction(repayTx.transaction_hash)

      console.log('✅ Loan repaid successfully!')

      toast.success(
        `✅ Loan repaid! Tx: ${repayTx.transaction_hash.slice(0, 10)}...`,
        { id: 'repay', duration: 10000 }
      )

      console.log('🔗 View transaction on Voyager:', `https://sepolia.voyager.online/tx/${repayTx.transaction_hash}`)

      // Refresh active loans list
      await fetchMyActiveLoans()
      await fetchAvailableLoans()

    } catch (error: any) {
      console.error('❌ Repayment failed:', error)
      console.error('❌ Full error object:', JSON.stringify(error, null, 2))
      
      // Check if it's a deadline issue
      const deadlineDate = new Date(loan.repaymentDeadline)
      const now = new Date()
      const isPastDeadline = now > deadlineDate
      
      console.log('⏰ Deadline check:', {
        deadline: deadlineDate.toISOString(),
        now: now.toISOString(),
        isPastDeadline,
        timeLeft: deadlineDate.getTime() - now.getTime()
      })
      
      if (isPastDeadline) {
        toast.error(
          `⚠️ Repayment deadline has passed! Deadline was ${deadlineDate.toLocaleString()}. Your identity may now be revealed.`,
          { id: 'repay', duration: 12000 }
        )
        return
      }
      
      // Parse contract error
      let errorMessage = 'Unknown error'
      
      if (error.message?.includes('User abort')) {
        // Check if wallet shows contract error
        if (error.message?.includes('Loan not active')) {
          errorMessage = 'Loan not active. It may have been repaid already or cancelled.'
        } else if (error.message?.includes('multicall-failed')) {
          errorMessage = 'Transaction rejected by contract. Check deadline and loan status.'
        } else {
          errorMessage = 'Transaction rejected by user'
        }
      } else if (error.message) {
        errorMessage = error.message
      }
      
      toast.error(
        'Repayment failed: ' + errorMessage,
        { id: 'repay', duration: 10000 }
      )
    }
  }

  return (
    <main className="bg-gradient-to-br from-neutral-900 via-neutral-950 to-black text-white min-h-screen pt-20">
      <Toaster position="top-right" />

      {/* Header */}
      <section className="relative z-10 px-4 sm:px-6 lg:px-8 py-8 border-b border-white/20 bg-neutral-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button asChild variant="ghost" size="icon" className="rounded-full hover:bg-white/10">
                <Link href="/">
                  <ArrowLeft className="w-5 h-5" />
                </Link>
              </Button>
              <div>
                <h1 className="text-3xl font-black text-white">Borrower Portal</h1>
                <p className="text-white/70 mt-1">Get loans with privacy-preserving ZK proofs</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {walletAddress ? (
                <>
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30 px-4 py-2 text-sm font-mono">
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </Badge>
                  <Button
                    onClick={handleDisconnect}
                    className="bg-red-600 hover:bg-red-700 text-white font-medium px-6 py-2 rounded-lg shadow-lg border-0"
                  >
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleConnectStarkNet}
                  disabled={isConnecting}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-full text-white font-medium"
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
          {walletAddress ? (
            <Tabs value={currentStep} onValueChange={(v) => setCurrentStep(v as any)}>
              <TabsList className="grid w-full grid-cols-4 mb-8 bg-neutral-800/50 p-2 rounded-lg border border-white/10">
                <TabsTrigger 
                  value="analyze"
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white/70 font-medium"
                >
                  1. Analyze
                </TabsTrigger>
                <TabsTrigger 
                  value="identity" 
                  disabled={activityScore === 0}
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white/70 font-medium disabled:opacity-50"
                >
                  2. Identity
                </TabsTrigger>
                <TabsTrigger 
                  value="loanProof" 
                  disabled={!identityVerified}
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white/70 font-medium disabled:opacity-50"
                >
                  3. Loan Proof
                </TabsTrigger>
                <TabsTrigger 
                  value="dashboard" 
                  disabled={!loanZkProof}
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white/70 font-medium disabled:opacity-50"
                >
                  Dashboard
                </TabsTrigger>
              </TabsList>

              {/* STEP 1: Analyze Activity */}
              <TabsContent value="analyze">
                <Card className="bg-neutral-900/80 border-white/10 p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <Activity className="w-6 h-6 text-blue-500" />
                    <h2 className="text-2xl font-bold text-white">Wallet Activity Analysis</h2>
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
                    <h2 className="text-2xl font-bold text-white">Identity Verification</h2>
                  </div>

                  {identityVerified ? (
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
                  ) : (
                    <div className="space-y-6 max-w-2xl mx-auto">
                      <p className="text-white/60 text-center">
                        Upload your identity document to verify your identity with zero-knowledge proofs
                      </p>

                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="passportNumber" className="text-white font-medium">Passport/ID Number</Label>
                          <Input
                            id="passportNumber"
                            value={passportNumber}
                            onChange={(e) => setPassportNumber(e.target.value)}
                            placeholder="Enter passport or ID number"
                            className="bg-neutral-800 border-white/10 text-white placeholder:text-white/40"
                          />
                        </div>

                        <div>
                          <Label htmlFor="address" className="text-white font-medium">Address</Label>
                          <Input
                            id="address"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="Enter your address"
                            className="bg-neutral-800 border-white/10 text-white placeholder:text-white/40"
                          />
                        </div>

                        <div>
                          <Label htmlFor="dob" className="text-white font-medium">Date of Birth</Label>
                          <Input
                            id="dob"
                            type="date"
                            value={dateOfBirth}
                            onChange={(e) => setDateOfBirth(e.target.value)}
                            placeholder="dd-mm-yyyy"
                            className="bg-neutral-800 border-white/10 text-white placeholder:text-white/40"
                          />
                        </div>

                        <div>
                          <Label htmlFor="document" className="text-white font-medium">Document Photo</Label>
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
                              accept="image/jpeg,image/jpg,image/png,application/pdf"
                              onChange={handleFileChange}
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
                            Verifying...
                          </>
                        ) : (
                          <>
                            <Shield className="w-4 h-4 mr-2" />
                            Verify Identity
                          </>
                        )}
                      </Button>

                      <p className="text-xs text-white/40 text-center">
                        Your identity data is encrypted and used only for ZK proof generation
                      </p>
                    </div>
                  )}
                </Card>
              </TabsContent>

              {/* STEP 3: Generate Loan Application ZK Proof */}
              <TabsContent value="loanProof">
                <Card className="bg-neutral-900/80 border-white/10 p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <Shield className="w-6 h-6 text-purple-500" />
                    <h2 className="text-2xl font-bold text-white">Loan Application Proof</h2>
                  </div>

                      {loanZkProof ? (
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
                              fetchMyActiveLoans()
                            }}
                            className="w-full bg-gradient-to-r from-purple-600 to-blue-600"
                            size="lg"
                          >
                            Go to Loan Dashboard
                          </Button>
                        </div>
                      ) : (
                        <div className="text-center py-8 space-y-4">
                          <p className="text-white/60 mb-4">
                            Generate a zero-knowledge proof to apply for loans anonymously
                          </p>
                          
                          {/* Balance Warning */}
                          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
                            <div className="flex items-start gap-3">
                              <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                              <div className="text-left">
                                <h4 className="text-yellow-500 font-semibold mb-1">⚠️ STRK Tokens Required</h4>
                                <p className="text-yellow-200/80 text-sm mb-2">
                                  You need STRK tokens for gas fees to register your proof on-chain.
                                </p>
                                <a
                                  href="https://starknet-faucet.vercel.app/"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:text-blue-300 text-sm underline inline-flex items-center gap-1"
                                >
                                  Get free testnet STRK tokens →
                                </a>
                              </div>
                            </div>
                          </div>

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
                      )}
                </Card>
              </TabsContent>

              {/* DASHBOARD: Browse and Apply for Loans */}
              <TabsContent value="dashboard">
                <div className="space-y-6">
                  {/* MY ACTIVE LOANS SECTION - Always visible */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-green-400">💰 My Active Loans</h2>
                        <p className="text-white/60 text-sm mt-1">
                          {myActiveLoans.length > 0 
                            ? 'Loans you\'ve been approved for - remember to repay before deadline!'
                            : 'No active loans yet. Apply for loans below and wait for lender approval.'}
                        </p>
                      </div>
                      <Button
                        onClick={fetchMyActiveLoans}
                        disabled={isLoadingActiveLoans}
                        variant="outline"
                        className="border-green-500/30 bg-green-500/20 text-black hover:bg-green-500/30 hover:text-black font-medium"
                      >
                        {isLoadingActiveLoans ? (
                          <Loader2 className="w-4 h-4 animate-spin text-black" />
                        ) : (
                          'Check for Updates'
                        )}
                      </Button>
                    </div>

                    {myActiveLoans.length > 0 ? (
                      <div className="grid grid-cols-1 gap-4">
                        {myActiveLoans.map((loan) => (
                          <ActiveLoanCard key={loan.loanId} loan={loan} onRepay={repayLoan} />
                        ))}
                      </div>
                    ) : (
                      <Card className="bg-neutral-800/30 border-white/10 p-8 text-center">
                        <p className="text-white/40 mb-3">
                          ℹ️ Once a lender approves your application, your loan will appear here.
                        </p>
                        <p className="text-white/30 text-sm">
                          Click "Check for Updates" to refresh this section.
                        </p>
                      </Card>
                    )}
                  </div>

                  {/* AVAILABLE LOANS SECTION */}
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-white">Available Loan Offers</h2>
                    <Button
                      onClick={() => {
                        fetchAvailableLoans()
                        fetchMyActiveLoans()
                      }}
                      disabled={isLoadingLoans}
                      variant="outline"
                      className="border-blue-500/30 bg-blue-500/20 text-black hover:bg-blue-500/30 hover:text-black font-medium"
                    >
                      {isLoadingLoans ? (
                        <Loader2 className="w-4 h-4 animate-spin text-black" />
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
          ) : (
            <div className="text-center py-20">
              <Wallet className="w-12 h-12 mx-auto mb-4 text-white/40" />
              <p className="text-white/60">Connect your wallet to view available loans</p>
            </div>
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
  const eligibility = activityScoreCalculator.checkLoanEligibility(activityScore, loan.minActivityScore)
  const loanAmountStrk = parseFloat(loan.amountPerBorrower) / 1e18
  const interestAmount = (loanAmountStrk * loan.interestRate) / 100
  const repaymentAmount = loanAmountStrk + interestAmount

  return (
    <Card className="bg-neutral-900/80 border-white/10 overflow-hidden">
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-bold text-white">Loan #{loan.loanId}</h3>
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            {loan.filledSlots}/{loan.totalSlots} Slots
          </Badge>
        </div>
        <p className="text-white/60 text-sm font-mono">
          Lender: {loan.lender.slice(0, 10)}...{loan.lender.slice(-8)}
        </p>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-neutral-800/50 rounded-lg p-4 border border-white/5">
            <p className="text-xs text-white/70 mb-1 font-medium">Loan Amount</p>
            <p className="text-2xl font-bold text-white">{loanAmountStrk.toFixed(2)} STRK</p>
          </div>
          <div className="bg-neutral-800/50 rounded-lg p-4 border border-white/5">
            <p className="text-xs text-white/70 mb-1 font-medium">Interest Rate</p>
            <p className="text-2xl font-bold text-white">{loan.interestRate}%</p>
          </div>
          <div className="bg-neutral-800/50 rounded-lg p-4 border border-white/5">
            <p className="text-xs text-white/70 mb-1 font-medium">Repayment</p>
            <p className="text-2xl font-bold text-white">{repaymentAmount.toFixed(2)} STRK</p>
          </div>
          <div className="bg-neutral-800/50 rounded-lg p-4 border border-white/5">
            <p className="text-xs text-white/70 mb-1 font-medium">Duration</p>
            <p className="text-2xl font-bold text-white">{loan.repaymentPeriod.toLocaleString()} sec</p>
          </div>
        </div>

        <Card className="bg-blue-500/10 border-blue-500/30 p-4 mb-4">
          <h4 className="text-sm font-semibold text-blue-400 mb-3">Requirements</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/70">Minimum Score</span>
              <span className="text-sm font-bold text-white">{loan.minActivityScore}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/70">Your Score</span>
              <span
                className={`text-sm font-bold ${eligibility.eligible ? 'text-green-400' : 'text-red-400'}`}
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
          disabled={!eligibility.eligible || isApplying || loan.filledSlots >= loan.totalSlots}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 disabled:opacity-50"
          size="lg"
        >
          {isApplying ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Applying...
            </>
          ) : loan.filledSlots >= loan.totalSlots ? (
            'Loan Full'
          ) : (
            `Apply for ${loanAmountStrk.toFixed(2)} STRK`
          )}
        </Button>
      </div>
    </Card>
  )
}

// Active Loan Card Component (for approved loans)
function ActiveLoanCard({ loan, onRepay }: { loan: any; onRepay: (loan: any) => void }) {
  const loanAmountStrk = parseFloat(loan.amount) / 1e18
  const interestRateBps = parseFloat(loan.interestRate)
  const interestRate = interestRateBps / 100 // Convert basis points to percentage
  const interestAmount = (loanAmountStrk * interestRate) / 100
  const repaymentAmount = loanAmountStrk + interestAmount

  const approvedDate = new Date(loan.approvedAt)
  const deadlineDate = new Date(loan.repaymentDeadline)
  const now = new Date()
  const timeLeft = deadlineDate.getTime() - now.getTime()
  const daysLeft = Math.ceil(timeLeft / (1000 * 60 * 60 * 24))
  const hoursLeft = Math.ceil(timeLeft / (1000 * 60 * 60))

  return (
    <Card className="bg-neutral-900/80 border-green-500/30 overflow-hidden">
      <div className="bg-green-500/10 p-6 border-b border-green-500/30">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-bold text-green-400">💰 Active Loan #{loan.loanId}</h3>
          <Badge className="bg-green-500/20 text-green-300 border-green-500/40">
            Approved & Funded
          </Badge>
        </div>
        <p className="text-white/70 text-sm font-mono">
          Lender: {loan.lender.slice(0, 10)}...{loan.lender.slice(-8)}
        </p>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-neutral-800/50 rounded-lg p-4 border border-green-500/20">
            <p className="text-xs text-white/70 mb-1 font-medium">Received Amount</p>
            <p className="text-2xl font-bold text-green-400">{loanAmountStrk.toFixed(2)} STRK</p>
          </div>
          <div className="bg-neutral-800/50 rounded-lg p-4 border border-yellow-500/20">
            <p className="text-xs text-white/70 mb-1 font-medium">Must Repay</p>
            <p className="text-2xl font-bold text-yellow-400">{repaymentAmount.toFixed(2)} STRK</p>
          </div>
          <div className="bg-neutral-800/50 rounded-lg p-4 border border-blue-500/20">
            <p className="text-xs text-white/70 mb-1 font-medium">Interest</p>
            <p className="text-2xl font-bold text-blue-400">{interestRate.toFixed(1)}%</p>
          </div>
        </div>

        <Card className={`${daysLeft <= 1 ? 'bg-red-500/10 border-red-500/30' : 'bg-orange-500/10 border-orange-500/30'} p-4 mb-4`}>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-white">
            ⏰ Repayment Deadline
          </h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/70">Approved On</span>
              <span className="text-sm font-bold text-white">
                {approvedDate.toLocaleDateString()} {approvedDate.toLocaleTimeString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/70">Deadline</span>
              <span className={`text-sm font-bold ${daysLeft <= 1 ? 'text-red-400' : 'text-orange-400'}`}>
                {deadlineDate.toLocaleDateString()} {deadlineDate.toLocaleTimeString()}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <span className="text-sm text-white/70">Time Remaining</span>
              <span className={`text-lg font-bold ${daysLeft <= 1 ? 'text-red-400' : 'text-orange-400'}`}>
                {daysLeft > 0 ? `${daysLeft} day${daysLeft > 1 ? 's' : ''}` : `${hoursLeft} hour${hoursLeft > 1 ? 's' : ''}`}
              </span>
            </div>
          </div>
        </Card>

        {daysLeft <= 1 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <p className="text-sm font-semibold text-red-400">
                ⚠️ URGENT: Repayment due soon! Repay now to avoid default.
              </p>
            </div>
          </div>
        )}

        <Button
          className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700"
          size="lg"
          onClick={() => onRepay(loan)}
        >
          Repay {repaymentAmount.toFixed(2)} STRK
        </Button>

        <p className="text-xs text-white/40 text-center mt-3">
          This will approve STRK tokens and repay your loan
        </p>
      </div>
    </Card>
  )
}
