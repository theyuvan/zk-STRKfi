/**
 * Wallet and Loan Management Hook for Real Frontend
 * Provides complete integration with backend API
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { connectWallet, disconnectWallet, getWalletState } from '@/lib/wallet'
import { connectMetaMask, onAccountsChanged, onChainChanged, removeListeners } from '@/lib/ethereum-wallet'
import { loanApi, activityApi, proofApi, identityApi } from '@/lib/services/api'
import StarkNetService from '@/lib/services/starknet'
import { analyzeWalletActivity, getActivityScore } from '@/lib/services/activityAnalyzer'
import toast from 'react-hot-toast'

export interface WalletInfo {
  address: string
  type: 'starknet' | 'ethereum' | null
  balance: string
  isConnected: boolean
}

export interface ActivityData {
  score: number
  totalTransactions: number
  sentTransactions: any[]
  receivedTransactions: any[]
  totalVolume: string
}

export interface ZKProofData {
  commitment: string
  proofHash: string
  activityScore: number
  proof?: any
  publicSignals?: any[]
}

export interface LoanOffer {
  loanId: string
  lender: string
  loanAmount: string
  numberOfBorrowers: number
  currentBorrowers: number
  interestRate: number
  repaymentPeriod: number
  isActive: boolean
  minActivityScore: number
}

export interface LoanApplication {
  loanId: string
  borrower: string
  commitment: string
  activityScore: number
  loanAmount: string
  approvalTime: number
  repaymentDeadline: string
  repaid: boolean
  identityRevealed: boolean
}

export function useWalletAndLoans() {
  // Wallet state
  const [wallet, setWallet] = useState<WalletInfo>({
    address: '',
    type: null,
    balance: '0',
    isConnected: false
  })

  // Activity state
  const [activityData, setActivityData] = useState<ActivityData | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // ZK Proof state
  const [zkProof, setZkProof] = useState<ZKProofData | null>(null)
  const [isGeneratingProof, setIsGeneratingProof] = useState(false)

  // Identity state
  const [identityCommitment, setIdentityCommitment] = useState<string | null>(null)
  const [identityVerified, setIdentityVerified] = useState(false)

  // Loans state
  const [availableLoans, setAvailableLoans] = useState<LoanOffer[]>([])
  const [myApplications, setMyApplications] = useState<LoanApplication[]>([])
  const [myLoans, setMyLoans] = useState<LoanOffer[]>([])
  const [loading, setLoading] = useState(false)

  const starknetService = new StarkNetService()

  // Load saved data from localStorage on mount
  useEffect(() => {
    const savedIdentityCommitment = localStorage.getItem('identityCommitment')
    const savedIdentityVerified = localStorage.getItem('identityVerified')
    
    if (savedIdentityCommitment && savedIdentityVerified === 'true') {
      setIdentityCommitment(savedIdentityCommitment)
      setIdentityVerified(true)
    }

    const savedCommitment = localStorage.getItem('zkCommitment')
    const savedProofHash = localStorage.getItem('zkProofHash')
    const savedActivityScore = localStorage.getItem('zkActivityScore')
    
    if (savedCommitment && savedProofHash && savedActivityScore) {
      setZkProof({
        commitment: savedCommitment,
        proofHash: savedProofHash,
        activityScore: parseInt(savedActivityScore)
      })
    }
  }, [])

  // Listen for MetaMask account changes
  useEffect(() => {
    if (wallet.type === 'ethereum') {
      onAccountsChanged((accounts) => {
        if (accounts.length === 0) {
          handleDisconnect()
        } else {
          setWallet((prev: WalletInfo) => ({ ...prev, address: accounts[0] }))
        }
      })

      onChainChanged(() => {
        window.location.reload()
      })
    }

    return () => {
      removeListeners()
    }
  }, [wallet.type])

  /**
   * Connect StarkNet wallet
   */
  const handleConnectStarkNet = useCallback(async () => {
    try {
      const walletState = await connectWallet()
      
      if (walletState.address) {
        setWallet({
          address: walletState.address,
          type: 'starknet',
          balance: '0',
          isConnected: true
        })

        // Fetch balance
        const balanceData = await starknetService.fetchStrkBalance(walletState.address)
        setWallet((prev: WalletInfo) => ({ ...prev, balance: balanceData.formatted }))

        toast.success('Wallet connected!')
      }
    } catch (error: any) {
      console.error('Failed to connect wallet:', error)
      toast.error(error.message || 'Failed to connect wallet')
    }
  }, [])

  /**
   * Connect MetaMask wallet
   */
  const handleConnectMetaMask = useCallback(async () => {
    try {
      const walletState = await connectMetaMask()
      
      if (walletState.address) {
        setWallet({
          address: walletState.address,
          type: 'ethereum',
          balance: '0',
          isConnected: true
        })

        toast.success('MetaMask connected!')
      }
    } catch (error: any) {
      console.error('Failed to connect MetaMask:', error)
      toast.error(error.message || 'Failed to connect MetaMask')
    }
  }, [])

  /**
   * Disconnect wallet
   */
  const handleDisconnect = useCallback(async () => {
    try {
      if (wallet.type === 'starknet') {
        await disconnectWallet()
      }
      
      setWallet({
        address: '',
        type: null,
        balance: '0',
        isConnected: false
      })

      toast.success('Wallet disconnected')
    } catch (error: any) {
      console.error('Failed to disconnect:', error)
      toast.error('Failed to disconnect wallet')
    }
  }, [wallet.type])

  /**
   * Analyze wallet activity
   */
  const analyzeActivity = useCallback(async () => {
    if (!wallet.address) {
      toast.error('Please connect your wallet first')
      return
    }

    setIsAnalyzing(true)
    try {
      const data = await activityApi.getActivityData(wallet.address)
      setActivityData(data)
      toast.success('Activity analysis complete!')
      return data
    } catch (error: any) {
      console.error('Activity analysis failed:', error)
      toast.error('Failed to analyze wallet activity')
    } finally {
      setIsAnalyzing(false)
    }
  }, [wallet.address])

  /**
   * Generate ZK proof for activity
   */
  const generateZKProof = useCallback(async (activityScore?: number) => {
    if (!wallet.address) {
      toast.error('Please connect your wallet first')
      return
    }

    const score = activityScore || activityData?.score
    if (!score) {
      toast.error('Please analyze your activity first')
      return
    }

    setIsGeneratingProof(true)
    const toastId = toast.loading('Generating ZK proof...')

    try {
      // Step 1: Prepare proof inputs
      const threshold = 50 // Minimum required score
      const inputs = await proofApi.prepareProofInputs(score, threshold)
      
      toast.loading('Generating proof...', { id: toastId })

      // Step 2: Generate proof
      const proofResult = await proofApi.generateProof(score, threshold, inputs.salt)
      
      toast.loading('Hashing proof...', { id: toastId })

      // Step 3: Hash the proof
      const { hash: proofHash } = await proofApi.hashProof(
        proofResult.proof,
        proofResult.publicSignals
      )

      const zkData: ZKProofData = {
        commitment: inputs.commitment,
        proofHash,
        activityScore: score,
        proof: proofResult.proof,
        publicSignals: proofResult.publicSignals
      }

      // Save to localStorage
      localStorage.setItem('zkCommitment', inputs.commitment)
      localStorage.setItem('zkProofHash', proofHash)
      localStorage.setItem('zkActivityScore', score.toString())

      setZkProof(zkData)
      toast.success('ZK proof generated successfully!', { id: toastId })
      return zkData
    } catch (error: any) {
      console.error('ZK proof generation failed:', error)
      toast.error('Failed to generate ZK proof', { id: toastId })
    } finally {
      setIsGeneratingProof(false)
    }
  }, [wallet.address, activityData])

  /**
   * Verify identity document
   */
  const verifyIdentity = useCallback(async (formData: FormData) => {
    if (!wallet.address) {
      toast.error('Please connect your wallet first')
      return
    }

    const toastId = toast.loading('Verifying identity...')
    try {
      formData.append('walletAddress', wallet.address)
      const result = await identityApi.verifyDocument(formData)
      
      // Save to localStorage
      localStorage.setItem('identityCommitment', result.commitment)
      localStorage.setItem('identityVerified', 'true')

      setIdentityCommitment(result.commitment)
      setIdentityVerified(true)

      toast.success('Identity verified successfully!', { id: toastId })
      return result
    } catch (error: any) {
      console.error('Identity verification failed:', error)
      toast.error('Failed to verify identity', { id: toastId })
    }
  }, [wallet.address])

  /**
   * Fetch available loans
   */
  const fetchAvailableLoans = useCallback(async () => {
    setLoading(true)
    try {
      const loans = await loanApi.getAvailableLoans()
      setAvailableLoans(loans)
      return loans
    } catch (error: any) {
      console.error('Failed to fetch loans:', error)
      toast.error('Failed to fetch available loans')
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Fetch my applications (borrower)
   */
  const fetchMyApplications = useCallback(async () => {
    if (!zkProof?.commitment) {
      return []
    }

    setLoading(true)
    try {
      const applications = await loanApi.getBorrowerApplications(zkProof.commitment)
      setMyApplications(applications)
      return applications
    } catch (error: any) {
      console.error('Failed to fetch applications:', error)
      toast.error('Failed to fetch your applications')
    } finally {
      setLoading(false)
    }
  }, [zkProof])

  /**
   * Fetch my loans (lender)
   */
  const fetchMyLoans = useCallback(async () => {
    if (!wallet.address) {
      return []
    }

    setLoading(true)
    try {
      const loans = await loanApi.getLenderLoans(wallet.address)
      setMyLoans(loans)
      return loans
    } catch (error: any) {
      console.error('Failed to fetch loans:', error)
      toast.error('Failed to fetch your loans')
    } finally {
      setLoading(false)
    }
  }, [wallet.address])

  return {
    // Wallet
    wallet,
    handleConnectStarkNet,
    handleConnectMetaMask,
    handleDisconnect,
    
    // Activity
    activityData,
    isAnalyzing,
    analyzeActivity,
    
    // ZK Proof
    zkProof,
    isGeneratingProof,
    generateZKProof,
    
    // Identity
    identityCommitment,
    identityVerified,
    verifyIdentity,
    
    // Loans
    availableLoans,
    myApplications,
    myLoans,
    loading,
    fetchAvailableLoans,
    fetchMyApplications,
    fetchMyLoans,
    
    // Services
    starknetService
  }
}
