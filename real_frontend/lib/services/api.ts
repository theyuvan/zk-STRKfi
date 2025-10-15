/**
 * Complete API Service for Real Frontend
 * Integrates with Backend API endpoints
 */

import axios, { AxiosInstance } from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

// Create axios instance with default config
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
})

// ====== TYPE DEFINITIONS ======

export interface ProofInputs {
  salary: number
  threshold: number
  salt: string
  commitment: string
}

export interface ZKProof {
  proof: any
  publicSignals: any[]
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

export interface ActivityData {
  walletAddress: string
  totalTransactions: number
  sentTransactions: any[]
  receivedTransactions: any[]
  totalVolume: string
  totalVolumeFormatted: string
  score: number
  averageTransactionValue: string
}

export interface IdentityVerification {
  success: boolean
  commitment: string
  proofData: {
    passportHash: string
    dateOfBirthHash: string
    addressHash: string
    salt: string
  }
  message: string
}

// ====== PROOF API ======

export const proofApi = {
  /**
   * Prepare ZK proof inputs
   */
  prepareProofInputs: async (salary: number, threshold: number): Promise<ProofInputs> => {
    const response = await api.post('/api/proof/prepare-inputs', { salary, threshold })
    return response.data
  },

  /**
   * Generate ZK proof (server-side generation)
   */
  generateProof: async (salary: number, threshold: number, salt: string): Promise<ZKProof> => {
    const response = await api.post('/api/proof/generate', { salary, threshold, salt })
    return response.data
  },

  /**
   * Verify ZK proof
   */
  verifyProof: async (proof: any, publicSignals: any[]): Promise<{ valid: boolean }> => {
    const response = await api.post('/api/proof/verify', { proof, publicSignals })
    return response.data
  },

  /**
   * Generate commitment hash
   */
  generateCommitment: async (data: any): Promise<{ commitment: string }> => {
    const response = await api.post('/api/proof/commitment', data)
    return response.data
  },

  /**
   * Hash proof for on-chain storage
   */
  hashProof: async (proof: any, publicSignals: any[]): Promise<{ hash: string }> => {
    const response = await api.post('/api/proof/hash', { proof, publicSignals })
    return response.data
  },

  /**
   * Get proof status from blockchain
   */
  getProofStatus: async (proofHash: string): Promise<any> => {
    const response = await api.get(`/api/proof/status/${proofHash}`)
    return response.data
  },
}

// ====== LOAN API (ON-CHAIN) ======

export const loanApi = {
  /**
   * Get all available loan offers from blockchain
   */
  getAvailableLoans: async (): Promise<LoanOffer[]> => {
    const response = await api.get('/api/loan/available')
    // Backend returns { success, count, loans }
    return response.data.loans || response.data
  },

  /**
   * Get loans created by a specific lender
   */
  getLenderLoans: async (lenderAddress: string): Promise<LoanOffer[]> => {
    const response = await api.get(`/api/loan/lender/${lenderAddress}`)
    // Backend returns { success, count, loans }
    return response.data.loans || response.data
  },

  /**
   * Get application details for a specific loan and commitment
   */
  getApplication: async (loanId: string, commitment: string): Promise<LoanApplication> => {
    const response = await api.get(`/api/loan/application/${loanId}/${commitment}`)
    return response.data
  },

  /**
   * Get all applications for a borrower (by commitment)
   */
  getBorrowerApplications: async (commitment: string): Promise<LoanApplication[]> => {
    const response = await api.get(`/api/loan/borrower/${commitment}/applications`)
    return response.data
  },

  /**
   * Register ZK proof on-chain (returns transaction data for wallet to execute)
   */
  registerProof: async (proofHash: string, commitment: string, activityScore: number): Promise<any> => {
    const response = await api.post('/api/loan/register-proof', {
      proofHash,
      commitment,
      activityScore,
    })
    return response.data
  },

  /**
   * Get total number of loans from blockchain
   */
  getLoanCount: async (): Promise<number> => {
    const response = await api.get('/api/loan/count')
    return response.data.count
  },

  /**
   * Get specific loan details by ID
   */
  getLoanDetails: async (loanId: string): Promise<LoanOffer> => {
    const response = await api.get(`/api/loan/details/${loanId}`)
    return response.data
  },
}

// ====== ACTIVITY API (Transaction Analysis) ======

export const activityApi = {
  /**
   * Get complete activity data with transaction history
   */
  getActivityData: async (walletAddress: string, maxBlocks?: number): Promise<ActivityData> => {
    const params = maxBlocks ? `?maxBlocks=${maxBlocks}` : ''
    const response = await api.get(`/api/activity/${walletAddress}${params}`)
    return response.data.data
  },

  /**
   * Get just the activity score (lightweight)
   */
  getActivityScore: async (walletAddress: string): Promise<number> => {
    const response = await api.get(`/api/activity/${walletAddress}/score`)
    return response.data.score
  },

  /**
   * Get transaction breakdown (sent vs received)
   */
  getTransactions: async (walletAddress: string, maxBlocks?: number): Promise<any> => {
    const params = maxBlocks ? `?maxBlocks=${maxBlocks}` : ''
    const response = await api.get(`/api/activity/${walletAddress}/transactions${params}`)
    return response.data
  },
}

// ====== IDENTITY API (Document Verification) ======

export const identityApi = {
  /**
   * Verify identity document (passport/ID)
   */
  verifyDocument: async (formData: FormData): Promise<IdentityVerification> => {
    const response = await api.post('/api/identity/verify-document', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  /**
   * Generate identity ZK proof (Stage 1)
   */
  generateIdentityProof: async (
    passportNumber: string,
    dateOfBirth: string,
    address: string,
    salt: string
  ): Promise<any> => {
    const response = await api.post('/api/identity/generate-proof', {
      passportNumber,
      dateOfBirth,
      address,
      salt,
    })
    return response.data
  },

  /**
   * Verify identity commitment
   */
  verifyCommitment: async (commitment: string): Promise<any> => {
    const response = await api.get(`/api/identity/verify/${commitment}`)
    return response.data
  },

  /**
   * Request identity reveal (for approved loans)
   */
  requestReveal: async (loanId: string, commitment: string, requesterAddress: string): Promise<any> => {
    const response = await api.post('/api/identity/request-reveal', {
      loanId,
      commitment,
      requesterAddress,
    })
    return response.data
  },

  /**
   * Submit identity shares (Shamir Secret Sharing)
   */
  submitShares: async (loanId: string, commitment: string, shares: any[]): Promise<any> => {
    const response = await api.post('/api/identity/submit-shares', {
      loanId,
      commitment,
      shares,
    })
    return response.data
  },

  /**
   * Reconstruct identity from shares
   */
  reconstructIdentity: async (loanId: string, commitment: string): Promise<any> => {
    const response = await api.post('/api/identity/reconstruct', {
      loanId,
      commitment,
    })
    return response.data
  },
}

// ====== PAYROLL API (Income Verification) ======

export const payrollApi = {
  /**
   * Connect to payroll provider (ADP, Plaid, etc.)
   */
  connectPayroll: async (provider: string, credentials: any): Promise<any> => {
    const response = await api.post('/api/payroll/connect', {
      provider,
      credentials,
    })
    return response.data
  },

  /**
   * Fetch income data from payroll provider
   */
  fetchIncomeData: async (connectionId: string): Promise<any> => {
    const response = await api.get(`/api/payroll/income/${connectionId}`)
    return response.data
  },

  /**
   * Generate income proof
   */
  generateIncomeProof: async (connectionId: string, threshold: number): Promise<any> => {
    const response = await api.post('/api/payroll/generate-proof', {
      connectionId,
      threshold,
    })
    return response.data
  },
}

// ====== HELPER FUNCTIONS ======

/**
 * Format wallet address (show first 6 and last 4 characters)
 */
export function formatAddress(address: string): string {
  if (!address) return ''
  if (address.length < 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

/**
 * Format STRK amount (convert from wei)
 */
export function formatStrkAmount(amount: string | number): string {
  const amountBigInt = typeof amount === 'string' ? BigInt(amount) : BigInt(Math.floor(amount))
  const decimals = 18
  let divisor = BigInt(1)
  for (let i = 0; i < decimals; i++) {
    divisor = divisor * BigInt(10)
  }
  const formatted = Number(amountBigInt) / Number(divisor)
  return formatted.toFixed(6)
}

/**
 * Parse STRK amount (convert to wei)
 */
export function parseStrkAmount(amount: string | number): string {
  const decimals = 18
  const amountNum = typeof amount === 'string' ? parseFloat(amount) : amount
  const multiplier = Math.pow(10, decimals)
  return Math.floor(amountNum * multiplier).toString()
}

/**
 * Check if API is healthy
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await api.get('/health')
    return response.data.status === 'ok'
  } catch (error) {
    return false
  }
}

export default api
