import { RpcProvider, num, Contract } from 'starknet';

/**
 * StarkNet Service - Real blockchain integration (NO MOCKS)
 * Fetches STRK token balance and transaction history from Sepolia testnet
 */

// StarkNet Sepolia STRK Token Contract - ✅ Configured from env
const STRK_TOKEN_ADDRESS = import.meta.env.VITE_STRK_TOKEN_ADDRESS || 
  '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';

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
];

export class StarkNetService {
  constructor() {
    this.rpcUrl = import.meta.env.VITE_STARKNET_RPC || 
                  'https://starknet-sepolia.public.blastapi.io';
    this.provider = new RpcProvider({ nodeUrl: this.rpcUrl });
    this.strkContract = new Contract(ERC20_ABI, STRK_TOKEN_ADDRESS, this.provider);
    this.erc20Abi = ERC20_ABI; // Export ABI for external use
  }

  /**
   * Fetch STRK token balance for a wallet
   * @param {string} walletAddress - StarkNet wallet address
   * @returns {Promise<object>} Balance information
   */
  async fetchStrkBalance(walletAddress) {
    try {
      console.log('📊 Fetching STRK balance for:', walletAddress);

      // Call balanceOf on STRK contract
      const result = await this.strkContract.balanceOf(walletAddress);
      
      console.log('📦 Raw balance result:', result);

      // Handle different response structures
      let balance;
      
      if (result && typeof result.balance === 'bigint') {
        // Structure: { balance: BigInt }
        balance = result.balance;
      } else if (result && result.balance && (result.balance.low !== undefined || result.balance.high !== undefined)) {
        // Structure: { balance: { low, high } }
        const balanceLow = BigInt(result.balance.low || 0);
        const balanceHigh = BigInt(result.balance.high || 0);
        balance = balanceLow + (balanceHigh << 128n);
      } else if (Array.isArray(result) && result.length >= 2) {
        // Structure: [low, high]
        balance = BigInt(result[0] || 0) + (BigInt(result[1] || 0) << 128n);
      } else if (result && (result.low !== undefined || result.high !== undefined)) {
        // Structure: { low, high }
        balance = BigInt(result.low || 0) + (BigInt(result.high || 0) << 128n);
      } else if (typeof result === 'bigint') {
        // Direct BigInt
        balance = result;
      } else {
        console.warn('⚠️ Unexpected balance structure, defaulting to 0');
        balance = 0n;
      }

      // STRK has 18 decimals
      const decimals = 18;
      const balanceInStrk = Number(balance) / Math.pow(10, decimals);

      console.log('✅ STRK Balance:', balanceInStrk, 'STRK');

      return {
        raw: balance.toString(),
        formatted: balanceInStrk.toFixed(6),
        decimals,
        token: 'STRK',
        address: STRK_TOKEN_ADDRESS
      };
    } catch (error) {
      console.error('❌ Failed to fetch STRK balance:', error);
      console.error('Error details:', error.message);
      
      // Return zero balance instead of throwing to prevent UI breaking
      return {
        raw: '0',
        formatted: '0.000000',
        decimals: 18,
        token: 'STRK',
        address: STRK_TOKEN_ADDRESS,
        error: error.message
      };
    }
  }

  /**
   * Fetch transaction history for a wallet
   * Retrieves Transfer events where wallet is sender or receiver
   * @param {string} walletAddress - StarkNet wallet address
   * @param {number} maxBlocks - How many blocks to look back (default: 10000)
   * @returns {Promise<Array>} Transaction history
   */
  async fetchTransactionHistory(walletAddress, maxBlocks = 10000) {
    try {
      console.log('📜 Fetching transaction history for:', walletAddress);
      
      // Get current block number
      const latestBlock = await this.provider.getBlockNumber();
      const fromBlock = Math.max(0, latestBlock - maxBlocks);

      console.log(`🔍 Scanning blocks ${fromBlock} to ${latestBlock}`);

      // Fetch Transfer events where user is sender
      const sentEvents = await this.fetchTransferEvents(
        walletAddress,
        null, // any receiver
        fromBlock,
        latestBlock
      );

      // Fetch Transfer events where user is receiver
      const receivedEvents = await this.fetchTransferEvents(
        null, // any sender
        walletAddress,
        fromBlock,
        latestBlock
      );

      // Combine and process events
      const allEvents = [...sentEvents, ...receivedEvents];
      const transactions = await this.processTransferEvents(
        allEvents,
        walletAddress
      );

      // Sort by timestamp (newest first)
      transactions.sort((a, b) => b.timestamp - a.timestamp);

      console.log(`✅ Found ${transactions.length} transactions`);

      return transactions;
    } catch (error) {
      console.error('❌ Failed to fetch transaction history:', error);
      // Return empty array instead of throwing - wallet might be new
      return [];
    }
  }

