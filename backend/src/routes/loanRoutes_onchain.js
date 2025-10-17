const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { RpcProvider, Contract, CallData, uint256, hash } = require('starknet');
const commitmentCache = require('../services/commitmentCacheService'); // Import at top!
const identityCommitmentStore = require('../services/identityCommitmentStore');

// Contract addresses (update after deployment)
const LOAN_ESCROW_ZK_ADDRESS = process.env.LOAN_ESCROW_ZK_ADDRESS || '0x06b058a0946bb36fa846e6a954da885fa20809f43a9e47038dc83b4041f7f012';
const ACTIVITY_VERIFIER_ADDRESS = process.env.ACTIVITY_VERIFIER_ADDRESS || '0x071b94eb84b81868b61fb0ec1bbb59df47bb508583bc79325e5fa997ee3eb4be';
const STRK_TOKEN_ADDRESS = process.env.STRK_TOKEN_ADDRESS || '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';
const RPC_URL = process.env.STARKNET_RPC || 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7';

const provider = new RpcProvider({ nodeUrl: RPC_URL });

// ABI for LoanEscrowZK contract
const ESCROW_ABI = [
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
];

// ABI for ActivityVerifier contract
const VERIFIER_ABI = [
  {
    name: 'register_proof',
    type: 'function',
    inputs: [
      { name: 'proof_hash', type: 'felt252' },
      { name: 'commitment', type: 'felt252' },
      { name: 'activity_score', type: 'u256' }
    ],
    outputs: [],
    stateMutability: 'external'
  },
  {
    name: 'get_proof_score',
    type: 'function',
    inputs: [{ name: 'proof_hash', type: 'felt252' }],
    outputs: [{ name: 'score', type: 'u256' }],
    stateMutability: 'view'
  }
];

/**
 * Register ZK proof on-chain (called by backend after generating proof)
 * This allows the contract to verify it later
 */
