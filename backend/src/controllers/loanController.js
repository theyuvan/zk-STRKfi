/**
 * Loan Controller
 * Handles loan application, repayment, and status checks
 */

const loanMonitor = require('../services/loanMonitor');
const logger = require('../utils/logger');
const crypto = require('crypto');

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