  /**
   * Fetch Transfer events from STRK contract
   * @private
   */
  async fetchTransferEvents(fromAddress, toAddress, fromBlock, toBlock) {
    try {
      // Build event filter
      const filter = {
        from_block: { block_number: fromBlock },
        to_block: { block_number: toBlock },
        address: STRK_TOKEN_ADDRESS,
        keys: [], // Transfer event keys
        chunk_size: 100
      };

      // Note: StarkNet RPC event filtering is limited
      // We'll fetch all Transfer events and filter client-side
      const events = await this.provider.getEvents(filter);

      // Filter events based on from/to addresses
      return events.events.filter(event => {
        const eventFrom = event.data[0];
        const eventTo = event.data[1];

        const matchFrom = !fromAddress || eventFrom === fromAddress;
        const matchTo = !toAddress || eventTo === toAddress;

        return matchFrom && matchTo;
      });
    } catch (error) {
      console.warn('⚠️ Event fetching failed:', error.message);
      return [];
    }
  }

  /**
   * Process raw transfer events into transaction objects
   * @private
   */
  async processTransferEvents(events, walletAddress) {
    const transactions = [];

    for (const event of events) {
      try {
        // Parse event data
        const from = event.data[0];
        const to = event.data[1];
        const valueLow = BigInt(event.data[2]);
        const valueHigh = BigInt(event.data[3] || 0);
        const value = valueLow + (valueHigh << 128n);

        // Determine transaction type
        const type = from === walletAddress ? 'sent' : 'received';

        // Get block timestamp
        const block = await this.provider.getBlockWithTxs(event.block_number);
        const timestamp = block.timestamp;

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
        });
      } catch (error) {
        console.warn('⚠️ Failed to process event:', error.message);
        // Continue processing other events
      }
    }

    return transactions;
  }

  /**
   * Get latest transaction for a wallet (to detect new activity)
   * @param {string} walletAddress - StarkNet wallet address
   * @returns {Promise<object|null>} Latest transaction or null
   */
  async getLatestTransaction(walletAddress) {
    const history = await this.fetchTransactionHistory(walletAddress, 1000);
    return history.length > 0 ? history[0] : null;
  }

  /**
   * Get wallet nonce (transaction count sent by wallet)
   * @param {string} walletAddress - StarkNet wallet address
   * @returns {Promise<number>} Nonce
   */
  async getWalletNonce(walletAddress) {
    try {
      const nonce = await this.provider.getNonceForAddress(walletAddress);
      return parseInt(nonce, 16);
    } catch (error) {
      console.warn('⚠️ Failed to get nonce:', error.message);
      return 0;
    }
  }

  /**
   * Calculate comprehensive wallet activity metrics
   * @param {string} walletAddress - StarkNet wallet address
   * @returns {Promise<object>} Activity metrics
   */
  async calculateActivityMetrics(walletAddress) {
    try {
      console.log('📊 Calculating activity metrics...');

      // Fetch all data in parallel
      const [balance, transactions, nonce] = await Promise.all([
        this.fetchStrkBalance(walletAddress),
        this.fetchTransactionHistory(walletAddress),
        this.getWalletNonce(walletAddress)
      ]);

      // Calculate total transaction volume
      const totalVolume = transactions.reduce((sum, tx) => {
        return sum + tx.valueInStrk;
      }, 0);

      // Calculate sent vs received
      const sentTxs = transactions.filter(tx => tx.type === 'sent');
      const receivedTxs = transactions.filter(tx => tx.type === 'received');

      const totalSent = sentTxs.reduce((sum, tx) => sum + tx.valueInStrk, 0);
      const totalReceived = receivedTxs.reduce((sum, tx) => sum + tx.valueInStrk, 0);

      // Calculate activity score components
      // Use nonce (total transactions sent by wallet) as primary txCount
      // Fall back to STRK transfer events if nonce is 0
      const actualTxCount = nonce > 0 ? nonce : transactions.length;
      
      const metrics = {
        // Raw data
        balance: parseFloat(balance.formatted),
        txCount: actualTxCount, // ✅ USE NONCE for actual transaction count
        transferCount: transactions.length, // STRK transfers only
        nonce, // Keep raw nonce for debugging
        totalVolume,
        totalSent,
        totalReceived,
        
        // Derived metrics
        avgTransactionValue: transactions.length > 0 
          ? totalVolume / transactions.length 
          : 0,
        
        // Age of wallet (based on oldest tx)
        walletAge: transactions.length > 0
          ? Math.floor((Date.now() / 1000) - transactions[transactions.length - 1].timestamp)
          : 0,
        
        // Recent activity (last 7 days)
        recentTxCount: transactions.filter(tx => {
          const sevenDaysAgo = (Date.now() / 1000) - (7 * 24 * 60 * 60);
          return tx.timestamp > sevenDaysAgo;
        }).length
      };

      console.log('✅ Activity metrics calculated:', metrics);
      console.log('📊 Transaction count breakdown:', {
        nonce: nonce,
        strkTransfers: transactions.length,
        finalTxCount: actualTxCount,
        source: nonce > 0 ? 'wallet nonce' : 'STRK transfers'
      });

      return metrics;
    } catch (error) {
      console.error('❌ Failed to calculate activity metrics:', error);
      throw error;
    }
  }

  /**
   * Check if RPC provider is accessible
   * @returns {Promise<boolean>} True if accessible
   */
  async checkConnection() {
    try {
      await this.provider.getBlockNumber();
      console.log('✅ StarkNet RPC connected:', this.rpcUrl);
      return true;
    } catch (error) {
      console.error('❌ StarkNet RPC connection failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const starknetService = new StarkNetService();

// Default export for compatibility
export default StarkNetService;