router.post('/register-proof', async (req, res) => {
  try {
    const { proofHash, commitment, activityScore } = req.body;

    if (!proofHash || !commitment || !activityScore) {
      return res.status(400).json({
        error: 'Missing required fields: proofHash, commitment, activityScore'
      });
    }

    logger.info('📝 Registering ZK proof on-chain', {
      proofHash,
      commitment: commitment.slice(0, 20) + '...',
      activityScore
    });

    // In production, you'd use a wallet to sign this transaction
    // For now, we return the transaction data for the frontend to execute
    res.json({
      success: true,
      message: 'Proof registration data prepared',
      data: {
        contractAddress: ACTIVITY_VERIFIER_ADDRESS,
        entrypoint: 'register_proof',
        calldata: {
          proof_hash: proofHash,
          commitment,
          activity_score: activityScore
        }
      }
    });
  } catch (error) {
    logger.error('❌ Error registering proof:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all loan offers from blockchain events
 */
router.get('/available', async (req, res) => {
  try {
    logger.info('📋 Fetching available loans from blockchain');

    const escrowContract = new Contract(ESCROW_ABI, LOAN_ESCROW_ZK_ADDRESS, provider);
    const loanCountRaw = await escrowContract.get_loan_count();
    
    // Parse loan count from {count: {low, high}} structure
    let loanCount;
    if (loanCountRaw?.count) {
      if (typeof loanCountRaw.count === 'bigint') {
        loanCount = Number(loanCountRaw.count);
      } else if (loanCountRaw.count?.low !== undefined) {
        loanCount = Number(loanCountRaw.count.low);
      }
    }
    
    logger.info(`✅ Total loans on-chain: ${loanCount}`);

    const loans = [];
    
    // Fetch all loans
    for (let i = 1; i <= Number(loanCount); i++) {
      try {
        // Convert to u256 and extract low/high felts
        const { low, high } = uint256.bnToUint256(BigInt(i));
        const rawResult = await provider.callContract({
          contractAddress: LOAN_ESCROW_ZK_ADDRESS,
          entrypoint: 'get_loan_details',
          calldata: [low, high]
        });
        
        // Parse LoanOffer struct
        const loanDetails = {
          lender: rawResult.result[0],
          amount_per_borrower: uint256.uint256ToBN({ low: rawResult.result[1], high: rawResult.result[2] }),
          total_slots: Number(rawResult.result[3]),
          filled_slots: Number(rawResult.result[4]),
          interest_rate_bps: uint256.uint256ToBN({ low: rawResult.result[5], high: rawResult.result[6] }),
          repayment_period: Number(rawResult.result[7]),
          min_activity_score: uint256.uint256ToBN({ low: rawResult.result[8], high: rawResult.result[9] }),
          status: Number(rawResult.result[10]),
          created_at: Number(rawResult.result[11])
        };
        
        // Log loan #36 to debug slots issue
        if (i === 36) {
          logger.info(`🔍 Loan #36 raw data from contract:`, {
            total_slots_raw: rawResult.result[3],
            filled_slots_raw: rawResult.result[4],
            total_slots_parsed: loanDetails.total_slots,
            filled_slots_parsed: loanDetails.filled_slots,
            calculation: `${loanDetails.total_slots} - ${loanDetails.filled_slots} = ${loanDetails.total_slots - loanDetails.filled_slots}`
          });
        }
        
        // Include active loans (status=0) - show even if filled_slots = total_slots
        // Borrowers can still apply (pending), lender decides whether to approve
        if (loanDetails.status === 0) {
          const slotsRemaining = Number(loanDetails.total_slots) - Number(loanDetails.filled_slots);
          const amountPerBorrower = loanDetails.amount_per_borrower.toString();
          const interestRateBps = loanDetails.interest_rate_bps.toString();
          const interestRate = Number(interestRateBps) / 100; // Convert bps to percentage
          
          loans.push({
            loanId: i.toString(), // Frontend expects loanId
            id: i.toString(), // Keep for compatibility
            lender: loanDetails.lender,
            loanAmount: amountPerBorrower, // Frontend expects loanAmount
            amountPerBorrower: amountPerBorrower, // Keep for compatibility
            totalSlots: Number(loanDetails.total_slots),
            filledSlots: Number(loanDetails.filled_slots),
            slotsRemaining: slotsRemaining,
            availableSlots: slotsRemaining,
            interestRate: interestRate, // As number percentage (10 not "1000")
            interestRateBps: interestRateBps, // Keep bps as string
            repaymentPeriod: Number(loanDetails.repayment_period),
            minActivityScore: loanDetails.min_activity_score.toString(),
            status: 0,
            isActive: true,
            createdAt: new Date(Number(loanDetails.created_at) * 1000).toISOString()
          });
          
          // Log loan #36 final data
          if (i === 36) {
            logger.info(`📦 Loan #36 final data being sent to frontend:`, {
              totalSlots: Number(loanDetails.total_slots),
              filledSlots: Number(loanDetails.filled_slots),
              slotsRemaining: slotsRemaining
            });
          }
        }
      } catch (error) {
        logger.error(`Error fetching loan ${i}:`, error.message);
      }
    }

    logger.info(`✅ Found ${loans.length} available loans`);
    res.json(loans);
  } catch (error) {
    logger.error('❌ Error fetching loans:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get loans created by a specific lender
 */
router.get('/lender/:lenderAddress', async (req, res) => {
  try {
    const { lenderAddress } = req.params;
    logger.info(`� [ONCHAIN-V1] Fetching loans for lender: ${lenderAddress}`);

    const escrowContract = new Contract(ESCROW_ABI, LOAN_ESCROW_ZK_ADDRESS, provider);
    const loanCountRaw = await escrowContract.get_loan_count();
    
    logger.info(`📊 [ONCHAIN-V1] Raw loan count type: ${typeof loanCountRaw}`);
    logger.info(`📊 [ONCHAIN-V1] Object keys: ${Object.keys(loanCountRaw || {}).join(', ')}`);
    
    // Parse loan count - handle different response structures
    let loanCount;
    if (typeof loanCountRaw === 'bigint') {
      loanCount = Number(loanCountRaw);
      logger.info(`📊 [ONCHAIN-V1] Parsed as bigint: ${loanCount}`);
    } else if (typeof loanCountRaw === 'number') {
      loanCount = loanCountRaw;
      logger.info(`📊 [ONCHAIN-V1] Parsed as number: ${loanCount}`);
    } else if (loanCountRaw?.count !== undefined) {
      // Handle {count: <Uint256>} structure - extract count.low or count directly
      const countValue = loanCountRaw.count;
      if (typeof countValue === 'bigint') {
        loanCount = Number(countValue);
      } else if (countValue?.low) {
        loanCount = Number(countValue.low);
      } else {
        loanCount = Number(countValue);
      }
      logger.info(`📊 [ONCHAIN-V1] Parsed from .count property: ${loanCount}`);
    } else if (loanCountRaw?.low !== undefined) {
      // Handle direct Uint256 {low, high} structure
      loanCount = Number(loanCountRaw.low);
      logger.info(`📊 [ONCHAIN-V1] Parsed from .low property: ${loanCount}`);
    } else {
      logger.warn(`⚠️ [ONCHAIN-V1] Unknown loan count structure, defaulting to 0`);
      loanCount = 0;
    }
    
    logger.info(`📊 [ONCHAIN-V1] Final parsed loan count: ${loanCount}`);
    
    const loans = [];
    
    for (let i = 1; i <= loanCount; i++) {
      try {
        logger.info(`🔍 [ONCHAIN-V1] Fetching loan ${i}...`);
        
        // Convert to u256 and extract low/high felts
        const { low, high } = uint256.bnToUint256(BigInt(i));
        const rawResult = await provider.callContract({
          contractAddress: LOAN_ESCROW_ZK_ADDRESS,
          entrypoint: 'get_loan_details',
          calldata: [low, high]
        });
        
        // Parse LoanOffer struct from raw result
        // [lender, amount_low, amount_high, total_slots, filled_slots, 
        //  interest_low, interest_high, repayment_period, min_score_low, min_score_high, status, created_at]
        const loanDetails = {
          lender: rawResult.result[0],
          amount_per_borrower: uint256.uint256ToBN({ low: rawResult.result[1], high: rawResult.result[2] }),
          total_slots: Number(rawResult.result[3]),
          filled_slots: Number(rawResult.result[4]),
          interest_rate_bps: uint256.uint256ToBN({ low: rawResult.result[5], high: rawResult.result[6] }),
          repayment_period: Number(rawResult.result[7]),
          min_activity_score: uint256.uint256ToBN({ low: rawResult.result[8], high: rawResult.result[9] }),
          status: Number(rawResult.result[10]),
          created_at: Number(rawResult.result[11])
        };
        
        logger.info(`📦 [ONCHAIN-V1] Loan ${i} details received, lender: ${loanDetails.lender}`);
        
        // Filter by lender address
        if (loanDetails.lender.toLowerCase() === lenderAddress.toLowerCase()) {
          const amountPerBorrower = loanDetails.amount_per_borrower.toString();
          const interestRateBps = loanDetails.interest_rate_bps.toString();
          const interestRate = Number(interestRateBps) / 100; // Convert bps to percentage
          const slotsRemaining = Number(loanDetails.total_slots) - Number(loanDetails.filled_slots);
          
          loans.push({
            loanId: i.toString(), // Frontend expects loanId
            id: i.toString(), // Keep for compatibility
            lender: loanDetails.lender,
            loanAmount: amountPerBorrower, // Frontend expects loanAmount
            amountPerBorrower: amountPerBorrower, // Keep for compatibility
            totalSlots: Number(loanDetails.total_slots),
            filledSlots: Number(loanDetails.filled_slots),
            slotsRemaining: slotsRemaining,
            availableSlots: slotsRemaining,
            interestRate: interestRate, // As number percentage (10 not "1000")
            interestRateBps: interestRateBps, // Keep bps as string
            repaymentPeriod: Number(loanDetails.repayment_period),
            minActivityScore: loanDetails.min_activity_score.toString(),
            status: Number(loanDetails.status),
            isActive: loanDetails.status === 0,
            createdAt: new Date(Number(loanDetails.created_at) * 1000).toISOString()
          });
          logger.info(`✅ [ONCHAIN-V1] Added loan ${i} to results`);
        } else {
          logger.info(`⏭️ [ONCHAIN-V1] Skipping loan ${i} (different lender: ${loanDetails.lender})`);
        }
      } catch (error) {
        logger.error(`❌ [ONCHAIN-V1] Error fetching loan ${i}:`, {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }
    }

    logger.info(`✅ Found ${loans.length} loans for lender`);
    res.json({ loans });
  } catch (error) {
    logger.error('❌ Error fetching lender loans:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get application details for a specific loan and commitment
 */
router.get('/application/:loanId/:commitment', async (req, res) => {
  try {
    const { loanId, commitment } = req.params;
    
    logger.info('📬 Fetching application', { loanId, commitment: commitment.slice(0, 20) + '...' });

    // Convert loanId to u256 format
    const { low: loanLow, high: loanHigh } = uint256.bnToUint256(BigInt(loanId));

    // Use raw callContract to have full control over parameter formatting
    const appRawResult = await provider.callContract({
      contractAddress: LOAN_ESCROW_ZK_ADDRESS,
      entrypoint: 'get_application',
      calldata: [loanLow, loanHigh, commitment]
    });

    const application = {
      borrower: appRawResult.result[0],
      commitment: appRawResult.result[1],
      proof_hash: appRawResult.result[2],
      status: Number(appRawResult.result[3]),
      applied_at: Number(appRawResult.result[4]),
      approved_at: Number(appRawResult.result[5]),
      repaid_at: Number(appRawResult.result[6]),
      repayment_deadline: Number(appRawResult.result[7])
    };

    if (application.borrower === '0x0' || !application.borrower) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const result = {
      loanId,
      borrower: application.borrower,
      commitment: application.commitment,
      proofHash: application.proof_hash,
      status: application.status === 0 ? 'pending' : application.status === 1 ? 'approved' : 'repaid',
      appliedAt: new Date(application.applied_at * 1000).toISOString(),
      approvedAt: application.approved_at > 0 ? new Date(application.approved_at * 1000).toISOString() : null,
      repaidAt: application.repaid_at > 0 ? new Date(application.repaid_at * 1000).toISOString() : null,
      repaymentDeadline: application.repayment_deadline > 0 ? new Date(application.repayment_deadline * 1000).toISOString() : null
    };

    logger.info('✅ Application found:', result.status);
    res.json(result);
  } catch (error) {
    logger.error('❌ Error fetching application:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all applications for a specific loan
 * Queries LoanApplicationSubmitted events from blockchain
 */
router.get('/:loanId/applications', async (req, res) => {
  try {
    const { loanId } = req.params;
    
    logger.info('📬 Fetching applications for loan:', loanId);

    const escrowContract = new Contract(ESCROW_ABI, LOAN_ESCROW_ZK_ADDRESS, provider);
    
    // Get loan details first to verify loan exists
    const { low: loanLow, high: loanHigh } = uint256.bnToUint256(BigInt(loanId));
    
    const loanRawResult = await provider.callContract({
      contractAddress: LOAN_ESCROW_ZK_ADDRESS,
      entrypoint: 'get_loan_details',
      calldata: [loanLow, loanHigh]
    });
    
    const loanDetails = {
      lender: loanRawResult.result[0],
      amount_per_borrower: uint256.uint256ToBN({ low: loanRawResult.result[1], high: loanRawResult.result[2] }),
      interest_rate_bps: uint256.uint256ToBN({ low: loanRawResult.result[5], high: loanRawResult.result[6] }),
      min_activity_score: uint256.uint256ToBN({ low: loanRawResult.result[8], high: loanRawResult.result[9] })
    };
    
    logger.info('✅ Loan found', { loanId, lender: loanDetails.lender });
    
    // NEW APPROACH: Query blockchain events for LoanApplicationSubmitted
    const applications = [];
    
    try {
      logger.info('🔍 Querying blockchain events for loan applications...');
      
      // Get the event selector for LoanApplicationSubmitted
      const { hash } = require('starknet');
      const eventKey = hash.getSelectorFromName('LoanApplicationSubmitted');
      
      logger.info(`� Event key: ${eventKey}, Loan ID: ${loanId}`);
      
      // Get current block and query recent blocks (last 10k blocks to avoid RPC limits)
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 10000);
      logger.info(`Querying events from block ${fromBlock} to ${currentBlock}`);
      
      // Query events from the blockchain
      // Event keys structure: [event_selector, loan_id.low, loan_id.high, commitment]
      const events = await provider.getEvents({
        address: LOAN_ESCROW_ZK_ADDRESS,
        keys: [[eventKey]], // Just filter by event type, we'll filter by loan_id manually
        from_block: { block_number: fromBlock },
        to_block: 'latest',
        chunk_size: 1000,
        continuation_token: undefined
      });

      logger.info(`📦 Found ${events.events.length} total LoanApplicationSubmitted events`);

      // Parse events and filter by loan_id
      for (const event of events.events) {
        try {
          // Event structure:
          // keys: [event_selector, loan_id.low, loan_id.high, commitment]
          // data: [borrower, proof_hash]
          
          // Extract loan_id from event keys (indices 1 and 2)
          const eventLoanIdLow = event.keys[1];
          const eventLoanIdHigh = event.keys[2] || '0x0';
          const eventLoanId = uint256.uint256ToBN({ 
            low: eventLoanIdLow, 
            high: eventLoanIdHigh 
          }).toString();
          
          // Only process events for THIS loan
          if (eventLoanId !== loanId) {
            continue;
          }
          
          const commitment = event.keys[3];
          const borrower = event.data[0];
          const proof_hash = event.data[1];
          
          logger.info(`✅ Found application event!`, { 
            loanId: eventLoanId,
            borrower,
            commitment: commitment?.slice(0, 20) + '...',
            txHash: event.transaction_hash
          });
          
          // Get activity score from verifier
          let activityScore = 0;
          try {
            const scoreResult = await provider.callContract({
              contractAddress: ACTIVITY_VERIFIER_ADDRESS,
              entrypoint: 'get_proof_score',
              calldata: [proof_hash]
            });
            activityScore = uint256.uint256ToBN({ 
              low: scoreResult.result[0], 
              high: scoreResult.result[1] 
            }).toString();
          } catch (scoreError) {
            logger.warn('Could not fetch activity score:', scoreError.message);
          }
          
          // Get application details from contract
          let appStatus = 'pending';
          let appliedAt = null;
          let approvedAt = null;
          let repaidAt = null;
          let repaymentDeadline = null;
          
          try {
            const appRawResult = await provider.callContract({
              contractAddress: LOAN_ESCROW_ZK_ADDRESS,
              entrypoint: 'get_application',
              calldata: [loanLow, loanHigh, commitment]
            });

            const appDetails = {
              status: Number(appRawResult.result[3]),
              applied_at: Number(appRawResult.result[4]),
              approved_at: Number(appRawResult.result[5]),
              repaid_at: Number(appRawResult.result[6]),
              repayment_deadline: Number(appRawResult.result[7])
            };
            
            appStatus = appDetails.status === 0 ? 'pending' : appDetails.status === 1 ? 'approved' : 'repaid';
            appliedAt = appDetails.applied_at > 0 ? new Date(appDetails.applied_at * 1000).toISOString() : null;
            approvedAt = appDetails.approved_at > 0 ? new Date(appDetails.approved_at * 1000).toISOString() : null;
            repaidAt = appDetails.repaid_at > 0 ? new Date(appDetails.repaid_at * 1000).toISOString() : null;
            repaymentDeadline = appDetails.repayment_deadline > 0 ? new Date(appDetails.repayment_deadline * 1000).toISOString() : null;
          } catch (error_) {
            logger.warn('Could not fetch application details:', error_.message);
          }

          applications.push({
            loanId: eventLoanId,
            borrower,
            borrowerCommitment: commitment,
            commitment,
            proofHash: proof_hash,
            activityScore,
            status: appStatus,
            timestamp: appliedAt || new Date(event.block_number * 6000).toISOString(),
            appliedAt,
            approvedAt,
            repaidAt,
            repaymentDeadline,
            blockNumber: event.block_number,
            transactionHash: event.transaction_hash
          });
          
        } catch (parseError) {
          logger.error('Error parsing event:', parseError.message);
        }
      }
      
      logger.info(`✅ Found ${applications.length} applications for loan ${loanId}`);
      
    } catch (eventError) {
      logger.error('❌ Event query failed:', eventError.message);
      logger.error('Error stack:', eventError.stack);
      logger.info('⚠️ Returning loan details without applications');
    }

  res.json({
    success: true,
    loanId,
    loanDetails: {
      lender: loanDetails.lender,
      amount: loanDetails.amount_per_borrower.toString(),
      interestRate: loanDetails.interest_rate_bps.toString(),
      minActivityScore: loanDetails.min_activity_score.toString()
    },
    applications,
    message: applications.length === 0 
      ? 'No applications found for this loan' 
      : `Found ${applications.length} application(s)`
  });
} catch (error) {
  logger.error('❌ Error fetching loan applications:', { 
    error: error.message, 
    stack: error.stack,
    loanId: req.params.loanId 
  });
  res.status(500).json({ error: error.message || 'Failed to fetch applications' });
}
});

/**
 * Get all applications for a borrower (by commitment)
 * Note: This requires scanning all loans - not efficient
 * In production, use event indexing service
 */
router.get('/borrower/:commitment/applications', async (req, res) => {
  try {
    const { commitment } = req.params;
    
    logger.info('📬 Fetching applications for borrower commitment:', commitment.slice(0, 30) + '...');
    logger.info('📬 Commitment length:', commitment.length, 'Full:', commitment);

    // Handle both truncated (63 hex chars) and full (64 hex chars) commitments
    // for backwards compatibility with old applications
    const commitments = [commitment];
    if (commitment.length === 66) { // 0x + 64 hex chars
      const truncated = '0x' + commitment.slice(2, 65); // Keep first 63 hex chars
      commitments.push(truncated);
      logger.info('📬 Also checking truncated commitment:', truncated);
    }

    const escrowContract = new Contract(ESCROW_ABI, LOAN_ESCROW_ZK_ADDRESS, provider);
    const loanCountRaw = await escrowContract.get_loan_count();
    
    // Parse loan count
    let loanCount;
    if (loanCountRaw?.count) {
      if (typeof loanCountRaw.count === 'bigint') {
        loanCount = Number(loanCountRaw.count);
      } else if (loanCountRaw.count?.low !== undefined) {
        loanCount = Number(loanCountRaw.count.low);
      }
    }
    
    const applications = [];
    
    // Scan all loans for applications with ANY of the commitment variants
    logger.info(`🔍 Scanning ${loanCount} loans for applications with ${commitments.length} commitment variants...`);
    for (let i = 1; i <= Number(loanCount); i++) {
      // Try each commitment variant (full and truncated)
      for (const commitmentVariant of commitments) {
        try {
          // Use callContract for u256 parameter
          const { low: loanLow, high: loanHigh } = uint256.bnToUint256(BigInt(i));
          const appRawResult = await provider.callContract({
            contractAddress: LOAN_ESCROW_ZK_ADDRESS,
            entrypoint: 'get_application',
            calldata: [loanLow, loanHigh, commitmentVariant]
          });
          
          // Parse Application struct
          // [borrower, commitment, proof_hash, status, applied_at, approved_at, repayment_deadline]
          const application = {
            borrower: appRawResult.result[0],
            commitment: appRawResult.result[1],
            proof_hash: appRawResult.result[2],
            status: Number(appRawResult.result[3]),
            applied_at: Number(appRawResult.result[4]),
            approved_at: Number(appRawResult.result[5]),
            repaid_at: Number(appRawResult.result[6]),
            repayment_deadline: Number(appRawResult.result[7])
          };
          
          // Log for loan 3 (the one you applied to) to see what the contract returns
          if (i === 3) {
            logger.info(`🔍 Loan #3 application data (variant: ${commitmentVariant.slice(0, 20)}...):`, {
              borrower: application.borrower,
              commitment_from_contract: application.commitment,
              commitment_queried: commitmentVariant,
              match: application.commitment === commitmentVariant,
              borrower_is_zero: application.borrower === '0x0'
            });
          }
          
          if (application.borrower !== '0x0' && application.borrower) {
            logger.info(`✅ Found application for loan ${i} with commitment variant ${commitmentVariant.slice(0, 20)}...!`, {
              borrower: application.borrower,
              commitment: application.commitment,
              status: application.status
            });

            // ===== ADD TO COMMITMENT CACHE =====
            // Cache this borrower's commitment for lender discovery
            commitmentCache.addCommitment(commitmentVariant, i);
            logger.info(`💾 [CACHE] Commitment cached for loan #${i} discovery`);

          const loanRawResult = await provider.callContract({
            contractAddress: LOAN_ESCROW_ZK_ADDRESS,
            entrypoint: 'get_loan_details',
            calldata: [loanLow, loanHigh]
          });
          
          const loanDetails = {
            lender: loanRawResult.result[0],
            amount_per_borrower: uint256.uint256ToBN({ low: loanRawResult.result[1], high: loanRawResult.result[2] }),
            interest_rate_bps: uint256.uint256ToBN({ low: loanRawResult.result[5], high: loanRawResult.result[6] })
          };
          
          applications.push({
            loanId: i.toString(),
            lender: loanDetails.lender,
            amount: loanDetails.amount_per_borrower.toString(),
            interestRate: loanDetails.interest_rate_bps.toString(),
            borrower: application.borrower,
            commitment: application.commitment,
            proofHash: application.proof_hash,
            status: application.status === 0 ? 'pending' : application.status === 1 ? 'approved' : 'repaid',
            appliedAt: new Date(Number(application.applied_at) * 1000).toISOString(),
            approvedAt: application.approved_at > 0 ? new Date(Number(application.approved_at) * 1000).toISOString() : null,
            repaymentDeadline: application.repayment_deadline > 0 ? new Date(Number(application.repayment_deadline) * 1000).toISOString() : null
          });
          break; // Found application with this commitment variant, don't try other variants
        }
        } catch (error) {
          // Application doesn't exist for this loan+commitment combination, try next variant
        }
      } // End commitmentVariant loop
    } // End loan loop

    logger.info(`✅ Found ${applications.length} applications`);
    res.json(applications);
  } catch (error) {
    logger.error('❌ Error fetching applications:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get applications for a borrower (all statuses: pending, approved, repaid)
 * DUPLICATE ROUTE - Should be removed, keeping first one above
 */
router.get('/borrower/:commitment/applications_OLD', async (req, res) => {
  try {
    const { commitment } = req.params;
    
    logger.info('📬 Fetching applications for borrower commitment:', commitment.slice(0, 20) + '...');
    logger.info('📬 Commitment length:', commitment.length, 'Type:', typeof commitment);

    const escrowContract = new Contract(ESCROW_ABI, LOAN_ESCROW_ZK_ADDRESS, provider);
    const loanCountRaw = await escrowContract.get_loan_count();
    
    // Parse loan count
    let loanCount;
    if (loanCountRaw?.count) {
      if (typeof loanCountRaw.count === 'bigint') {
        loanCount = Number(loanCountRaw.count);
      } else if (loanCountRaw.count?.low !== undefined) {
        loanCount = Number(loanCountRaw.count.low);
      }
    }
    
    logger.info(`🔍 Scanning ${loanCount} loans for applications with commitment ${commitment.slice(0, 20)}...`);

    const applications = [];
    
    // Scan all loans to find applications with this commitment
    for (let i = 1; i <= Number(loanCount); i++) {
      try {
        const { low: loanLow, high: loanHigh } = uint256.bnToUint256(BigInt(i));
        const appRawResult = await provider.callContract({
          contractAddress: LOAN_ESCROW_ZK_ADDRESS,
          entrypoint: 'get_application',
          calldata: [loanLow, loanHigh, commitment]
        });
        
        const application = {
          borrower: appRawResult.result[0],
          commitment: appRawResult.result[1],
          proof_hash: appRawResult.result[2],
          status: Number(appRawResult.result[3]),
          applied_at: Number(appRawResult.result[4]),
          approved_at: Number(appRawResult.result[5]),
          repaid_at: Number(appRawResult.result[6]),
          repayment_deadline: Number(appRawResult.result[7])
        };
        
        // Include if application exists (borrower is not 0x0)
        if (application.borrower !== '0x0') {
          // Get loan details
          const loanRawResult = await provider.callContract({
            contractAddress: LOAN_ESCROW_ZK_ADDRESS,
            entrypoint: 'get_loan_details',
            calldata: [loanLow, loanHigh]
          });
          
          const loanDetails = {
            lender: loanRawResult.result[0],
            amount_per_borrower: uint256.uint256ToBN({ low: loanRawResult.result[1], high: loanRawResult.result[2] }),
            interest_rate_bps: uint256.uint256ToBN({ low: loanRawResult.result[5], high: loanRawResult.result[6] })
          };
          
          applications.push({
            loanId: i.toString(),
            lender: loanDetails.lender,
            amount: loanDetails.amount_per_borrower.toString(),
            interestRate: loanDetails.interest_rate_bps.toString(),
            borrower: application.borrower,
            commitment: application.commitment,
            proofHash: application.proof_hash,
            status: application.status === 0 ? 'pending' : application.status === 1 ? 'approved' : 'repaid',
            appliedAt: new Date(Number(application.applied_at) * 1000).toISOString(),
            approvedAt: application.approved_at > 0 ? new Date(Number(application.approved_at) * 1000).toISOString() : null,
            repaidAt: application.repaid_at > 0 ? new Date(Number(application.repaid_at) * 1000).toISOString() : null,
            repaymentDeadline: application.repayment_deadline > 0 ? new Date(Number(application.repayment_deadline) * 1000).toISOString() : null
          });
        }
      } catch (error) {
        // Application doesn't exist for this loan, continue
      }
    }

    logger.info(`✅ Found ${applications.length} applications`);
    res.json(applications);
  } catch (error) {
    logger.error('❌ Error fetching applications:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get active loans for a borrower (approved but not repaid)
 */
router.get('/borrower/:commitment/active', async (req, res) => {
  try {
    const { commitment } = req.params;
    
    logger.info('💼 Fetching active loans for borrower commitment:', commitment.slice(0, 20) + '...');

    const escrowContract = new Contract(ESCROW_ABI, LOAN_ESCROW_ZK_ADDRESS, provider);
    const loanCountRaw = await escrowContract.get_loan_count();
    
    // Parse loan count
    let loanCount;
    if (loanCountRaw?.count) {
      if (typeof loanCountRaw.count === 'bigint') {
        loanCount = Number(loanCountRaw.count);
      } else if (loanCountRaw.count?.low !== undefined) {
        loanCount = Number(loanCountRaw.count.low);
      }
    }
    
    const activeLoans = [];
    
    logger.info(`✅ Total loans on-chain: ${loanCount}`);
    logger.info(`📥 Received commitment (first 30 chars): ${commitment.slice(0, 30)}...`);
    logger.info(`📏 Received commitment length: ${commitment.length}`);
    
    // Normalize commitment to hex format - handle both hex and decimal input
    let commitmentHex;
    if (commitment.startsWith('0x')) {
      // Already in hex format
      commitmentHex = commitment;
      logger.info(`🔍 Commitment already in hex format: ${commitmentHex.slice(0, 20)}...`);
    } else {
      // Convert from decimal to hex
      commitmentHex = `0x${BigInt(commitment).toString(16)}`;
      logger.info(`🔍 Converted commitment from decimal to hex: ${commitment.slice(0, 20)}... → ${commitmentHex.slice(0, 20)}...`);
    }
    
    // CRITICAL: Query ALL applications from blockchain events to find matching ones
    // This is more reliable than trying to guess the commitment format
    logger.info(`🔎 Querying blockchain for all applications to find matches...`);
    
    const { hash } = require('starknet');
    const eventKey = hash.getSelectorFromName('LoanApplicationSubmitted');
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 10000);
    
    const events = await provider.getEvents({
      address: LOAN_ESCROW_ZK_ADDRESS,
      keys: [[eventKey]],
      from_block: { block_number: fromBlock },
      to_block: 'latest',
      chunk_size: 1000
    });
    
    logger.info(`📦 Found ${events.events.length} total application events`);
    
    // Try to match using multiple commitment formats
    const commitmentVariants = [
      commitmentHex,
      commitmentHex.slice(0, 65), // Truncated version
      commitment, // Original (might be decimal)
      commitment.slice(0, 65) // Truncated original
    ];
    
    logger.info(`🔍 Will try ${commitmentVariants.length} commitment variant(s)`);
    
    // Find all applications from this borrower by matching commitment in events
    const borrowerLoanIds = new Set();
    
    for (const event of events.events) {
      try {
        const eventCommitment = event.keys[3]; // Commitment is the 4th key
        
        // Check if this event's commitment matches any of our variants
        for (const variant of commitmentVariants) {
          if (eventCommitment === variant || 
              eventCommitment === variant.slice(0, 65) ||
              variant === eventCommitment ||
              variant.slice(0, 65) === eventCommitment) {
            
            // Extract loan_id from event
            const eventLoanIdLow = event.keys[1];
            const eventLoanIdHigh = event.keys[2] || '0x0';
            const loanId = uint256.uint256ToBN({ 
              low: eventLoanIdLow, 
              high: eventLoanIdHigh 
            }).toString();
            
            borrowerLoanIds.add(loanId);
            logger.info(`✅ Found matching application! Loan #${loanId}, Commitment: ${eventCommitment.slice(0, 20)}...`);
            break; // Found a match, no need to try other variants
          }
        }
      } catch (err) {
        // Skip malformed events
      }
    }
    
    logger.info(`📋 Found ${borrowerLoanIds.size} loans with applications from this borrower`);
    
    // Now query only the loans we found
    for (const loanId of borrowerLoanIds) {
      const { low: loanLow, high: loanHigh } = uint256.bnToUint256(BigInt(loanId));
      
      // Try each commitment variant
      for (const commitmentVariant of commitmentVariants) {
        try {
          const appRawResult = await provider.callContract({
            contractAddress: LOAN_ESCROW_ZK_ADDRESS,
            entrypoint: 'get_application',
            calldata: [loanLow, loanHigh, commitmentVariant]
          });
        
        // Parse Application struct
        // Application { borrower, commitment, proof_hash, status, applied_at, approved_at, repaid_at, repayment_deadline }
        const application = {
          borrower: appRawResult.result[0],
          commitment: appRawResult.result[1],
          proof_hash: appRawResult.result[2],
          status: Number(appRawResult.result[3]),
          applied_at: Number(appRawResult.result[4]),
          approved_at: Number(appRawResult.result[5]),
          repaid_at: Number(appRawResult.result[6]),
          repayment_deadline: Number(appRawResult.result[7])
        };
        
        // Log application details for debugging
        if (application.borrower !== '0x0') {
          logger.info(`📋 Loan #${loanId} application found:`, {
            borrower: application.borrower,
            commitment: application.commitment,
            status: application.status,
            statusText: application.status === 0 ? 'pending' : application.status === 1 ? 'approved' : 'repaid',
            approved_at: application.approved_at,
            repayment_deadline: application.repayment_deadline
          });
        }
        
        // Only include approved loans (status = 1)
        if (application.borrower !== '0x0' && application.status === 1) {
          const loanRawResult = await provider.callContract({
            contractAddress: LOAN_ESCROW_ZK_ADDRESS,
            entrypoint: 'get_loan_details',
            calldata: [loanLow, loanHigh]
          });
          
          const loanDetails = {
            lender: loanRawResult.result[0],
            amount_per_borrower: uint256.uint256ToBN({ low: loanRawResult.result[1], high: loanRawResult.result[2] }),
            interest_rate_bps: uint256.uint256ToBN({ low: loanRawResult.result[5], high: loanRawResult.result[6] })
          };
          
          activeLoans.push({
            loanId: loanId.toString(),
            lender: loanDetails.lender,
            amount: loanDetails.amount_per_borrower.toString(),
            interestRate: loanDetails.interest_rate_bps.toString(),
            borrower: application.borrower,
            commitment: application.commitment,
            status: 'approved',
            approvedAt: new Date(Number(application.approved_at) * 1000).toISOString(),
            repaymentDeadline: new Date(Number(application.repayment_deadline) * 1000).toISOString()
          });
          
          break; // Found application with this commitment variant, exit inner loop
        }
      } catch (error) {
        // This commitment variant didn't work, try next one
      }
    } // End of commitment variants loop
    } // End of borrower loans loop

    logger.info(`✅ Found ${activeLoans.length} active loans`);
    res.json({ loans: activeLoans, count: activeLoans.length });
  } catch (error) {
    logger.error('❌ Error fetching active loans:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get proof verification status
 */
router.get('/proof/:proofHash/verify', async (req, res) => {
  try {
    const { proofHash } = req.params;
    
    logger.info('🔍 Checking proof verification:', proofHash.slice(0, 20) + '...');

    const verifierContract = new Contract(VERIFIER_ABI, ACTIVITY_VERIFIER_ADDRESS, provider);
    const score = await verifierContract.get_proof_score(proofHash);

    res.json({
      proofHash,
      verified: score > 0,
      activityScore: score.toString()
    });
  } catch (error) {
    logger.error('❌ Error checking proof:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Reveal borrower identity (only if loan is overdue)
 * GET /api/loan/:loanId/reveal/:commitment
 */
router.get('/:loanId/reveal/:commitment', async (req, res) => {
  try {
    const { loanId, commitment } = req.params;
    
    logger.info(`🔓 [REVEAL] Attempting to reveal borrower for loan ${loanId}...`);
    
    const { low: loanLow, high: loanHigh } = uint256.bnToUint256(BigInt(loanId));
    
    // Get application details
    const appRawResult = await provider.callContract({
      contractAddress: LOAN_ESCROW_ZK_ADDRESS,
      entrypoint: 'get_application',
      calldata: [loanLow, loanHigh, commitment]
    });
    
    const application = {
      borrower: appRawResult.result[0],
      commitment: appRawResult.result[1],
      proof_hash: appRawResult.result[2],
      status: Number(appRawResult.result[3]),
      applied_at: Number(appRawResult.result[4]),
      approved_at: Number(appRawResult.result[5]),
      repaid_at: Number(appRawResult.result[6]),
      repayment_deadline: Number(appRawResult.result[7])
    };
    
    // Check if application exists
    if (application.borrower === '0x0') {
      return res.status(404).json({
        success: false,
        canReveal: false,
        message: 'Application not found for this loan and commitment.'
      });
    }
    
    // Check if loan is approved
    if (application.status !== 1) {
      return res.status(403).json({
        success: false,
        canReveal: false,
        message: 'Loan is not in approved status. Cannot reveal borrower identity.',
        status: application.status
      });
    }
    
    // Check if overdue
    const now = Math.floor(Date.now() / 1000);
    const isOverdue = now > application.repayment_deadline;
    
    if (!isOverdue) {
      const timeRemaining = application.repayment_deadline - now;
      return res.status(403).json({
        success: false,
        canReveal: false,
        message: 'Loan is not overdue yet. Cannot reveal borrower identity.',
        deadline: new Date(application.repayment_deadline * 1000).toISOString(),
        timeRemaining,
        timeRemainingHours: Math.floor(timeRemaining / 3600)
      });
    }
    
    // If overdue, return BOTH borrower wallet address AND ZK identity commitment
    logger.info(`✅ [REVEAL] Loan is overdue. Revealing borrower identity:`, {
      wallet: application.borrower,
      commitment: application.commitment
    });
    
    res.json({
      success: true,
      canReveal: true,
      revealed: true,
      borrower: application.borrower,              // Wallet address (on-chain identity)
      commitment: application.commitment,          // ZK commitment (permanent identity)
      loanId,
      overdueBy: now - application.repayment_deadline,
      overdueDays: Math.floor((now - application.repayment_deadline) / 86400),
      approvedAt: new Date(application.approved_at * 1000).toISOString(),
      repaymentDeadline: new Date(application.repayment_deadline * 1000).toISOString(),
      message: 'Borrower identity revealed due to loan default - ZK commitment is the permanent reputation identity'
    });
    
  } catch (error) {
    logger.error('❌ [REVEAL] Error revealing borrower:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});


// REMOVED: /identity-by-activity endpoint. All commitment lookups must be on-chain only.

/**
 * NEW ENDPOINT: Get all applications for a specific loan by scanning known commitments
 * This endpoint discovers applications by:
 * 1. Collecting all known commitments from the commitment cache
 * 2. Testing each commitment against the target loan
 * 3. Returning applications with their VISIBLE permanent identity commitments
 * 
 * This solves the visibility issue where lenders couldn't see borrower identities
 */
router.get('/:loanId/applications/scan', async (req, res) => {
  try {
    const { loanId } = req.params;
    
    logger.info(`🔎 [NEW-SCAN] Starting application scan for loan #${loanId}`);

    // Step 1: Get loan details and verify it exists
    const { low: loanLow, high: loanHigh } = uint256.bnToUint256(BigInt(loanId));
    
    const loanRawResult = await provider.callContract({
      contractAddress: LOAN_ESCROW_ZK_ADDRESS,
      entrypoint: 'get_loan_details',
      calldata: [loanLow, loanHigh]
    });
    
    const loanDetails = {
      lender: loanRawResult.result[0],
      amount_per_borrower: uint256.uint256ToBN({ low: loanRawResult.result[1], high: loanRawResult.result[2] }),
      total_slots: Number(loanRawResult.result[3]),
      filled_slots: Number(loanRawResult.result[4]),
      interest_rate_bps: uint256.uint256ToBN({ low: loanRawResult.result[5], high: loanRawResult.result[6] }),
      min_activity_score: uint256.uint256ToBN({ low: loanRawResult.result[8], high: loanRawResult.result[9] }),
      status: Number(loanRawResult.result[10])
    };
    
    logger.info(`✅ [NEW-SCAN] Loan #${loanId} found`, { 
      lender: loanDetails.lender.slice(0, 20) + '...',
      filled_slots: loanDetails.filled_slots,
      total_slots: loanDetails.total_slots
    });

    // Step 2: Get all known commitments from cache
    const knownCommitments = commitmentCache.getAllCommitments();
    logger.info(`📊 [NEW-SCAN] Testing ${knownCommitments.length} known commitments from cache`);
    
    if (knownCommitments.length === 0) {
      logger.warn(`⚠️ [NEW-SCAN] No commitments in cache yet. Commitments are added when borrowers generate proofs.`);
    }

    // Step 3: Test each commitment against this loan
    const applications = [];
    
    for (const commitment of knownCommitments) {
      try {
        // Also try truncated version for backwards compatibility
        const commitmentVariants = [commitment];
        if (commitment.length === 66) { // 0x + 64 hex chars
          const truncated = '0x' + commitment.slice(2, 65);
          commitmentVariants.push(truncated);
        }

        for (const commitmentVariant of commitmentVariants) {
          try {
            const appRawResult = await provider.callContract({
              contractAddress: LOAN_ESCROW_ZK_ADDRESS,
              entrypoint: 'get_application',
              calldata: [loanLow, loanHigh, commitmentVariant]
            });
            
            // Parse Application struct
            const appDetails = {
              borrower: appRawResult.result[0],
              commitment: appRawResult.result[1],
              proof_hash: appRawResult.result[2],
              status: Number(appRawResult.result[3]),
              applied_at: Number(appRawResult.result[4]),
              approved_at: Number(appRawResult.result[5]),
              repaid_at: Number(appRawResult.result[6]),
              repayment_deadline: Number(appRawResult.result[7])
            };

            // If borrower is not zero address, we found an application!
            if (appDetails.borrower !== '0x0' && appDetails.borrower) {
              logger.info(`✅ [NEW-SCAN] Found application from commitment ${commitmentVariant.slice(0, 20)}...!`, {
                borrower: appDetails.borrower.slice(0, 20) + '...',
                status: appDetails.status
              });

              // Get activity score
              let activityScore = 0;
              try {
                const scoreResult = await provider.callContract({
                  contractAddress: ACTIVITY_VERIFIER_ADDRESS,
                  entrypoint: 'get_proof_score',
                  calldata: [appDetails.proof_hash]
                });
                activityScore = uint256.uint256ToBN({ 
                  low: scoreResult.result[0], 
                  high: scoreResult.result[1] 
                }).toString();
              } catch (scoreError) {
                logger.warn(`Could not fetch activity score for ${appDetails.proof_hash}`);
              }

              applications.push({
                loanId,
                borrowerAddress: appDetails.borrower,
                permanentIdentity: commitmentVariant, // THIS IS WHAT LENDERS SEE!
                proofHash: appDetails.proof_hash,
                activityScore,
                status: appDetails.status === 0 ? 'pending' : appDetails.status === 1 ? 'approved' : 'repaid',
                appliedAt: new Date(appDetails.applied_at * 1000).toISOString(),
                approvedAt: appDetails.approved_at > 0 ? new Date(appDetails.approved_at * 1000).toISOString() : null,
                repaymentDeadline: appDetails.repayment_deadline > 0 ? new Date(appDetails.repayment_deadline * 1000).toISOString() : null
              });

              // Cache the loan->commitment mapping for future
              commitmentCache.addCommitment(commitmentVariant, loanId);
              
              break; // Found it, no need to try other variants
            }
          } catch (err) {
            // Silent fail - commitment doesn't have application for this loan
          }
        }
      } catch (err) {
        // Silent fail for individual commitment tests
      }
    }
    
    logger.info(`✅ [NEW-SCAN] Found ${applications.length} applications for loan #${loanId}`);

    // Return applications with visible permanent identities
    res.json({
      success: true,
      loanId,
      loanDetails: {
        lender: loanDetails.lender,
        amount: loanDetails.amount_per_borrower.toString(),
        totalSlots: loanDetails.total_slots,
        filledSlots: loanDetails.filled_slots,
        interestRate: loanDetails.interest_rate_bps.toString(),
        minActivityScore: loanDetails.min_activity_score.toString(),
        status: loanDetails.status === 0 ? 'active' : loanDetails.status === 1 ? 'funded' : 'cancelled'
      },
      applications,
      cacheInfo: {
        totalKnownCommitments: knownCommitments.length,
        applicationsFound: applications.length,
        message: 'Commitments are cached when borrowers generate ZK proofs'
      }
    });
  } catch (error) {
    logger.error('❌ [NEW-SCAN] Error:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: error.message });
  }
});

/**
 * NEW ENDPOINT: Get commitment cache statistics
 * Useful for debugging and monitoring
 */
router.get('/cache/stats', async (req, res) => {
  try {
    const stats = commitmentCache.getStats();
    
    res.json({
      success: true,
      cache: stats,
      message: 'Cache is populated when borrowers generate proofs and apply for loans'
    });
  } catch (error) {
    logger.error('❌ Error fetching cache stats:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
