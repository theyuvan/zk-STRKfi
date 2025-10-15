/**
 * StarkNet Service - Real blockchain integration
 * Fetches STRK token balance and transaction history from Sepolia testnet
 * Ported from test frontend - WORKING VERSION
 */

import { RpcProvider, Contract } from 'starknet'

// StarkNet Sepolia STRK Token Contract
const STRK_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_STRK_TOKEN_ADDRESS || 
  '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d'

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
    name: 'Transfer',
    type: 'event',
    keys: [],
    data: [
      { name: 'from', type: 'felt' },
      { name: 'to', type: 'felt' },
      { name: 'value', type: 'Uint256' }
    ]
  }
]

export class StarkNetService {
  private rpcUrl: string
  private provider: RpcProvider
  private strkContract: Contract
  public erc20Abi: any[]
  private maxRetries: number = 3
  private retryDelay: number = 1000

  constructor() {
    this.rpcUrl = process.env.NEXT_PUBLIC_STARKNET_RPC || 
                  'https://starknet-sepolia.public.blastapi.io/rpc/v0_7'
    this.provider = new RpcProvider({ 
      nodeUrl: this.rpcUrl,
      retries: 3
    })
    this.strkContract = new Contract(ERC20_ABI, STRK_TOKEN_ADDRESS, this.provider)
    this.erc20Abi = ERC20_ABI
  }

  /**
   * Fetch STRK token balance for a wallet
   */
  async fetchStrkBalance(walletAddress: string) {
    try {
      console.log('📊 Fetching STRK balance for:', walletAddress)

      // Call balanceOf on STRK contract
      const result = await this.strkContract.balanceOf(walletAddress)
      
      console.log('📦 Raw balance result:', result)

      // Handle different response structures
      let balance: bigint

      if (result && typeof result.balance === 'bigint') {
        balance = result.balance
      } else if (result && result.balance && (result.balance.low !== undefined || result.balance.high !== undefined)) {
        const balanceLow = BigInt(result.balance.low || 0)
        const balanceHigh = BigInt(result.balance.high || 0)
        balance = balanceLow + (balanceHigh << BigInt(128))
      } else if (Array.isArray(result) && result.length >= 2) {
        balance = BigInt(result[0] || 0) + (BigInt(result[1] || 0) << BigInt(128))
      } else if (result && (result.low !== undefined || result.high !== undefined)) {
        balance = BigInt(result.low || 0) + (BigInt(result.high || 0) << BigInt(128))
      } else if (typeof result === 'bigint') {
        balance = result
      } else {
        console.warn('⚠️ Unexpected balance structure, defaulting to 0')
        balance = BigInt(0)
      }

      // STRK has 18 decimals
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
    } catch (error: any) {
      console.error('❌ Failed to fetch STRK balance:', error)
      console.error('Error details:', error.message)
      
      return {
        raw: '0',
        formatted: '0.000000',
        decimals: 18,
        token: 'STRK',
        address: STRK_TOKEN_ADDRESS,
        error: error.message
      }
    }
  }

  /**
   * Fetch transaction history for a wallet
   */
  async fetchTransactionHistory(walletAddress: string, maxBlocks: number = 100000) {
    try {
      console.log('📜 Fetching transaction history for:', walletAddress)
      
      // Get current block number
      const latestBlock = await this.provider.getBlockNumber()
      const fromBlock = Math.max(0, latestBlock - maxBlocks)

      console.log(`🔍 Scanning blocks ${fromBlock} to ${latestBlock} (scanning ${maxBlocks.toLocaleString()} blocks)`)

      // Fetch Transfer events where user is sender
      const sentEvents = await this.fetchTransferEvents(
        walletAddress,
        null,
        fromBlock,
        latestBlock
      )

      // Fetch Transfer events where user is receiver
      const receivedEvents = await this.fetchTransferEvents(
        null,
        walletAddress,
        fromBlock,
        latestBlock
      )

      // Combine and process events
      const allEvents = [...sentEvents, ...receivedEvents]
      const transactions = await this.processTransferEvents(
        allEvents,
        walletAddress
      )

      // Sort by timestamp (newest first)
      transactions.sort((a, b) => b.timestamp - a.timestamp)

      console.log(`✅ Found ${transactions.length} transactions`)

      return transactions
    } catch (error) {
      console.error('❌ Failed to fetch transaction history:', error)
      return []
    }
  }

