/**
 * StarkNet Service for Real Frontend
 * Handles StarkNet wallet connections and blockchain interactions
 */

import { RpcProvider, CallData, uint256 } from 'starknet'

// Contract addresses from environment
const LOAN_ESCROW_ZK_ADDRESS = process.env.NEXT_PUBLIC_LOAN_ESCROW_ZK_ADDRESS || 
  '0x06b058a0946bb36fa846e6a954da885fa20809f43a9e47038dc83b4041f7f012'
const STRK_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_STRK_TOKEN_ADDRESS || 
  '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d'
const ACTIVITY_VERIFIER_ADDRESS = process.env.NEXT_PUBLIC_ACTIVITY_VERIFIER_ADDRESS || 
  '0x071b94eb84b81868b61fb0ec1bbb59df47bb508583bc79325e5fa997ee3eb4be'
const RPC_URL = process.env.NEXT_PUBLIC_STARKNET_RPC || 
  'https://starknet-sepolia.public.blastapi.io/rpc/v0_7'

// ERC20 ABI for STRK token
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'felt' }],
    outputs: [{ name: 'balance', type: 'Uint256' }],
    stateMutability: 'view'
  },
  {
    name: 'decimals',
    type: 'function',
    inputs: [],
    outputs: [{ name: 'decimals', type: 'felt' }],
    stateMutability: 'view'
  },
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'felt' },
      { name: 'amount', type: 'Uint256' }
    ],
    outputs: [{ name: 'success', type: 'felt' }],
    stateMutability: 'external'
  },
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'recipient', type: 'felt' },
      { name: 'amount', type: 'Uint256' }
    ],
    outputs: [{ name: 'success', type: 'felt' }],
    stateMutability: 'external'
  }
]

// Loan Escrow ABI
const LOAN_ESCROW_ABI = [
  {
    name: 'create_loan_offer',
    type: 'function',
    inputs: [
      { name: 'loan_amount', type: 'u256' },
      { name: 'number_of_borrowers', type: 'u256' },
      { name: 'interest_rate', type: 'u256' },
      { name: 'repayment_period', type: 'u256' },
      { name: 'min_activity_score', type: 'u256' }
    ],
    outputs: [{ name: 'loan_id', type: 'u256' }],
    stateMutability: 'external'
  },
  {
    name: 'apply_for_loan',
    type: 'function',
    inputs: [
      { name: 'loan_id', type: 'u256' },
      { name: 'commitment', type: 'felt252' },
      { name: 'proof_hash', type: 'felt252' },
      { name: 'activity_score', type: 'u256' }
    ],
    outputs: [],
    stateMutability: 'external'
  },
  {
    name: 'approve_application',
    type: 'function',
    inputs: [
      { name: 'loan_id', type: 'u256' },
      { name: 'commitment', type: 'felt252' }
    ],
    outputs: [],
    stateMutability: 'external'
  },
  {
    name: 'repay_loan',
    type: 'function',
    inputs: [
      { name: 'loan_id', type: 'u256' }
    ],
    outputs: [],
    stateMutability: 'external'
  },
  {
    name: 'get_loan_count',
    type: 'function',
    inputs: [],
    outputs: [{ name: 'count', type: 'u256' }],
    stateMutability: 'view'
  },
  {
    name: 'get_loan_details',
    type: 'function',
    inputs: [{ name: 'loan_id', type: 'u256' }],
    outputs: [{ name: 'loan', type: 'LoanOffer' }],
    stateMutability: 'view'
  },
  {
    name: 'get_application',
    type: 'function',
    inputs: [
      { name: 'loan_id', type: 'u256' },
      { name: 'commitment', type: 'felt252' }
    ],
    outputs: [{ name: 'application', type: 'Application' }],
    stateMutability: 'view'
  }
]

export class StarkNetService {
  private provider: RpcProvider

  constructor() {
    this.provider = new RpcProvider({ nodeUrl: RPC_URL })
  }

  /**
   * Fetch STRK token balance for a wallet
   */
  async fetchStrkBalance(walletAddress: string): Promise<{
    raw: string
    formatted: string
    decimals: number
    token: string
    address: string
  }> {
    try {
      console.log('📊 Fetching STRK balance for:', walletAddress)

      // Call balance directly via provider to avoid ABI parsing issues
      const res: any = await this.provider.callContract({
        contractAddress: STRK_TOKEN_ADDRESS,
        entrypoint: 'balanceOf',
        calldata: [walletAddress]
      })
      const arr: string[] = Array.isArray(res) ? res : (res.result ?? [])
      const low = BigInt(arr[0] || 0)
      const high = BigInt(arr[1] || 0)
      const balance = low + (high << BigInt(128))

      const decimals = 18
      const balanceInStrk = Number(balance) / Math.pow(10, decimals)

      console.log('✅ STRK Balance:', balanceInStrk, 'STRK')

      return {
        raw: balance.toString(),
        formatted: balanceInStrk.toFixed(6),
        decimals,
        token: 'STRK',
        address: STRK_TOKEN_ADDRESS
      }
    } catch (error) {
      console.error('❌ Error fetching STRK balance:', error)
      throw error
    }
  }

