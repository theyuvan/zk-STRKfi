/**
 * Real Transaction Fetcher using Starknet RPC (Blast API)
 * Fetches actual wallet transactions and calculates activity score
 * Based on working test frontend implementation
 */

const { RpcProvider, constants, hash } = require('starknet');
const logger = require('../utils/logger');

const STARKNET_RPC = process.env.STARKNET_RPC || 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7';
const STRK_TOKEN_ADDRESS = process.env.STRK_TOKEN_ADDRESS || 
  '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';

const provider = new RpcProvider({ nodeUrl: STARKNET_RPC });

/**
 * Fetch transaction history for a wallet address
 * @param {string} walletAddress - The wallet address to analyze
 * @param {number} maxBlocks - Maximum number of blocks to scan (default: 50000)
 * @returns {Promise<Object>} Activity data with transactions
 */
async function fetchRealActivityData(walletAddress, maxBlocks = 50000) {
  try {
    console.log('🔍 Fetching real transactions for:', walletAddress);
    
    // Get current block number and wallet nonce in parallel
    const [latestBlock, nonce] = await Promise.all([
      provider.getBlockNumber(),
      provider.getNonceForAddress(walletAddress)
    ]);
    
    const startBlock = Math.max(0, latestBlock - maxBlocks);
    
    console.log(`📦 Scanning blocks ${startBlock} to ${latestBlock} (${maxBlocks} blocks)`);
    console.log(`📊 Wallet nonce (total txs): ${nonce}`);
    
    // Fetch Transfer events
    const sentTransactions = [];
    const receivedTransactions = [];
    let totalSent = BigInt(0);
    let totalReceived = BigInt(0);
    
    // Get Transfer event selector
    const transferEventKey = hash.getSelectorFromName('Transfer');
    console.log(`🔑 Transfer event key: ${transferEventKey}`);
    
    try {
      // Query all Transfer events (we'll filter client-side)
      const events = await provider.getEvents({
        from_block: { block_number: startBlock },
        to_block: { block_number: latestBlock },
        address: STRK_TOKEN_ADDRESS,
        keys: [[transferEventKey]], // Filter by Transfer event
        chunk_size: 1000
      });
      
      console.log(`� Found ${events.events?.length || 0} total Transfer events`);
      
      if (events.events && events.events.length > 0) {
        // Process each event
        for (const event of events.events) {
          try {
            // StarkNet Transfer event structure:
            // keys: [event_selector, from, to]
            // data: [value_low, value_high]
            const from = event.keys[1];
            const to = event.keys[2];
            const valueLow = BigInt(event.data[0]);
            const valueHigh = BigInt(event.data[1] || 0);
            const value = valueLow + (valueHigh << BigInt(128));
            
            // Normalize addresses for comparison
            const normalizedWallet = walletAddress.toLowerCase();
            const normalizedFrom = from.toLowerCase();
            const normalizedTo = to.toLowerCase();
            
            // Check if this wallet is involved
            const isSender = normalizedFrom === normalizedWallet;
            const isReceiver = normalizedTo === normalizedWallet;
            
            if (isSender) {
              totalSent += value;
              sentTransactions.push({
                type: 'sent',
                txHash: event.transaction_hash,
                blockNumber: event.block_number,
                from: from,
                to: to,
                amount: value.toString(),
                amountFormatted: (Number(value) / 1e18).toFixed(4) + ' STRK',
                timestamp: null
              });
            }
            
            if (isReceiver) {
              totalReceived += value;
              receivedTransactions.push({
                type: 'received',
                txHash: event.transaction_hash,
                blockNumber: event.block_number,
                from: from,
                to: to,
                amount: value.toString(),
                amountFormatted: (Number(value) / 1e18).toFixed(4) + ' STRK',
                timestamp: null
              });
            }
          } catch (parseError) {
            console.warn('⚠️  Failed to parse event:', parseError.message);
          }
        }
      }
      
      console.log(`📤 Sent: ${sentTransactions.length} transactions`);
      console.log(`📥 Received: ${receivedTransactions.length} transactions`);
      
    } catch (error) {
      console.error('Error fetching Transfer events:', error.message);
    }
    
    // Calculate activity score
    // Use nonce (total transactions) as primary count
    // Fall back to Transfer events if nonce is 0
    const actualTxCount = Number(nonce) > 0 ? Number(nonce) : (sentTransactions.length + receivedTransactions.length);
    const transferCount = sentTransactions.length + receivedTransactions.length;
    const totalVolume = totalSent + totalReceived;
    const volumeInSTRK = Number(totalVolume) / 1e18;
    
    // Score calculation (matching test frontend logic):
    // - 10 points per transaction (using nonce for actual tx count)
    // - 1 point per STRK in total volume
    // - Bonus for balanced activity (both sending and receiving)
    const balanceBonus = (sentTransactions.length > 0 && receivedTransactions.length > 0) ? 100 : 0;
    
    const score = Math.min(1000, Math.round(
      (actualTxCount * 10) +     // Transaction count weight (using nonce)
      volumeInSTRK +              // Volume weight
      balanceBonus                // Activity balance bonus
    ));
    
    console.log('✅ Activity score calculated:', {
      score,
      actualTxCount,
      transferCount,
      sent: sentTransactions.length,
      received: receivedTransactions.length,
      totalVolume: volumeInSTRK.toFixed(4),
      source: Number(nonce) > 0 ? 'wallet nonce' : 'STRK transfers'
    });
    
    return {
      score,
      totalTransactions: actualTxCount,
      transferCount, // STRK transfers only
      nonce: Number(nonce), // Keep raw nonce
      sentTransactions: {
        count: sentTransactions.length,
        totalAmount: totalSent.toString(),
        totalAmountFormatted: (Number(totalSent) / 1e18).toFixed(4) + ' STRK',
        transactions: sentTransactions.slice(0, 20) // Latest 20
      },
      receivedTransactions: {
        count: receivedTransactions.length,
        totalAmount: totalReceived.toString(),
        totalAmountFormatted: (Number(totalReceived) / 1e18).toFixed(4) + ' STRK',
        transactions: receivedTransactions.slice(0, 20) // Latest 20
      },
      totalVolume: totalVolume.toString(),
      totalVolumeFormatted: volumeInSTRK.toFixed(4) + ' STRK',
      walletAddress,
      scannedBlocks: maxBlocks,
      timestamp: new Date().toISOString(),
      dataSource: 'starknet-rpc-blast-api-v2'
    };
    
  } catch (error) {
    console.error('❌ Failed to fetch real activity data:', error);
    logger.error('Activity fetch error:', { error: error.message, stack: error.stack });
    
    // Fallback to minimal data
    return {
      score: 0,
      totalTransactions: 0,
      transferCount: 0,
      nonce: 0,
      sentTransactions: { count: 0, totalAmount: '0', totalAmountFormatted: '0.0000 STRK', transactions: [] },
      receivedTransactions: { count: 0, totalAmount: '0', totalAmountFormatted: '0.0000 STRK', transactions: [] },
      totalVolume: '0',
      totalVolumeFormatted: '0.0000 STRK',
      walletAddress,
      error: error.message,
      dataSource: 'fallback',
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Get simplified activity score (backward compatible)
 * @param {string} walletAddress 
 * @returns {Promise<number>} Activity score (0-1000)
 */
async function getActivityScore(walletAddress) {
  const data = await fetchRealActivityData(walletAddress);
  return data.score;
}

module.exports = {
  fetchRealActivityData,
  getActivityScore
};
