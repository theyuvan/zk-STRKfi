const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'

export interface WalletAnalysisResult {
  eligible: boolean
  score: number
  metrics: {
    balance: { value: number; meets: boolean }
    activity: { value: number; meets: boolean }
    inflow: { value: number; meets: boolean }
    age: { value: number; meets: boolean }
    netFlow: { value: number; meets: boolean }
  }
  proofInputs?: any
}

export interface LoanRequest {
  walletAddress: string
  loanAmount: number
  incomeProof?: string
  walletProof?: string
}

export const api = {
  // Wallet Analysis
  async analyzeWallet(walletAddress: string, loanAmount: number): Promise<WalletAnalysisResult> {
    const response = await fetch(`${API_BASE_URL}/wallet/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, loanAmount }),
    })
    if (!response.ok) throw new Error('Failed to analyze wallet')
    return response.json()
  },

  async generateWalletProof(walletAddress: string, loanAmount: number): Promise<{ proof: string }> {
    const response = await fetch(`${API_BASE_URL}/wallet/generate-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, loanAmount }),
    })
    if (!response.ok) throw new Error('Failed to generate proof')
    return response.json()
  },

  async getCriteria(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/wallet/criteria`)
    if (!response.ok) throw new Error('Failed to fetch criteria')
    return response.json()
  },

  // Loan Operations
  async createLoanRequest(data: LoanRequest): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/loans/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) throw new Error('Failed to create loan request')
    return response.json()
  },

  async getLoans(walletAddress: string): Promise<any[]> {
    const response = await fetch(`${API_BASE_URL}/loans?address=${walletAddress}`)
    if (!response.ok) throw new Error('Failed to fetch loans')
    return response.json()
  },

  async getLoanById(loanId: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/loans/${loanId}`)
    if (!response.ok) throw new Error('Failed to fetch loan')
    return response.json()
  },
}