  /**
   * Fetch Transfer events from STRK contract
   */
  private async fetchTransferEvents(
    fromAddress: string | null,
    toAddress: string | null,
    fromBlock: number,
    toBlock: number
  ) {
    try {
      const filter = {
        from_block: { block_number: fromBlock },
        to_block: { block_number: toBlock },
        address: STRK_TOKEN_ADDRESS,
        keys: [],
        chunk_size: 100
      }

      const events = await this.provider.getEvents(filter)

      return events.events.filter((event: any) => {
        const eventFrom = event.data[0]
        const eventTo = event.data[1]

        const matchFrom = !fromAddress || eventFrom === fromAddress
        const matchTo = !toAddress || eventTo === toAddress

        return matchFrom && matchTo
      })
    } catch (error) {
      console.warn('⚠️ Event fetching failed:', error)
      return []
    }
  }

  /**
   * Process raw transfer events into transaction objects
   */
  private async processTransferEvents(events: any[], walletAddress: string) {
    const transactions: any[] = []

    for (const event of events) {
      try {
        const from = event.data[0]
        const to = event.data[1]
        const valueLow = BigInt(event.data[2])
        const valueHigh = BigInt(event.data[3] || 0)
        const value = valueLow + (valueHigh << BigInt(128))

        const type = from === walletAddress ? 'sent' : 'received'

        const block = await this.provider.getBlockWithTxs(event.block_number)
        const timestamp = block.timestamp

        transactions.push({
          txHash: event.transaction_hash,
          blockNumber: event.block_number,
          timestamp,
          from,
          to,
          value: value.toString(),
          valueInStrk: Number(value) / 1e18,
          type,
          token: 'STRK'
        })
      } catch (error) {
        console.warn('⚠️ Failed to process event:', error)
      }
    }

    return transactions
  }

  /**
   * Get wallet nonce (transaction count sent by wallet)
   */
  async getWalletNonce(walletAddress: string): Promise<number> {
    try {
      const nonce = await this.provider.getNonceForAddress(walletAddress)
      return Number.parseInt(nonce as any, 16)
    } catch (error) {
      console.warn('⚠️ Failed to get nonce:', error)
      return 0
    }
  }

  /**
   * Calculate comprehensive wallet activity metrics
   */
  async calculateActivityMetrics(walletAddress: string) {
    try {
      console.log('📊 Calculating activity metrics...')

      // Fetch all data in parallel
      const [balance, transactions, nonce] = await Promise.all([
        this.fetchStrkBalance(walletAddress),
        this.fetchTransactionHistory(walletAddress),
        this.getWalletNonce(walletAddress)
      ])

      // Calculate total transaction volume
      const totalVolume = transactions.reduce((sum: number, tx: any) => {
        return sum + tx.valueInStrk
      }, 0)

      // Calculate sent vs received
      const sentTxs = transactions.filter((tx: any) => tx.type === 'sent')
      const receivedTxs = transactions.filter((tx: any) => tx.type === 'received')

      const totalSent = sentTxs.reduce((sum: number, tx: any) => sum + tx.valueInStrk, 0)
      const totalReceived = receivedTxs.reduce((sum: number, tx: any) => sum + tx.valueInStrk, 0)

      // Use nonce (total transactions sent by wallet) as primary txCount
      const actualTxCount = nonce > 0 ? nonce : transactions.length
      
      const metrics = {
        balance: parseFloat(balance.formatted),
        txCount: actualTxCount,
        transferCount: transactions.length,
        nonce,
        totalVolume,
        totalSent,
        totalReceived,
        avgTransactionValue: transactions.length > 0 
          ? totalVolume / transactions.length 
          : 0,
        walletAge: transactions.length > 0
          ? Math.floor((Date.now() / 1000) - transactions.at(-1)!.timestamp)
          : 0,
        recentTxCount: transactions.filter((tx: any) => {
          const sevenDaysAgo = (Date.now() / 1000) - (7 * 24 * 60 * 60)
          return tx.timestamp > sevenDaysAgo
        }).length,
        transactions // Include full transaction list
      }

      console.log('✅ Activity metrics calculated:', metrics)

      return metrics
    } catch (error) {
      console.error('❌ Failed to calculate activity metrics:', error)
      throw error
    }
  }

  /**
   * Check if RPC provider is accessible
   */
  async checkConnection(): Promise<boolean> {
    try {
      await this.provider.getBlockNumber()
      console.log('✅ StarkNet RPC connected:', this.rpcUrl)
      return true
    } catch (error) {
      console.error('❌ StarkNet RPC connection failed:', error)
      return false
    }
  }
}

// Export singleton instance
export const starknetService = new StarkNetService()

// Default export for compatibility
export default StarkNetService
