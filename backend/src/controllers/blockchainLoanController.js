/**
 * Blockchain Loan Controller
 * Fetches loan data directly from StarkNet blockchain
 */

const logger = require('../utils/logger');

/**
 * Get loans by lender (from blockchain)
 * GET /api/loan/lender/:address
 */
exports.getLoansByLender = async (req, res) => {
  try {
    const { address } = req.params;
    const { Contract, RpcProvider } = require('starknet');

    logger.info(`🔍 [BLOCKCHAIN] Fetching loans for lender: ${address}`);

    // Initialize provider
    const provider = new RpcProvider({
      nodeUrl: process.env.STARKNET_RPC_URL || 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7'
    });

    // Contract addresses
    const loanEscrowAddress = process.env.LOAN_ESCROW_ZK_ADDRESS || 
      '0x05a4d3ed7d102ab91715c2b36c70b5e9795a3e917214dbd9af40503d2c29f83d';

    logger.info(`📍 [BLOCKCHAIN] Contract address: ${loanEscrowAddress}`);

    // Load ABI
    const loanEscrowAbi = require('../contracts/loan_escrow_zk_abi.json');

    // Create contract instance
    const contract = new Contract(loanEscrowAbi, loanEscrowAddress, provider);

    // Get loan count
    logger.info('📊 [BLOCKCHAIN] Calling get_loan_count...');
    const loanCountResult = await contract.get_loan_count();
    
    logger.info(`📊 [BLOCKCHAIN] Raw loan count result: ${JSON.stringify(loanCountResult)}`);
    
    // Handle Uint256 result - could be BigInt, number, or {low, high} object
    let count;
    if (typeof loanCountResult === 'bigint') {
      count = Number(loanCountResult);
    } else if (typeof loanCountResult === 'number') {
      count = loanCountResult;
    } else if (loanCountResult && typeof loanCountResult === 'object') {
      // Uint256 object with low/high
      if (loanCountResult.low !== undefined) {
        count = Number(loanCountResult.low);
      } else {
        count = 0;
      }
    } else {
      count = 0;
    }

    logger.info(`📊 [BLOCKCHAIN] Total loans on blockchain: ${count}`);

    // Fetch all loans and filter by lender
    const loans = [];
    for (let i = 1; i <= count; i++) {
      try {
        logger.info(`🔎 [BLOCKCHAIN] Fetching loan ${i}...`);
        const loanDetails = await contract.get_loan_details(i);
        
        logger.info(`📦 [BLOCKCHAIN] Loan ${i} raw data:`, JSON.stringify(loanDetails, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value
        ));

        // The contract returns LoanOffer struct
        // Parse the data - starknet.js should return an object with named fields
        const lenderAddr = loanDetails.lender || loanDetails[0];
        const normalizedLender = lenderAddr.toString().toLowerCase();
        const normalizedAddress = address.toLowerCase();
        
        logger.info(`🔍 [BLOCKCHAIN] Comparing lender: ${normalizedLender} with ${normalizedAddress}`);
        
        // Check if this loan belongs to the lender
        if (normalizedLender === normalizedAddress) {
          const loanData = {
            loanId: i.toString(),
            lender: lenderAddr.toString(),
            amountPerBorrower: (loanDetails.amount_per_borrower || loanDetails[1]).toString(),
            totalSlots: Number(loanDetails.total_slots || loanDetails[2]),
            filledSlots: Number(loanDetails.filled_slots || loanDetails[3]),
            interestRateBps: (loanDetails.interest_rate_bps || loanDetails[4]).toString(),
            repaymentPeriod: Number(loanDetails.repayment_period || loanDetails[5]),
            minActivityScore: (loanDetails.min_activity_score || loanDetails[6]).toString(),
            status: Number(loanDetails.status || loanDetails[7]),
            createdAt: Number(loanDetails.created_at || loanDetails[8])
          };
          
          logger.info(`✅ [BLOCKCHAIN] Found matching loan ${i}:`, loanData);
          loans.push(loanData);
        }
      } catch (error) {
        logger.error(`❌ [BLOCKCHAIN] Failed to fetch loan ${i}:`, error.message);
        logger.error('[BLOCKCHAIN] Full error:', error);
      }
    }

    logger.info(`✅ [BLOCKCHAIN] Found ${loans.length} loans for lender ${address}`);

    res.json({
      success: true,
      count: loans.length,
      loans
    });

  } catch (error) {
    logger.error('❌ [BLOCKCHAIN] Get loans by lender error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