  /**
   * Get loan count from blockchain
   */
  async getLoanCount(): Promise<number> {
    try {
      const res: any = await this.provider.callContract({
        contractAddress: LOAN_ESCROW_ZK_ADDRESS,
        entrypoint: 'get_loan_count',
        calldata: []
      })
      const arr: string[] = Array.isArray(res) ? res : (res.result ?? [])
      const low = BigInt(arr[0] || 0)
      const high = BigInt(arr[1] || 0)
      const count = Number(low + (high << BigInt(128)))
      return count
    } catch (error) {
      console.error('❌ Error fetching loan count:', error)
      return 0
    }
  }

  /**
   * Get loan details by ID
   */
  async getLoanDetails(loanId: number): Promise<any> {
    try {
      const loanIdU256 = uint256.bnToUint256(loanId)
      const res: any = await this.provider.callContract({
        contractAddress: LOAN_ESCROW_ZK_ADDRESS,
        entrypoint: 'get_loan_details',
        calldata: [loanIdU256.low.toString(), loanIdU256.high.toString()]
      })
      return Array.isArray(res) ? res : (res.result ?? res)
    } catch (error) {
      console.error('❌ Error fetching loan details:', error)
      throw error
    }
  }

  /**
   * Get application details
   */
  async getApplication(loanId: number, commitment: string): Promise<any> {
    try {
      const loanIdU256 = uint256.bnToUint256(loanId)
      const res: any = await this.provider.callContract({
        contractAddress: LOAN_ESCROW_ZK_ADDRESS,
        entrypoint: 'get_application',
        calldata: [loanIdU256.low.toString(), loanIdU256.high.toString(), commitment]
      })
      return Array.isArray(res) ? res : (res.result ?? res)
    } catch (error) {
      console.error('❌ Error fetching application:', error)
      throw error
    }
  }

  /**
   * Prepare transaction calldata for creating a loan offer
   * Parameters match the contract ABI exactly - SAME AS TEST FRONTEND
   */
  prepareCreateLoanOffer(
    amountPerBorrower: string,
    totalSlots: number,
    interestRateBps: number,
    repaymentPeriod: number,
    minActivityScore: number
  ): any {
    // Convert to BigInt and then to Uint256 (exactly like test frontend)
    const amountUint256 = uint256.bnToUint256(BigInt(amountPerBorrower))
    const interestRateUint256 = uint256.bnToUint256(BigInt(interestRateBps))
    const minScoreUint256 = uint256.bnToUint256(BigInt(minActivityScore))
    
    return {
      contractAddress: LOAN_ESCROW_ZK_ADDRESS,
      entrypoint: 'create_loan_offer',
      calldata: CallData.compile({
        amount_per_borrower: amountUint256,
        total_slots: totalSlots.toString(), // u8 type
        interest_rate_bps: interestRateUint256, // u16 as Uint256 format
        repayment_period: repaymentPeriod.toString(), // u64 type
        min_activity_score: minScoreUint256
      })
    }
  }

  /**
   * Prepare transaction calldata for applying to a loan
   */
  prepareApplyForLoan(
    loanId: number,
    commitment: string,
    proofHash: string,
    activityScore: number
  ): any {
    return {
      contractAddress: LOAN_ESCROW_ZK_ADDRESS,
      entrypoint: 'apply_for_loan',
      calldata: CallData.compile({
        loan_id: uint256.bnToUint256(loanId),
        commitment,
        proof_hash: proofHash,
        activity_score: uint256.bnToUint256(activityScore)
      })
    }
  }

  /**
   * Prepare transaction calldata for approving an application
   */
  prepareApproveApplication(loanId: number, commitment: string): any {
    return {
      contractAddress: LOAN_ESCROW_ZK_ADDRESS,
      entrypoint: 'approve_application',
      calldata: CallData.compile({
        loan_id: uint256.bnToUint256(loanId),
        commitment
      })
    }
  }

  /**
   * Prepare transaction calldata for repaying a loan
   */
  prepareRepayLoan(loanId: number): any {
    return {
      contractAddress: LOAN_ESCROW_ZK_ADDRESS,
      entrypoint: 'repay_loan',
      calldata: CallData.compile({
        loan_id: uint256.bnToUint256(loanId)
      })
    }
  }

  /**
   * Prepare STRK token approval
   */
  prepareTokenApproval(spender: string, amount: string): any {
    return {
      contractAddress: STRK_TOKEN_ADDRESS,
      entrypoint: 'approve',
      calldata: CallData.compile({
        spender,
        amount: uint256.bnToUint256(amount)
      })
    }
  }

  /**
   * Get contract addresses
   */
  getContractAddresses(): {
    loanEscrow: string
    strkToken: string
    activityVerifier: string
  } {
    return {
      loanEscrow: LOAN_ESCROW_ZK_ADDRESS,
      strkToken: STRK_TOKEN_ADDRESS,
      activityVerifier: ACTIVITY_VERIFIER_ADDRESS
    }
  }

  /**
   * Format transaction hash for explorer
   */
  getExplorerUrl(txHash: string): string {
    return `https://sepolia.starkscan.co/tx/${txHash}`
  }

  /**
   * Format address for explorer
   */
  getAddressUrl(address: string): string {
    return `https://sepolia.starkscan.co/contract/${address}`
  }
}

export default StarkNetService