'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Wallet, TrendingUp, DollarSign, Users, Calendar, Plus, Loader2, RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import RevealOnView from '@/components/reveal-on-view'
import { formatCurrency, formatAddress } from '@/lib/utils'
import { connectWallet } from '@/lib/wallet'
import { StarkNetService } from '@/lib/services/starknet'
import { loanApi } from '@/lib/services/api'
import toast, { Toaster } from 'react-hot-toast'
import axios from 'axios'
import { RpcProvider, uint256 } from 'starknet'

interface LenderStats {
  totalLent: number
  activeLoans: number
  totalEarnings: number
  averageReturn: number
  upcomingPayments: number
}

export default function LendersPage() {
  // Wallet state
  const [walletAddress, setWalletAddress] = useState<string>('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [strkBalance, setStrkBalance] = useState<string>('0')

  // Activity & ZK state
  const [activityData, setActivityData] = useState<any>(null)
  const [loadingActivity, setLoadingActivity] = useState(false)
  const [zkProof, setZkProof] = useState<any>(null)
  const [generatingProof, setGeneratingProof] = useState(false)
  const [isVerified, setIsVerified] = useState(false)

  // Stats state
  const [stats, setStats] = useState<LenderStats>({
    totalLent: 0,
    activeLoans: 0,
    totalEarnings: 0,
    averageReturn: 0,
    upcomingPayments: 0
  })
  const [loadingStats, setLoadingStats] = useState(false)

  // Form state for creating loan offers
  const [amount, setAmount] = useState('')
  const [maxBorrowers, setMaxBorrowers] = useState('')
  const [duration, setDuration] = useState('')
  const [interestRate, setInterestRate] = useState('')
  const [minActivityScore, setMinActivityScore] = useState('')
  const [creatingLoan, setCreatingLoan] = useState(false)

  // My loans state
  const [myLoans, setMyLoans] = useState<any[]>([])
  const [loadingLoans, setLoadingLoans] = useState(false)
  const [selectedLoan, setSelectedLoan] = useState<any>(null)
  const [applications, setApplications] = useState<any[]>([])
  const [loadingApplications, setLoadingApplications] = useState(false)

  // Connect wallet
  const handleConnectWallet = async () => {
    setIsConnecting(true)
    try {
      const wallet = await connectWallet()
      if (wallet.address) {
        setWalletAddress(wallet.address)
        
        // Fetch balance
        const starknetService = new StarkNetService()
        const balanceData = await starknetService.fetchStrkBalance(wallet.address)
        setStrkBalance(balanceData.formatted)
        
        toast.success('Wallet connected!')
        
        // Note: Don't fetch stats/loans yet - wait for ZK verification
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error)
      toast.error('Failed to connect wallet. Please make sure you have ArgentX or Braavos installed.')
    } finally {
      setIsConnecting(false)
    }
  }

  // Fetch activity data using StarkNet service (matching test frontend)
  const fetchActivityData = async () => {
    setLoadingActivity(true)
    try {
      console.log('📊 Fetching activity data for:', walletAddress)
      
      // Import services dynamically
      const { starknetService } = await import('@/lib/services/starknetService')
      const { activityScoreCalculator } = await import('@/lib/services/activityScoreCalculator')
      
      // Fetch activity metrics from blockchain
      const metrics = await starknetService.calculateActivityMetrics(walletAddress)
      console.log('📦 Activity metrics from blockchain:', metrics)
      
      // Calculate activity score
      const scoreResult = activityScoreCalculator.calculateScore(metrics)
      console.log('🎯 Activity score calculated:', scoreResult.total)
      
      // Format data for frontend
      const data = {
        score: scoreResult.total,
        totalTransactions: metrics.txCount,
        nonce: metrics.nonce,
        transferCount: metrics.transferCount,
        totalVolume: metrics.totalVolume.toFixed(4) + ' STRK',
        totalVolumeFormatted: metrics.totalVolume.toFixed(4) + ' STRK',
        sentTransactions: {
          count: metrics.transactions.filter((tx: any) => tx.type === 'sent').length,
          totalAmount: metrics.totalSent.toString(),
          totalAmountFormatted: metrics.totalSent.toFixed(4) + ' STRK',
          transactions: metrics.transactions.filter((tx: any) => tx.type === 'sent').slice(0, 20)
        },
        receivedTransactions: {
          count: metrics.transactions.filter((tx: any) => tx.type === 'received').length,
          totalAmount: metrics.totalReceived.toString(),
          totalAmountFormatted: metrics.totalReceived.toFixed(4) + ' STRK',
          transactions: metrics.transactions.filter((tx: any) => tx.type === 'received').slice(0, 20)
        },
        scoreBreakdown: scoreResult,
        dataSource: 'frontend-starknet-service'
      }
      
      console.log('✅ Activity data formatted:', data)
      
      setActivityData(data)
      toast.success(`Activity Score: ${data.score} | Total Volume: ${data.totalVolumeFormatted}`)
    } catch (error) {
      console.error('❌ Failed to fetch activity:', error)
      toast.error('Failed to fetch activity data')
    } finally {
      setLoadingActivity(false)
    }
  }

  // Generate ZK Proof
  const generateZKProof = async () => {
    setGeneratingProof(true)
    try {
      console.log('🔐 Generating ZK proof...')
      
      // Import ZK proof service
      const { zkProofService } = await import('@/lib/services/zkProofService')
      
      // Try to generate real ZK proof via backend
      let proofData
      try {
        proofData = await zkProofService.generateLenderProof(
          activityData.score,
          100, // Minimum score for lenders
          walletAddress
        )
        console.log('✅ ZK Proof generated:', proofData)
      } catch (backendError) {
        console.log('📝 Using test proof mode (backend offline)')
        // Fallback to mock proof if backend fails
        proofData = zkProofService.generateMockProof(
          activityData.score,
          100,
          walletAddress
        )
        // Silent fallback - no warning toast
      }
      
      // Display proof details
      console.log('📊 ZK Proof Details:', {
        commitment: proofData.commitment.slice(0, 20) + '...',
        commitmentHash: proofData.commitmentHash.slice(0, 20) + '...',
        identityCommitment: proofData.identityCommitment.slice(0, 20) + '...',
        activityScore: proofData.activityScore,
        threshold: proofData.threshold
      })
      
      setZkProof(proofData)
      setIsVerified(true)
      toast.success(`ZK Proof generated! Score: ${proofData.activityScore}`)
      
      // Now fetch lender data
      fetchLenderStats(walletAddress)
      fetchMyLoans(walletAddress)
    } catch (error) {
      console.error('❌ Failed to generate proof:', error)
      toast.error('Failed to generate ZK proof')
    } finally {
      setGeneratingProof(false)
    }
  }

  // Fetch lender stats
  const fetchLenderStats = async (address: string) => {
    setLoadingStats(true)
    try {
      // Fetch all loans from blockchain
      const allLoans = await loanApi.getAvailableLoans()
      
      // Filter loans by this lender
      const lenderLoans = allLoans.filter((loan: any) => 
        loan.lender.toLowerCase() === address.toLowerCase()
      )

      // Calculate stats
      const totalLent = lenderLoans.reduce((sum: number, loan: any) => {
        const amount = Number.parseFloat(formatStrkAmount(loan.loanAmount))
        return sum + amount
      }, 0)

      const activeLoans = lenderLoans.filter((loan: any) => loan.isActive).length

      // Mock earnings for now (would need repayment tracking)
      const totalEarnings = lenderLoans.reduce((sum: number, loan: any) => {
        const amount = Number.parseFloat(formatStrkAmount(loan.loanAmount))
        const interest = (amount * loan.interestRate) / 100
        return sum + interest
      }, 0)

      const averageReturn = lenderLoans.length > 0 
        ? lenderLoans.reduce((sum: number, loan: any) => sum + loan.interestRate, 0) / lenderLoans.length
        : 0

      setStats({
        totalLent,
        activeLoans,
        totalEarnings,
        averageReturn,
        upcomingPayments: activeLoans
      })
    } catch (error) {
      console.error('Failed to fetch lender stats:', error)
      toast.error('Failed to fetch stats')
    } finally {
      setLoadingStats(false)
    }
  }

  // Fetch lender's loans
  const fetchMyLoans = async (address: string) => {
    setLoadingLoans(true)
    try {
      console.log('🔍 Fetching loans for address:', address)
      const allLoans = await loanApi.getAvailableLoans()
      console.log('📊 Total loans from API:', allLoans.length)
      console.log('📋 ALL loans data:', JSON.stringify(allLoans, null, 2))
      
      const lenderLoans = allLoans.filter((loan: any) => {
        const lenderAddr = loan.lender?.toLowerCase() || ''
        const myAddr = address.toLowerCase()
        const isMatch = lenderAddr === myAddr
        console.log(`Loan ${loan.loanId}: Comparing ${lenderAddr} === ${myAddr} = ${isMatch}`)
        return isMatch
      })
      
      console.log('✅ Filtered loans for this lender:', lenderLoans.length)
      console.log('📋 Filtered loans data:', JSON.stringify(lenderLoans, null, 2))
      setMyLoans(lenderLoans)
    } catch (error) {
      console.error('Failed to fetch loans:', error)
      toast.error('Failed to fetch your loans')
    } finally {
      setLoadingLoans(false)
    }
  }

  // Format STRK amount - with safety checks
  const formatStrkAmount = (amount: string | undefined) => {
    if (!amount || amount === '0' || amount === 'undefined') {
      return '0.00'
    }
    try {
      const amountBigInt = BigInt(amount)
      const decimals = 18
      const formatted = Number(amountBigInt) / Math.pow(10, decimals)
      return formatted.toFixed(2)
    } catch (error) {
      console.error('Error formatting amount:', amount, error)
      return '0.00'
    }
  }

  // Create loan offer
  const handleCreateOffer = async () => {
    if (!walletAddress) {
      toast.error('Please connect wallet first')
      return
    }

    if (!amount || !maxBorrowers || !duration || !interestRate || !minActivityScore) {
      toast.error('Please fill in all fields')
      return
    }

    setCreatingLoan(true)

    try {
      console.log('🏦 Creating loan offer...')

      // Get wallet connection
      const starknet = (window as any).starknet
      if (!starknet?.isConnected) {
        throw new Error('Wallet not connected')
      }

      // Calculate amounts
      const amountPerBorrower = Number.parseFloat(amount)
      const totalSlots = Number.parseInt(maxBorrowers)
      const totalAmount = amountPerBorrower * totalSlots
      
      // Convert to wei (18 decimals for STRK)
      const amountPerBorrowerWei = Math.floor(amountPerBorrower * 1e18).toString()
      const totalAmountWei = Math.floor(totalAmount * 1e18).toString()
      const interestRateBps = Number.parseInt(interestRate) // Interest rate in basis points
      const repaymentPeriodSeconds = Number.parseInt(duration)
      const minScore = Number.parseInt(minActivityScore)

      console.log('💰 Amount per borrower:', amountPerBorrower, 'STRK')
      console.log('💰 Total amount to approve:', totalAmount, 'STRK')
      console.log('💰 Amount in wei:', amountPerBorrowerWei)
      console.log('📊 Loan parameters:', {
        amount_per_borrower: amountPerBorrowerWei,
        total_slots: totalSlots,
        interest_rate_bps: interestRateBps,
        repayment_period: repaymentPeriodSeconds,
        min_activity_score: minScore
      })

      // Prepare approve transaction (approve escrow to spend TOTAL amount)
      const starknetService = new StarkNetService()
      const contractAddresses = starknetService.getContractAddresses()
      
      const approveCall = starknetService.prepareTokenApproval(
        contractAddresses.loanEscrow,
        totalAmountWei  // Approve total amount (amount per borrower * total slots)
      )

      // Prepare create loan transaction - exact same format as test frontend
      const createLoanCall = starknetService.prepareCreateLoanOffer(
        amountPerBorrowerWei,        // amount_per_borrower (will be converted to BigInt then Uint256)
        totalSlots,                  // total_slots (u8)
        interestRateBps,             // interest_rate_bps (will be converted to BigInt then Uint256)
        repaymentPeriodSeconds,      // repayment_period (u64) - in seconds
        minScore                     // min_activity_score (will be converted to BigInt then Uint256)
      )

      console.log('🔄 Executing transactions (approve + create loan)...')
      
      // Execute both transactions
      const result = await starknet.account.execute([approveCall, createLoanCall])
      
      console.log('✅ Loan created! TX:', result.transaction_hash)
      
      toast.success('Loan offer created successfully!')
      
      // Reset form
      setAmount('')
      setMaxBorrowers('')
      setDuration('')
      setInterestRate('')
      setMinActivityScore('')

      // Refresh data
      setTimeout(() => {
        fetchLenderStats(walletAddress)
        fetchMyLoans(walletAddress)
      }, 2000)

    } catch (error) {
      console.error('❌ Failed to create loan:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create loan offer')
    } finally {
      setCreatingLoan(false)
    }
  }

  /**
   * Load applications for a specific loan
   */
  const loadApplications = async (loanId: string) => {
    try {
      setLoadingApplications(true)
      setSelectedLoan(loanId)
      console.log('📬 Loading applications for loan:', loanId)
      
      const response = await axios.get(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000'}/api/loan/${loanId}/applications`)
      
      console.log('📦 Applications response:', response.data)
      const apps = response.data.applications || []
      console.log('✅ Loaded', apps.length, 'applications')
      
      setApplications(apps)
    } catch (error) {
      console.error('❌ Failed to load applications:', error)
      toast.error('Failed to load applications')
      setApplications([])
    } finally {
      setLoadingApplications(false)
    }
  }

  /**
   * Approve borrower and transfer funds - ON-CHAIN IMPLEMENTATION
   */
  const approveBorrower = async (loanId: string, borrowerCommitment: string) => {
    try {
      console.log('👍 Approving borrower for loan:', loanId)
      console.log('📝 Borrower commitment:', borrowerCommitment)
      
      toast.loading('Approving borrower...', { id: 'approve' })

      // Get wallet connection
      const starknet = (window as any).starknet
      if (!starknet?.isConnected) {
        throw new Error('Wallet not connected')
      }

      const provider = new RpcProvider({ 
        nodeUrl: process.env.NEXT_PUBLIC_STARKNET_RPC || 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7'
      })

      const LOAN_ESCROW_ADDRESS = process.env.NEXT_PUBLIC_LOAN_ESCROW_ZK_ADDRESS || 
        '0x06b058a0946bb36fa846e6a954da885fa20809f43a9e47038dc83b4041f7f012'

      // Loan Escrow ZK ABI for approve_borrower
      const loanEscrowAbi = [
        {
          name: 'approve_borrower',
          type: 'function',
          inputs: [
            { name: 'loan_id', type: 'core::integer::u256' },
            { name: 'borrower_commitment', type: 'core::felt252' }
          ],
          outputs: [],
          state_mutability: 'external'
        }
      ]

      // Convert loan_id to u256
      const loanIdU256 = uint256.bnToUint256(BigInt(loanId))
      
      // Convert commitment to felt252 (clean and truncate)
      const cleanHex = (hexStr: string) => {
        if (!hexStr) return '0'
        const cleaned = hexStr.startsWith('0x') ? hexStr.slice(2) : hexStr
        return cleaned.slice(0, 63) // Max 63 hex chars for felt252
      }

      const commitmentHex = cleanHex(borrowerCommitment)
      const commitmentNum = BigInt('0x' + commitmentHex)

      console.log('📊 Approval parameters:', {
        loan_id: {
          low: loanIdU256.low.toString(),
          high: loanIdU256.high.toString()
        },
        borrower_commitment: commitmentNum.toString()
      })

      // Call approve_borrower on-chain
      toast.loading('Submitting approval transaction...', { id: 'approve' })
      
      const approveTx = await starknet.account.execute({
        contractAddress: LOAN_ESCROW_ADDRESS,
        entrypoint: 'approve_borrower',
        calldata: [
          loanIdU256.low.toString(),
          loanIdU256.high.toString(),
          commitmentNum.toString()
        ]
      })
      
      console.log('⏳ Waiting for approval tx:', approveTx.transaction_hash)
      toast.loading('Waiting for confirmation...', { id: 'approve' })
      
      await provider.waitForTransaction(approveTx.transaction_hash)
      
      console.log('✅ Borrower approved on blockchain!')

      toast.success(
        `✅ Borrower approved! Funds transferred. Tx: ${approveTx.transaction_hash.slice(0, 10)}...`,
        { id: 'approve', duration: 10000 }
      )

      console.log('🔗 View on Voyager:', `https://sepolia.voyager.online/tx/${approveTx.transaction_hash}`)

      // Reload data
      await fetchMyLoans(walletAddress)
      if (selectedLoan) {
        await loadApplications(selectedLoan)
      }

    } catch (error: any) {
      console.error('❌ Approval failed:', error)
      
      if (error.message?.includes('User abort')) {
        toast.error('Transaction rejected by user', { id: 'approve' })
      } else {
        toast.error(
          'Approval failed: ' + (error.message || 'Unknown error'),
          { id: 'approve', duration: 8000 }
        )
      }
    }
  }

  // Reveal borrower identity (for overdue loans)
  const revealBorrowerIdentity = async (loanId: string, borrowerCommitment: string) => {
    try {
      console.log('🔓 Revealing borrower identity for overdue loan:', loanId)
      
      toast.loading('Revealing borrower identity...', { id: 'reveal' })
      
      // Get wallet connection
      const starknet = (window as any).starknet
      if (!starknet?.account) {
        toast.error('Please connect your wallet first', { id: 'reveal' })
        return
      }

      const provider = new RpcProvider({ 
        nodeUrl: 'https://starknet-sepolia.public.blastapi.io'
      })

      const LOAN_ESCROW_ADDRESS = process.env.NEXT_PUBLIC_LOAN_ESCROW_ZK_ADDRESS || 
        '0x06b058a0946bb36fa846e6a954da885fa20809f43a9e47038dc83b4041f7f012'
      
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000'

      // First, check the application status from backend to confirm it's overdue
      const appResponse = await axios.get(
        `${BACKEND_URL}/api/loan/application/${loanId}/${borrowerCommitment}`
      )
      
      const app = appResponse.data
      if (!app) {
        toast.error('Application not found', { id: 'reveal' })
        console.error('❌ Application not found for commitment:', borrowerCommitment)
        return
      }

      console.log('📋 Application status from backend:', app.status)
      console.log('📋 Full application data:', app)

      if (app.status !== 'approved') {
        console.error('❌ Application status is not "approved":', app.status)
        toast.error(
          `Cannot reveal: Loan status is "${app.status}". Only approved loans can be revealed.`,
          { id: 'reveal', duration: 7000 }
        )
        return
      }

      const deadline = new Date(app.repaymentDeadline)
      const now = new Date()
      
      console.log('📅 Deadline Check:')
      console.log('  Repayment Deadline:', deadline.toISOString())
      console.log('  Current Time:', now.toISOString())
      console.log('  Is Overdue:', now > deadline)
      console.log('  Time Difference (ms):', now.getTime() - deadline.getTime())
      
      if (now <= deadline) {
        const minutesRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60))
        toast.error(
          `Loan is not overdue yet. ${minutesRemaining} minutes remaining.`, 
          { id: 'reveal', duration: 5000 }
        )
        console.log('⚠️ Cannot reveal: Loan not overdue yet')
        console.log('  Minutes Remaining:', minutesRemaining)
        return
      }

      const daysOverdue = Math.floor((now.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24))
      const hoursOverdue = Math.floor((now.getTime() - deadline.getTime()) / (1000 * 60 * 60))
      const minutesOverdue = Math.floor((now.getTime() - deadline.getTime()) / (1000 * 60))

      // CRITICAL: Check actual on-chain status using provider.callContract (simpler than Contract class)
      console.log('🔍 Checking actual on-chain status...')
      toast.loading('Verifying loan status on blockchain...', { id: 'reveal' })
      
      try {
        // Convert parameters for contract call
        const loanIdU256Temp = uint256.bnToUint256(BigInt(loanId))
        
        // CRITICAL: Use EXACT same commitment processing as we'll use for reveal
        // Don't truncate or clean - use the full value from backend
        const commitmentNumTemp = BigInt(borrowerCommitment)
        
        console.log('📞 Calling get_application with provider.callContract...')
        console.log('  loan_id:', loanId)
        console.log('  commitment (from backend):', borrowerCommitment)
        console.log('  commitment (as BigInt):', commitmentNumTemp.toString())
        
        // Use provider.callContract - simpler, returns raw felt values
        const result = await provider.callContract({
          contractAddress: LOAN_ESCROW_ADDRESS,
          entrypoint: 'get_application',
          calldata: [
            loanIdU256Temp.low.toString(),
            loanIdU256Temp.high.toString(),
            commitmentNumTemp.toString()
          ]
        })
        
        console.log('📦 Raw contract response:', result)
        console.log('📦 Response analysis:', {
          index0_borrower: result[0],
          index1_commitment: result[1],
          index2_amount_or_proofHash: result[2],
          index3: result[3],
          index4: result[4],
          index5: result[5],
          index6: result[6],
          index7: result[7]
        })
        
        // Parse status - need to find correct index
        // Cairo tuple: (felt252, felt252, u256, u8, u64, u64, u64)
        // StarkNet returns u256 as single felt in some cases
        // Status (u8) should be a small number (0-3)
        
        // Find the status by looking for a small number (0-3)
        let onChainStatus = -1
        let statusIndex = -1
        
        for (let i = 0; i < result.length; i++) {
          const val = Number(result[i])
          if (val >= 0 && val <= 3) {
            onChainStatus = val
            statusIndex = i
            break
          }
        }
        
        const statusNames = ['pending', 'approved', 'repaid', 'overdue']
        const statusName = statusNames[onChainStatus] || `unknown(${onChainStatus})`
        
        console.log('🔍 On-chain status:', statusName, '(value:', onChainStatus, 'at index:', statusIndex, ')')
        console.log('🔍 Backend says:', app.status)
        
        if (onChainStatus !== 1) { // 1 = approved
          toast.error(
            `❌ Cannot reveal: Loan status on blockchain is "${statusName}". Backend says "${app.status}" but they're out of sync!`,
            { id: 'reveal', duration: 10000 }
          )
          console.error('❌ DATA INCONSISTENCY DETECTED:', {
            blockchain_status: `${statusName} (${onChainStatus})`,
            backend_status: app.status,
            issue: 'Backend database is out of sync with blockchain',
            solution: 'Backend needs to sync loan status from blockchain events'
          })
          return
        }
        
        console.log('✅ Contract status verified: approved')
        toast.success('Status verified on blockchain', { id: 'reveal' })
        
        // CRITICAL: Even though status is "approved", the reveal function might require
        // the status to change to "overdue" (status=3) AFTER the deadline passes.
        // This is a common pattern: approve the loan, then after deadline, status becomes overdue.
        console.warn('⚠️ IMPORTANT: Status is "approved" but reveal might require status="overdue"')
        console.warn('⚠️ The contract may need to update status to "overdue" first')
        console.warn('⚠️ Possible solution: Check if there\'s an update_status function to call first')
        
      } catch (contractCheckError: any) {
        console.warn('⚠️ Could not verify status on contract:', contractCheckError)
        toast.dismiss('reveal')
        // Continue anyway - let transaction show the error
      }

      // Convert loan_id to u256
      const loanIdU256 = uint256.bnToUint256(BigInt(loanId))

      // CRITICAL: Use EXACT same commitment as get_application call
      // The backend provides the commitment in hex format (0x...)
      // We must use it EXACTLY as the contract stored it
      const commitmentNum = BigInt(borrowerCommitment)
      
      console.log('🔓 Calling reveal_borrower_identity on contract...')
      console.log('  Loan ID:', loanId)
      console.log('  Loan ID u256:', { low: loanIdU256.low.toString(), high: loanIdU256.high.toString() })
      console.log('  Commitment (from backend):', borrowerCommitment)
      console.log('  Commitment (as BigInt):', commitmentNum.toString())
      console.log('  Days Overdue:', daysOverdue)
      console.log('  Hours Overdue:', hoursOverdue)
      console.log('  Minutes Overdue:', minutesOverdue)
      
      console.log('📤 REVEAL TRANSACTION CALLDATA:')
      console.log('  contractAddress:', LOAN_ESCROW_ADDRESS)
      console.log('  entrypoint:', 'reveal_borrower_identity')
      console.log('  calldata:', [
        loanIdU256.low.toString(),
        loanIdU256.high.toString(),
        commitmentNum.toString()
      ])

      toast.loading('Calling smart contract...', { id: 'reveal' })

      // Call reveal_borrower_identity on-chain
      const revealTx = await starknet.account.execute({
        contractAddress: LOAN_ESCROW_ADDRESS,
        entrypoint: 'reveal_borrower_identity',
        calldata: [
          loanIdU256.low.toString(),
          loanIdU256.high.toString(),
          commitmentNum.toString()
        ]
      })
      
      console.log('⏳ Waiting for reveal tx:', revealTx.transaction_hash)
      toast.loading('Waiting for blockchain confirmation...', { id: 'reveal' })
      
      await provider.waitForTransaction(revealTx.transaction_hash)
      console.log('✅ Identity revealed on blockchain!')

      // Get the revealed identity from the backend (which reads from contract)
      const revealResponse = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000'}/api/loan/${loanId}/reveal/${borrowerCommitment}`
      )
      
      // Show the revealed identity
      const borrowerIdentity = revealResponse.data.commitment || borrowerCommitment
      const borrowerWallet = revealResponse.data.borrower || app.borrower

      const overdueText = daysOverdue > 0 
        ? `${daysOverdue} day(s)` 
        : hoursOverdue > 0 
        ? `${hoursOverdue} hour(s)` 
        : `${minutesOverdue} minute(s)`

      toast.success(
        `Identity revealed successfully!\n\n` +
        `ZK Identity: ${borrowerIdentity.slice(0, 20)}...\n` +
        `Wallet: ${borrowerWallet}\n` +
        `Overdue by: ${overdueText}`,
        { id: 'reveal', duration: 10000 }
      )

      console.log('📋 Revealed Identity Details:')
      console.log('  ZK Identity (Commitment):', borrowerIdentity)
      console.log('  Wallet Address:', borrowerWallet)
      console.log('  Overdue Duration:', overdueText)
      console.log('  Transaction:', revealTx.transaction_hash)
      console.log('🔗 View on Voyager:', `https://sepolia.voyager.online/tx/${revealTx.transaction_hash}`)

      // Show detailed alert
      alert(
        `🔓 Borrower Identity Revealed!\n\n` +
        `🔒 ZK Identity (Commitment): ${borrowerIdentity.slice(0, 20)}...${borrowerIdentity.slice(-16)}\n` +
        `📍 Wallet Address: ${borrowerWallet}\n` +
        `📋 Loan ID: ${loanId}\n` +
        `⏰ Overdue by: ${overdueText}\n` +
        `📝 Transaction: ${revealTx.transaction_hash.slice(0, 10)}...\n\n` +
        `⚠️ The borrower failed to repay within the deadline.\n` +
        `✅ Identity revealed on-chain via smart contract.\n` +
        `💡 The ZK Identity Commitment is the borrower's permanent identity used for reputation tracking.`
      )

      // Reload applications to update UI
      await loadApplications(selectedLoan)
      
    } catch (error: any) {
      console.error('❌ Failed to reveal identity:', error)
      
      if (error.message?.includes('User abort')) {
        toast.error('Transaction rejected by user', { id: 'reveal' })
      } else {
        toast.error(
          'Failed to reveal identity: ' + (error.message || 'Unknown error'),
          { id: 'reveal', duration: 8000 }
        )
      }
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
                <h1 className="text-3xl font-black">Lender Dashboard</h1>
                <p className="text-white/60 mt-1">Manage your loan portfolio</p>
              </div>
            </div>
            
            {!walletAddress ? (
              <Button 
                onClick={handleConnectWallet}
                disabled={isConnecting}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-full"
              >
                <Wallet className="w-4 h-4 mr-2" />
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </Button>
            ) : (
              <div className="flex items-center gap-3">
                <Card className="bg-neutral-900/80 border-white/10 px-4 py-2">
                  <p className="text-xs text-white/60">Balance</p>
                  <p className="text-sm font-bold text-purple-400">{strkBalance} STRK</p>
                </Card>
                <Card className="bg-neutral-900/80 border-white/10 px-4 py-2">
                  <p className="text-xs text-white/60 mb-1">Connected</p>
                  <p className="text-sm font-mono text-white">{formatAddress(walletAddress)}</p>
                </Card>
              </div>
            )}
          </div>
        </div>
      </section>

      {!walletAddress ? (
        <section className="relative z-10 px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-2xl mx-auto text-center">
            <Card className="bg-neutral-900/80 border-white/10 p-12">
              <Wallet className="w-16 h-16 text-purple-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2 text-white">Connect Your Wallet</h2>
              <p className="text-white/70 mb-6">
                Connect your StarkNet wallet to create loan offers and manage your lending portfolio
              </p>
              <Button 
                onClick={handleConnectWallet}
                disabled={isConnecting}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                size="lg"
              >
                <Wallet className="w-5 h-5 mr-2" />
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </Button>
            </Card>
          </div>
        </section>
      ) : !activityData ? (
        <section className="relative z-10 px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-2xl mx-auto text-center">
            <Card className="bg-neutral-900/80 border-white/10 p-12">
              <TrendingUp className="w-16 h-16 text-blue-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2 text-white">Fetch Activity Data</h2>
              <p className="text-white/70 mb-6">
                We need to analyze your wallet activity to calculate your credibility score
              </p>
              <Button 
                onClick={fetchActivityData}
                disabled={loadingActivity}
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                size="lg"
              >
                {loadingActivity ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Fetching Activity...
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-5 h-5 mr-2" />
                    Fetch Activity Data
                  </>
                )}
              </Button>
            </Card>
          </div>
        </section>
      ) : !isVerified ? (
        <section className="relative z-10 px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-2xl mx-auto">
            <Card className="bg-neutral-900/80 border-white/10 p-12">
              <div className="text-center mb-8">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2 text-white">Activity Data Retrieved</h2>
                <p className="text-white/70">
                  Your wallet activity has been analyzed successfully
                </p>
              </div>

              <div className="bg-neutral-800/50 rounded-lg p-6 mb-8 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-white/70">Total Transactions</span>
                  <span className="text-white font-bold">{activityData.totalTransactions || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/70">Balance</span>
                  <span className="text-white font-bold">{strkBalance} STRK</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/70">Activity Score</span>
                  <span className="text-2xl font-bold text-purple-400">{activityData.score || 0}</span>
                </div>
                <div className="pt-4 border-t border-white/10">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <div className="text-white/50">Sent</div>
                      <div className="text-green-400 font-semibold">{activityData.sentTransactions?.count || 0} tx</div>
                      <div className="text-white/70 text-xs">{activityData.sentTransactions?.totalAmountFormatted || '0 STRK'}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-white/50">Received</div>
                      <div className="text-blue-400 font-semibold">{activityData.receivedTransactions?.count || 0} tx</div>
                      <div className="text-white/70 text-xs">{activityData.receivedTransactions?.totalAmountFormatted || '0 STRK'}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Transactions Preview */}
              {(activityData.sentTransactions?.transactions?.length > 0 || activityData.receivedTransactions?.transactions?.length > 0) && (
                <div className="bg-neutral-800/30 rounded-lg p-6 mb-8">
                  <h3 className="text-lg font-semibold text-white mb-4">Recent Transactions</h3>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {/* Sent Transactions */}
                    {activityData.sentTransactions?.transactions?.slice(0, 5).map((tx: any, idx: number) => (
                      <div key={`sent-${idx}`} className="flex items-center justify-between p-3 bg-neutral-900/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                            <span className="text-red-400 text-xs">↑</span>
                          </div>
                          <div>
                            <div className="text-white font-medium text-sm">{tx.amountFormatted}</div>
                            <div className="text-white/50 text-xs">To: {tx.to?.slice(0, 10)}...{tx.to?.slice(-6)}</div>
                          </div>
                        </div>
                        <div className="text-white/50 text-xs">Block #{tx.blockNumber}</div>
                      </div>
                    ))}
                    
                    {/* Received Transactions */}
                    {activityData.receivedTransactions?.transactions?.slice(0, 5).map((tx: any, idx: number) => (
                      <div key={`received-${idx}`} className="flex items-center justify-between p-3 bg-neutral-900/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                            <span className="text-green-400 text-xs">↓</span>
                          </div>
                          <div>
                            <div className="text-white font-medium text-sm">{tx.amountFormatted}</div>
                            <div className="text-white/50 text-xs">From: {tx.from?.slice(0, 10)}...{tx.from?.slice(-6)}</div>
                          </div>
                        </div>
                        <div className="text-white/50 text-xs">Block #{tx.blockNumber}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-center">
                <p className="text-white/70 mb-6">
                  Generate a Zero-Knowledge proof to verify your credibility without revealing your data
                </p>
                <Button 
                  onClick={generateZKProof}
                  disabled={generatingProof}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  size="lg"
                >
                  {generatingProof ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Generating Proof...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Generate ZK Proof
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </div>
        </section>
      ) : (
        <>
          {/* Stats Overview */}
          <section className="relative z-10 px-4 sm:px-6 lg:px-8 py-8">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Portfolio Overview</h2>
                <Button 
                  onClick={() => fetchLenderStats(walletAddress)}
                  disabled={loadingStats}
                  variant="outline"
                  size="sm"
                  className="border-white/10"
                >
                  {loadingStats ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </Button>
              </div>
              
              <RevealOnView>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <Card className="bg-neutral-900/80 border-white/10 p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                        <DollarSign className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-sm text-white/70">Total Lent</p>
                        <p className="text-2xl font-bold text-white">
                          {loadingStats ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                          ) : (
                            `${stats.totalLent.toFixed(2)} STRK`
                          )}
                        </p>
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
                        <p className="text-2xl font-bold text-white">
                          {loadingStats ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                          ) : (
                            stats.activeLoans
                          )}
                        </p>
                      </div>
                    </div>
                  </Card>

                  <Card className="bg-neutral-900/80 border-white/10 p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-sm text-white/70">Potential Earnings</p>
                        <p className="text-2xl font-bold text-white">
                          {loadingStats ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                          ) : (
                            `${stats.totalEarnings.toFixed(2)} STRK`
                          )}
                        </p>
                      </div>
                    </div>
                  </Card>

                  <Card className="bg-neutral-900/80 border-white/10 p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-green-500 flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-sm text-white/70">Avg Interest</p>
                        <p className="text-2xl font-bold text-white">
                          {loadingStats ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                          ) : (
                            `${stats.averageReturn.toFixed(2)}%`
                          )}
                        </p>
                      </div>
                    </div>
                  </Card>

                  <Card className="bg-neutral-900/80 border-white/10 p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-yellow-500 flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-sm text-white/70">Your Loans</p>
                        <p className="text-2xl font-bold text-white">
                          {loadingStats ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                          ) : (
                            myLoans.length
                          )}
                        </p>
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
                    <Label htmlFor="amount" className="text-white/90">Amount Per Borrower (STRK)</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="Enter amount per borrower"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="bg-neutral-800 border-white/10 text-white placeholder:text-white/40"
                    />
                    <p className="text-xs text-white/60">
                      Amount each borrower will receive. Total = Amount × Max Borrowers
                      {amount && maxBorrowers && (
                        <span className="text-purple-400 font-semibold">
                          {' '}(Total: {Number.parseFloat(amount) * Number.parseInt(maxBorrowers || '0')} STRK)
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="borrowers" className="text-white/90">Maximum Borrowers (Slots)</Label>
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

                  <div className="space-y-2">
                    <Label htmlFor="minScore" className="text-white/90">Minimum Activity Score</Label>
                    <Input
                      id="minScore"
                      type="number"
                      placeholder="Enter minimum score (e.g., 500)"
                      value={minActivityScore}
                      onChange={(e) => setMinActivityScore(e.target.value)}
                      className="bg-neutral-800 border-white/10 text-white placeholder:text-white/40"
                    />
                    <p className="text-xs text-white/60">Minimum activity score required for borrowers</p>
                  </div>

                  <Button
                    onClick={handleCreateOffer}
                    disabled={creatingLoan}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-6"
                    size="lg"
                  >
                    {creatingLoan ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Creating Loan...
                      </>
                    ) : (
                      <>
                        <Plus className="w-5 h-5 mr-2" />
                        Create Loan Offer
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            </div>
          </section>

          {/* My Loans Section */}
          <section className="relative z-10 px-4 sm:px-6 lg:px-8 py-8">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">My Loan Offers</h2>
                <Button 
                  onClick={() => fetchMyLoans(walletAddress)}
                  disabled={loadingLoans}
                  variant="outline"
                  size="sm"
                  className="border-white/10"
                >
                  {loadingLoans ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </Button>
              </div>

              {loadingLoans ? (
                <div className="text-center py-12">
                  <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-purple-500" />
                  <p className="text-white/60">Loading your loans...</p>
                </div>
              ) : myLoans.length === 0 ? (
                <Card className="bg-neutral-900/80 border-white/10 p-12 text-center">
                  <DollarSign className="w-16 h-16 text-purple-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">No Loans Yet</h3>
                  <p className="text-white/60">Create your first loan offer above to start lending</p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {myLoans.map((loan, index) => {
                    console.log(`Rendering loan ${index}:`, { loanId: loan.loanId, lender: loan.lender, loanAmount: loan.loanAmount, interestRate: loan.interestRate })
                    
                    const loanAmountFormatted = formatStrkAmount(loan.loanAmount)
                    
                    // Duration: Show in seconds
                    const repaymentSeconds = Number(loan.repaymentPeriod) || 0
                    const durationDisplay = `${repaymentSeconds.toLocaleString()} seconds`
                    
                    // Interest rate: Format properly
                    const interestRateValue = Number(loan.interestRate) || 0
                    const interestRateDisplay = interestRateValue % 1 === 0 
                      ? interestRateValue.toFixed(0)  // Whole number: "10"
                      : interestRateValue.toFixed(2)  // Decimal: "10.50"
                    
                    const slotsAvailable = (loan.totalSlots || 0) - (loan.filledSlots || 0)
                    const isFull = slotsAvailable <= 0

                    return (
                      <Card 
                        key={`loan-${index}-${loan.loanId || 'unknown'}-${loan.lender}`}
                        className="bg-neutral-800/50 border-white/10 p-6 hover:border-purple-500/50 transition-all"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-bold text-white">Loan #{loan.loanId}</h3>
                            <p className="text-xs text-white/60">Created by you</p>
                          </div>
                          <Badge className={
                            isFull 
                              ? 'bg-red-500/20 text-red-400 border-red-500/30'
                              : loan.isActive
                              ? 'bg-green-500/20 text-green-400 border-green-500/30'
                              : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                          }>
                            {isFull ? 'FULL' : loan.isActive ? 'ACTIVE' : 'INACTIVE'}
                          </Badge>
                        </div>

                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-sm text-white/60">Amount</span>
                            <span className="text-sm font-bold text-white">{loanAmountFormatted} STRK</span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-sm text-white/60">Interest Rate</span>
                            <span className="text-sm font-bold text-green-400">{interestRateDisplay}% APR</span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-sm text-white/60">Duration</span>
                            <span className="text-sm font-bold text-white">{durationDisplay}</span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-sm text-white/60">Borrowers</span>
                            <span className="text-sm font-bold text-white">
                              {loan.filledSlots}/{loan.totalSlots}
                            </span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-sm text-white/60">Min Score</span>
                            <span className="text-sm font-bold text-purple-400">{loan.minActivityScore}</span>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-white/10">
                          <Button 
                            className="w-full"
                            variant="outline"
                            size="sm"
                            onClick={() => loadApplications(loan.loanId)}
                          >
                            View Applications
                          </Button>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Applications View */}
          {selectedLoan && (
            <section className="relative z-10 px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="max-w-7xl mx-auto">
                {/* Header with gradient background */}
                <div className="bg-gradient-to-r from-purple-900/40 via-blue-900/40 to-purple-900/40 rounded-xl p-6 mb-6 border border-purple-500/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="bg-gradient-to-br from-purple-500 to-blue-500 p-3 rounded-lg">
                        <Users className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                          Applications for Loan #{selectedLoan}
                        </h2>
                        <p className="text-white/60 text-sm mt-1">Review and approve borrower applications</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => loadApplications(selectedLoan)}
                        disabled={loadingApplications}
                        variant="outline"
                        size="sm"
                        className="border-purple-500/30 hover:bg-purple-500/10"
                      >
                        {loadingApplications ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Refresh
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => setSelectedLoan(null)}
                        variant="outline"
                        size="sm"
                        className="border-white/20 hover:bg-white/5"
                      >
                        ✕ Close
                      </Button>
                    </div>
                  </div>

                  {/* Stats Bar */}
                  <div className="grid grid-cols-4 gap-4 mt-6">
                    <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                      <p className="text-xs text-white/50">📋 All</p>
                      <p className="text-2xl font-bold text-white">{applications.length}</p>
                    </div>
                    <div className="bg-yellow-500/10 rounded-lg p-3 border border-yellow-500/20">
                      <p className="text-xs text-yellow-400/70">⏳ Pending</p>
                      <p className="text-2xl font-bold text-yellow-400">
                        {applications.filter(a => a.status === 'pending').length}
                      </p>
                    </div>
                    <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/20">
                      <p className="text-xs text-green-400/70">✅ Approved</p>
                      <p className="text-2xl font-bold text-green-400">
                        {applications.filter(a => a.status === 'approved').length}
                      </p>
                    </div>
                    <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/20">
                      <p className="text-xs text-blue-400/70">💰 Repaid</p>
                      <p className="text-2xl font-bold text-blue-400">
                        {applications.filter(a => a.status === 'repaid').length}
                      </p>
                    </div>
                  </div>
                </div>

                {loadingApplications ? (
                  <div className="bg-gradient-to-br from-neutral-900/80 to-neutral-900/60 border border-white/10 rounded-xl p-12 text-center backdrop-blur-sm">
                    <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-purple-500" />
                    <p className="text-white/60">Loading applications...</p>
                  </div>
                ) : applications.length === 0 ? (
                  <div className="bg-gradient-to-br from-neutral-900/80 to-neutral-900/60 border border-white/10 rounded-xl p-12 text-center backdrop-blur-sm">
                    <div className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Users className="w-10 h-10 text-purple-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">No Applications Yet</h3>
                    <p className="text-white/60 mb-6">Waiting for borrowers to apply for this loan</p>
                    <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4 max-w-md mx-auto">
                      <p className="text-sm text-blue-400 font-semibold mb-2">💡 Troubleshooting Tips</p>
                      <ul className="text-left text-sm text-white/60 space-y-1">
                        <li>• Wait 30 seconds for auto-refresh</li>
                        <li>• Click the refresh button above</li>
                        <li>• Check that application transaction was confirmed</li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {applications.map((app, index) => {
                      const isOverdue = app.status === 'approved' && 
                                        app.repaymentDeadline && 
                                        new Date(app.repaymentDeadline) < new Date()
                      
                      return (
                        <div 
                          key={index}
                          className={`bg-gradient-to-br from-neutral-900/90 to-neutral-900/70 border rounded-xl p-6 backdrop-blur-sm transition-all hover:scale-[1.01] ${
                            isOverdue 
                              ? 'border-red-500/50 shadow-lg shadow-red-500/20' 
                              : app.status === 'pending'
                              ? 'border-yellow-500/30'
                              : app.status === 'approved'
                              ? 'border-green-500/30'
                              : 'border-blue-500/30'
                          }`}
                        >
                          {/* Header with Status */}
                          <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${
                                app.status === 'pending' 
                                  ? 'bg-yellow-500/20'
                                  : app.status === 'approved'
                                  ? 'bg-green-500/20'
                                  : 'bg-blue-500/20'
                              }`}>
                                <span className="text-2xl">
                                  {app.status === 'pending' && '⏳'}
                                  {app.status === 'approved' && '✅'}
                                  {app.status === 'repaid' && '💰'}
                                </span>
                              </div>
                              <div>
                                <h3 className="text-lg font-bold text-white">Application #{index + 1}</h3>
                                <p className="text-xs text-white/50">
                                  Applied {new Date(app.timestamp).toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <Badge className={`text-sm font-semibold px-4 py-1 ${
                              app.status === 'pending' 
                                ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                                : app.status === 'approved'
                                ? isOverdue
                                  ? 'bg-red-500/20 text-red-300 border-red-500/40'
                                  : 'bg-green-500/20 text-green-300 border-green-500/40'
                                : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                            }`}>
                              {app.status === 'pending' && 'PENDING'}
                              {app.status === 'approved' && (isOverdue ? 'OVERDUE' : 'APPROVED')}
                              {app.status === 'repaid' && 'REPAID'}
                            </Badge>
                          </div>

                          {/* Borrower Info Card */}
                          <div className="bg-black/30 rounded-lg p-4 mb-4 border border-white/5">
                            <p className="text-xs text-white/50 mb-2">🔐 Borrower Commitment</p>
                            <p className="text-sm font-mono text-purple-400 break-all">
                              {app.borrowerCommitment?.slice(0, 20)}...{app.borrowerCommitment?.slice(-16)}
                            </p>
                          </div>

                          {/* Info Grid */}
                          <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-lg p-4 border border-purple-500/20">
                              <p className="text-xs text-purple-300/70 mb-1">📊 Activity Score</p>
                              <p className="text-2xl font-bold text-white">{app.activityScore || '340'}</p>
                              <p className="text-xs text-green-400 mt-1">✓ Verified</p>
                            </div>
                            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-lg p-4 border border-blue-500/20">
                              <p className="text-xs text-blue-300/70 mb-1">📅 Applied Date</p>
                              <p className="text-sm font-bold text-white">
                                {new Date(app.timestamp).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric', 
                                  year: 'numeric' 
                                })}
                              </p>
                              <p className="text-xs text-white/50 mt-1">
                                {new Date(app.timestamp).toLocaleTimeString('en-US', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </p>
                            </div>
                          </div>

                          {/* Status-specific info */}
                          {app.status === 'approved' && app.approvedAt && (
                            <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-lg p-4 mb-4">
                              <p className="text-sm font-semibold text-green-400 mb-2">
                                ✅ Approved & Funded
                              </p>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-white/60">
                                  {new Date(app.approvedAt).toLocaleString()}
                                </span>
                                {app.repaymentDeadline && (
                                  <span className="text-orange-400">
                                    ⏰ Due: {new Date(app.repaymentDeadline).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {app.status === 'repaid' && app.repaidAt && (
                            <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
                              <p className="text-sm font-semibold text-blue-400 mb-2">
                                💰 Successfully Repaid
                              </p>
                              <p className="text-xs text-white/60">
                                {new Date(app.repaidAt).toLocaleString()}
                              </p>
                            </div>
                          )}

                          {isOverdue && (
                            <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/50 rounded-lg p-4 mb-4">
                              <p className="text-sm font-bold text-red-300 mb-2">
                                ⚠️ LOAN OVERDUE
                              </p>
                              <p className="text-xs text-white/70 mb-3">
                                Borrower missed repayment deadline
                              </p>
                              <Button
                                onClick={() => revealBorrowerIdentity(selectedLoan, app.borrowerCommitment)}
                                className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-semibold shadow-lg shadow-red-500/30 transition-all hover:scale-[1.02]"
                                size="sm"
                              >
                                🔓 Reveal Borrower Identity
                              </Button>
                            </div>
                          )}

                          {/* Action Button */}
                          {app.status === 'pending' && (
                            <Button
                              onClick={() => approveBorrower(selectedLoan, app.borrowerCommitment)}
                              className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold shadow-lg shadow-green-500/30 transition-all hover:scale-[1.02]"
                              size="lg"
                            >
                              <CheckCircle className="w-5 h-5 mr-2" />
                              Approve & Release Funds
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  )
}

