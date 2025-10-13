const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { RpcProvider, Contract, CallData, uint256 } = require('starknet');

// Contract addresses (update after deployment)
const LOAN_ESCROW_ZK_ADDRESS = process.env.LOAN_ESCROW_ZK_ADDRESS || '0x05a4d3ed7d102ab91715c2b36c70b5e9795a3e917214dbd9af40503d2c29f83d';
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
        
        // Only include active loans with available slots
        if (loanDetails.status === 0 && loanDetails.filled_slots < loanDetails.total_slots) {
          loans.push({
            id: i.toString(),
            lender: loanDetails.lender,
            amountPerBorrower: loanDetails.amount_per_borrower.toString(),
            totalSlots: Number(loanDetails.total_slots),
            filledSlots: Number(loanDetails.filled_slots),
            slotsRemaining: Number(loanDetails.total_slots) - Number(loanDetails.filled_slots),
            interestRate: loanDetails.interest_rate_bps.toString(),
            repaymentPeriod: loanDetails.repayment_period.toString(),
            minActivityScore: loanDetails.min_activity_score.toString(),
            status: 'active',
            createdAt: new Date(Number(loanDetails.created_at) * 1000).toISOString()
          });
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
      } else if (countValue?.low !== undefined) {
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
          loans.push({
            id: i.toString(),
            lender: loanDetails.lender,
            amountPerBorrower: loanDetails.amount_per_borrower.toString(),
            totalSlots: Number(loanDetails.total_slots),
            filledSlots: Number(loanDetails.filled_slots),
            slotsRemaining: Number(loanDetails.total_slots) - Number(loanDetails.filled_slots),
            interestRate: loanDetails.interest_rate_bps.toString(),
            repaymentPeriod: loanDetails.repayment_period.toString(),
            minActivityScore: loanDetails.min_activity_score.toString(),
            status: loanDetails.status === 0 ? 'active' : loanDetails.status === 1 ? 'funded' : 'cancelled',
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

    const escrowContract = new Contract(ESCROW_ABI, LOAN_ESCROW_ZK_ADDRESS, provider);
    const application = await escrowContract.get_application(loanId, commitment);

    if (application.borrower === '0x0' || !application.borrower) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const result = {
      loanId,
      borrower: application.borrower,
      commitment: application.commitment,
      proofHash: application.proof_hash,
      status: application.status === 0 ? 'pending' : application.status === 1 ? 'approved' : 'repaid',
      appliedAt: new Date(Number(application.applied_at) * 1000).toISOString(),
      approvedAt: application.approved_at > 0 ? new Date(Number(application.approved_at) * 1000).toISOString() : null,
      repaidAt: application.repaid_at > 0 ? new Date(Number(application.repaid_at) * 1000).toISOString() : null,
      repaymentDeadline: application.repayment_deadline > 0 ? new Date(Number(application.repayment_deadline) * 1000).toISOString() : null
    };

    logger.info('✅ Application found:', result.status);
    res.json(result);
  } catch (error) {
    logger.error('❌ Error fetching application:', error);
    res.status(500).json({ error: error.message });
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
    
    logger.info('📬 Fetching applications for borrower:', commitment.slice(0, 20) + '...');

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
    
    // Scan all loans for applications with this commitment
    for (let i = 1; i <= Number(loanCount); i++) {
      try {
        // Use callContract for u256 parameter
        const { low: loanLow, high: loanHigh } = uint256.bnToUint256(BigInt(i));
        const appRawResult = await provider.callContract({
          contractAddress: LOAN_ESCROW_ZK_ADDRESS,
          entrypoint: 'get_application',
          calldata: [loanLow, loanHigh, commitment]
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
          repayment_deadline: Number(appRawResult.result[6])
        };
        
        if (application.borrower !== '0x0' && application.borrower) {
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
    
    logger.info('💼 Fetching active loans for borrower:', commitment.slice(0, 20) + '...');

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
    
    for (let i = 1; i <= Number(loanCount); i++) {
      try {
        // Use callContract for u256 parameter
        const { low: loanLow, high: loanHigh } = uint256.bnToUint256(BigInt(i));
        const appRawResult = await provider.callContract({
          contractAddress: LOAN_ESCROW_ZK_ADDRESS,
          entrypoint: 'get_application',
          calldata: [loanLow, loanHigh, commitment]
        });
        
        // Parse Application struct
        const application = {
          borrower: appRawResult.result[0],
          status: Number(appRawResult.result[3]),
          applied_at: Number(appRawResult.result[4]),
          approved_at: Number(appRawResult.result[5]),
          repayment_deadline: Number(appRawResult.result[6]),
          commitment: appRawResult.result[1]
        };
        
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
            loanId: i.toString(),
            lender: loanDetails.lender,
            amount: loanDetails.amount_per_borrower.toString(),
            interestRate: loanDetails.interest_rate_bps.toString(),
            borrower: application.borrower,
            commitment: application.commitment,
            status: 'approved',
            approvedAt: new Date(Number(application.approved_at) * 1000).toISOString(),
            repaymentDeadline: new Date(Number(application.repayment_deadline) * 1000).toISOString()
          });
        }
      } catch (error) {
        // Continue
      }
    }

    logger.info(`✅ Found ${activeLoans.length} active loans`);
    res.json(activeLoans);
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

module.exports = router;
