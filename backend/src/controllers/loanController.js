/**
 * Loan Controller
 * Handles loan application, repayment, and status checks
 */

const loanMonitor = require('../services/loanMonitor');
const logger = require('../utils/logger');
const crypto = require('node:crypto');

/**
 * Apply for a loan
 * POST /api/loan/apply
 */
exports.applyForLoan = async (req, res) => {
  try {
    const {
      borrowerAddress,
      loanId: providedLoanId,
      amount,
      threshold,
      proofHash,
      commitment,
      proof,
      publicSignals
    } = req.body;

    // Validation
    if (!borrowerAddress || !amount || !threshold || !proofHash || !commitment) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Generate unique loan ID
    const loanId = providedLoanId || crypto.randomBytes(16).toString('hex');

    // Mock loan provider data (as specified - single loan provider)
    const loanProvider = {
      providerAddress: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      name: "DeFi Lender Alpha",
      loanAmount: "50000000000000000000", // 50 STRK
      interestRate: 5, // 5%
      thresholdScore: 500,
      repaymentPeriod: 600, // 10 minutes (600 seconds)
      repaymentAmount: "52500000000000000000" // 52.5 STRK
    };

    // Calculate deadline (10 minutes from now)
    const deadline = Date.now() + (loanProvider.repaymentPeriod * 1000);

    // Create loan data
    const loanData = {
      loanId,
      borrowerAddress,
      lenderAddress: loanProvider.providerAddress,
      amount: loanProvider.loanAmount,
      repaymentAmount: loanProvider.repaymentAmount,
      interestRate: loanProvider.interestRate,
      deadline,
      proofHash,
      commitment,
      proof,
      publicSignals,
      appliedAt: Date.now()
    };

    // Start monitoring this loan
    loanMonitor.startMonitoring(loanData);

    logger.info(`✅ Loan application approved`, {
      loanId,
      borrower: borrowerAddress,
      amount: loanProvider.loanAmount,
      deadline: new Date(deadline).toISOString()
    });

    res.json({
      success: true,
      loanId,
      loanData: {
        loanId,
        amount: loanProvider.loanAmount,
        repaymentAmount: loanProvider.repaymentAmount,
        deadline,
        status: 'active'
      },
      message: 'Loan approved successfully'
    });

  } catch (error) {
    logger.error('Loan application error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Repay a loan
 * POST /api/loan/repay
 */
exports.repayLoan = async (req, res) => {
  try {
    const { loanId, borrowerAddress, amount } = req.body;

    if (!loanId || !borrowerAddress || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: loanId, borrowerAddress, amount'
      });
    }

    // Check if loan exists
    const loan = loanMonitor.getLoanStatus(loanId);
    if (!loan) {
      return res.status(404).json({
        success: false,
        error: 'Loan not found'
      });
    }

    // Verify borrower
    if (loan.borrowerAddress.toLowerCase() !== borrowerAddress.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Not the borrower of this loan'
      });
    }

    // Check if already repaid or defaulted
    if (loan.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: `Loan cannot be repaid (status: ${loan.status})`
      });
    }

    // Verify amount
    if (amount !== loan.repaymentAmount) {
      return res.status(400).json({
        success: false,
        error: `Incorrect repayment amount. Expected: ${loan.repaymentAmount}, Got: ${amount}`
      });
    }

    // Generate mock transaction hash (in production, this would come from blockchain)
    const mockTxHash = '0x' + crypto.randomBytes(32).toString('hex');

    // Process repayment
    const repaidLoan = loanMonitor.handleRepayment(loanId, mockTxHash);

    logger.info(`✅ Loan repayment processed`, {
      loanId,
      borrower: borrowerAddress,
      amount,
      txHash: mockTxHash
    });

    res.json({
      success: true,
      loanId,
      txHash: mockTxHash,
      repaidAt: repaidLoan.repaidAt,
      message: 'Loan repaid successfully'
    });

  } catch (error) {
    logger.error('Loan repayment error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get loan status
 * GET /api/loan/status/:loanId
 */
exports.getLoanStatus = async (req, res) => {
  try {
    const { loanId } = req.params;

    const loan = loanMonitor.getLoanStatus(loanId);

    if (!loan) {
      return res.status(404).json({
        success: false,
        error: 'Loan not found'
      });
    }

    const timeRemaining = Math.max(0, loan.deadline - Date.now());

    res.json({
      success: true,
      loan: {
        loanId: loan.loanId,
        status: loan.status,
        borrowerAddress: loan.borrowerAddress,
        lenderAddress: loan.lenderAddress,
        amount: loan.amount,
        repaymentAmount: loan.repaymentAmount,
        deadline: loan.deadline,
        timeRemaining,
        appliedAt: loan.appliedAt,
        repaidAt: loan.repaidAt,
        defaultedAt: loan.defaultedAt
      }
    });

  } catch (error) {
    logger.error('Get loan status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Force default a loan (testing/admin only)
 * POST /api/loan/default/:loanId
 */
exports.forceDefault = async (req, res) => {
  try {
    const { loanId } = req.params;

    const loan = loanMonitor.getLoanStatus(loanId);

    if (!loan) {
      return res.status(404).json({
        success: false,
        error: 'Loan not found'
      });
    }

    const defaultedLoan = loanMonitor.forceDefault(loanId);

    logger.info(`⚠️ Loan force-defaulted (admin action)`, {
      loanId,
      borrower: defaultedLoan.borrowerAddress
    });

    res.json({
      success: true,
      loanId,
      message: 'Loan defaulted successfully (identity revealed)',
      defaultedAt: defaultedLoan.defaultedAt
    });

  } catch (error) {
    logger.error('Force default error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get all active loans
 * GET /api/loan/active
 */
exports.getActiveLoans = async (req, res) => {
  try {
    const activeLoans = loanMonitor.getActiveLoans();

    res.json({
      success: true,
      count: activeLoans.length,
      loans: activeLoans.map(loan => ({
        loanId: loan.loanId,
        borrowerAddress: loan.borrowerAddress,
        amount: loan.amount,
        repaymentAmount: loan.repaymentAmount,
        deadline: loan.deadline,
        timeRemaining: Math.max(0, loan.deadline - Date.now())
      }))
    });

  } catch (error) {
    logger.error('Get active loans error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get loans by borrower
 * GET /api/loan/borrower/:address
 */
exports.getLoansByBorrower = async (req, res) => {
  try {
    const { address } = req.params;

    const loans = loanMonitor.getLoansByBorrower(address);

    res.json({
      success: true,
      count: loans.length,
      loans: loans.map(loan => ({
        loanId: loan.loanId,
        status: loan.status,
        amount: loan.amount,
        repaymentAmount: loan.repaymentAmount,
        deadline: loan.deadline,
        timeRemaining: Math.max(0, loan.deadline - Date.now()),
        appliedAt: loan.appliedAt
      }))
    });

  } catch (error) {
    logger.error('Get loans by borrower error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get monitoring stats (admin/debug)
 * GET /api/loan/stats
 */
exports.getStats = async (req, res) => {
  try {
    const stats = loanMonitor.getStats();

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    logger.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get loans by lender (from blockchain)
 * GET /api/loan/lender/:address
 */
exports.getLoansByLender = async (req, res) => {
  try {
    const { address } = req.params;
    const { Contract, RpcProvider } = require('starknet');

    logger.info(`🔍 [BLOCKCHAIN-V3] Fetching loans for lender: ${address}`);

    // Initialize provider
    const provider = new RpcProvider({
      nodeUrl: process.env.STARKNET_RPC_URL || 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7'
    });

    // Contract addresses
    const loanEscrowAddress = process.env.LOAN_ESCROW_ZK_ADDRESS || 
      '0x06b058a0946bb36fa846e6a954da885fa20809f43a9e47038dc83b4041f7f012';

    logger.info(`📍 [BLOCKCHAIN-V3] Contract address: ${loanEscrowAddress}`);

    // Load ABI
    const loanEscrowAbi = require('../contracts/loan_escrow_zk_abi.json');

    // Create contract instance
    const contract = new Contract(loanEscrowAbi, loanEscrowAddress, provider);

    // Get loan count
    logger.info('📊 [BLOCKCHAIN-V3] Calling get_loan_count...');
    const loanCountResult = await contract.get_loan_count();
    
    logger.info(`📊 [BLOCKCHAIN-V3] Raw loan count result: ${JSON.stringify(loanCountResult)}`);
    
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

    logger.info(`📊 [BLOCKCHAIN-V3] Total loans on blockchain: ${count}`);

    // Fetch all loans and filter by lender
    const loans = [];
    for (let i = 1; i <= count; i++) {
      try {
        logger.info(`🔎 [BLOCKCHAIN-V3] Fetching loan ${i}...`);
        const loanDetails = await contract.get_loan_details(i);
        
        logger.info(`📦 [BLOCKCHAIN-V3] Loan ${i} raw data:`, JSON.stringify(loanDetails, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value
        ));

        // The contract returns LoanOffer struct
        // Parse the data - starknet.js should return an object with named fields
        const lenderAddr = loanDetails.lender || loanDetails[0];
        const normalizedLender = lenderAddr.toString().toLowerCase();
        const normalizedAddress = address.toLowerCase();
        
        logger.info(`🔍 [BLOCKCHAIN-V3] Comparing lender: ${normalizedLender} with ${normalizedAddress}`);
        
        // Check if this loan belongs to the lender
        if (normalizedLender === normalizedAddress) {
          const amountPerBorrower = (loanDetails.amount_per_borrower || loanDetails[1])?.toString() || '0';
          const interestRateBps = (loanDetails.interest_rate_bps || loanDetails[4])?.toString() || '0';
          const minActivityScore = (loanDetails.min_activity_score || loanDetails[6])?.toString() || '0';
          const interestRate = Number(interestRateBps) / 100;
          
          const loanData = {
            loanId: i.toString(),
            lender: lenderAddr.toString(),
            loanAmount: amountPerBorrower, // Frontend expects 'loanAmount'
            amountPerBorrower: amountPerBorrower,
            totalSlots: Number(loanDetails.total_slots || loanDetails[2]) || 0,
            filledSlots: Number(loanDetails.filled_slots || loanDetails[3]) || 0,
            interestRate: interestRate, // As percentage
            interestRateBps: interestRateBps,
            repaymentPeriod: Number(loanDetails.repayment_period || loanDetails[5]) || 0,
            minActivityScore: minActivityScore,
            status: Number(loanDetails.status || loanDetails[7]) || 0,
            isActive: Number(loanDetails.status || loanDetails[7]) === 0,
            createdAt: Number(loanDetails.created_at || loanDetails[8]) || Date.now()
          };
          
          logger.info(`✅ [BLOCKCHAIN-V3] Found matching loan ${i}:`, loanData);
          loans.push(loanData);
        }
      } catch (error) {
        logger.error(`❌ [BLOCKCHAIN-V3] Failed to fetch loan ${i}:`, error.message);
        logger.error('[BLOCKCHAIN-V3] Full error:', error);
      }
    }

    logger.info(`✅ [BLOCKCHAIN-V3] Found ${loans.length} loans for lender ${address}`);

    res.json({
      success: true,
      count: loans.length,
      loans
    });

  } catch (error) {
    logger.error('❌ [BLOCKCHAIN-V3] Get loans by lender error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get loan applications (from blockchain)
 * GET /api/loan/:loanId/applications
 */
exports.getLoanApplications = async (req, res) => {
  try {
    const { loanId } = req.params;
    const { Contract, RpcProvider, hash } = require('starknet');

    logger.info(`📬 Fetching applications for loan ${loanId}...`);

    // Initialize provider
    const provider = new RpcProvider({
      nodeUrl: process.env.STARKNET_RPC_URL || 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7'
    });

    // Contract address
    const loanEscrowAddress = process.env.LOAN_ESCROW_ZK_ADDRESS || 
      '0x06b058a0946bb36fa846e6a954da885fa20809f43a9e47038dc83b4041f7f012';

    // Load ABI
    const loanEscrowAbi = require('../contracts/loan_escrow_zk_abi.json');

    // Create contract instance
    const contract = new Contract(loanEscrowAbi, loanEscrowAddress, provider);

    // Get loan details first
    const loanDetails = await contract.get_loan(loanId);
    
    // Query LoanApplicationSubmitted events for this loan_id
    const eventKey = hash.getSelectorFromName('LoanApplicationSubmitted');
    
    logger.info(`🔍 Querying events with key: ${eventKey} for loan ${loanId}`);
    
    // Get events from the contract
    const events = await provider.getEvents({
      address: loanEscrowAddress,
      keys: [[eventKey], [loanId]], // Filter by event type and loan_id
      from_block: { block_number: 0 },
      to_block: 'latest',
      chunk_size: 100
    });

    logger.info(`📦 Found ${events.events.length} application events`);

    // Parse events to extract applications
    const applications = events.events.map(event => {
      // Event structure: [loan_id, commitment, borrower, proof_hash]
      const loan_id = event.keys[1];
      const commitment = event.keys[2];
      const borrower = event.data[0];
      const proof_hash = event.data[1];

      return {
        loanId: loan_id,
        commitment,
        borrower,
        proofHash: proof_hash,
        blockNumber: event.block_number,
        transactionHash: event.transaction_hash
      };
    });

    logger.info(`✅ Returning ${applications.length} applications for loan ${loanId}`);

    res.json({
      success: true,
      loanId,
      loanDetails: {
        lender: loanDetails.lender,
        amount: loanDetails.amount.toString(),
        interestRate: loanDetails.interest_rate,
        minActivityScore: loanDetails.min_activity_score.toString()
      },
      applications,
      message: applications.length === 0 ? 'No applications found for this loan' : undefined
    });

  } catch (error) {
    logger.error('Get loan applications error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get available loan offers (from blockchain)
 * GET /api/loan/available
 */
exports.getAvailableLoans = async (req, res) => {
  try {
    const { Contract, RpcProvider } = require('starknet');

    // Initialize provider
    const provider = new RpcProvider({
      nodeUrl: process.env.STARKNET_RPC_URL || 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7'
    });

    // Contract addresses
    const loanEscrowAddress = process.env.LOAN_ESCROW_ZK_ADDRESS || 
      '0x06b058a0946bb36fa846e6a954da885fa20809f43a9e47038dc83b4041f7f012';

    // Load ABI
    const loanEscrowAbi = require('../contracts/loan_escrow_zk_abi.json');

    // Create contract instance
    const contract = new Contract(loanEscrowAbi, loanEscrowAddress, provider);

    // Get loan count
    logger.info('📊 Calling get_loan_count for available loans...');
    const loanCountResult = await contract.get_loan_count();
    
    // Handle Uint256 result
    let count;
    if (typeof loanCountResult === 'bigint') {
      count = Number(loanCountResult);
    } else if (typeof loanCountResult === 'number') {
      count = loanCountResult;
    } else if (loanCountResult && typeof loanCountResult === 'object') {
      if (loanCountResult.low !== undefined) {
        count = Number(loanCountResult.low);
      } else {
        count = 0;
      }
    } else {
      count = 0;
    }

    logger.info(`📊 Total loans on blockchain: ${count}`);

    // Fetch all active loans (status = 0)
    const loans = [];
    for (let i = 1; i <= count; i++) {
      try {
        const loanDetails = await contract.get_loan_details(i);
        
        // Only show active loans (status = 0) with available slots
        if (Number(loanDetails.status) === 0 && 
            Number(loanDetails.filled_slots) < Number(loanDetails.total_slots)) {
          
          // Parse the amount properly
          const amountPerBorrower = loanDetails.amount_per_borrower?.toString() || '0';
          const interestRateBps = loanDetails.interest_rate_bps?.toString() || '0';
          const minActivityScore = loanDetails.min_activity_score?.toString() || '0';
          
          // Calculate interest rate as percentage (bps / 100)
          const interestRate = Number(interestRateBps) / 100;
          
          loans.push({
            loanId: i.toString(),
            lender: loanDetails.lender?.toString() || '',
            loanAmount: amountPerBorrower, // Frontend expects 'loanAmount'
            amountPerBorrower: amountPerBorrower, // Keep for compatibility
            totalSlots: Number(loanDetails.total_slots) || 0,
            filledSlots: Number(loanDetails.filled_slots) || 0,
            availableSlots: (Number(loanDetails.total_slots) || 0) - (Number(loanDetails.filled_slots) || 0),
            interestRate: interestRate, // As percentage (e.g., 10 for 10%)
            interestRateBps: interestRateBps, // Keep bps for reference
            repaymentPeriod: Number(loanDetails.repayment_period) || 0,
            minActivityScore: minActivityScore,
            status: Number(loanDetails.status) || 0,
            isActive: Number(loanDetails.status) === 0,
            createdAt: Number(loanDetails.created_at) || Date.now()
          });
        }
      } catch (error) {
        logger.error(`Failed to fetch loan ${i}:`, error.message);
      }
    }

    logger.info(`✅ Found ${loans.length} available loans`);

    res.json({
      success: true,
      count: loans.length,
      loans
    });

  } catch (error) {
    logger.error('Get available loans error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
