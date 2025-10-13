const express = require('express');
const router = express.Router();
const { Contract, RpcProvider } = require('starknet');
const logger = require('../utils/logger');

// Contract addresses from environment
const LOAN_ESCROW_ADDRESS = process.env.STARKNET_LOAN_ESCROW_CONTRACT;
const RPC_URL = process.env.STARKNET_RPC_URL;

// In-memory storage for loans and applications (replace with event listening later)
let loansCache = [];
let applicationsCache = [];

// Initialize RPC provider
const provider = new RpcProvider({ nodeUrl: RPC_URL });

/**
 * GET /api/loan/available
 * Get all available loans (with slots remaining)
 */
router.get('/available', async (req, res) => {
  try {
    logger.info('📋 Fetching available loans');

    // Filter loans with slots remaining
    const availableLoans = loansCache.filter(loan => 
      loan.status === 'active' && loan.slotsRemaining > 0
    );

    // Add application counts
    const loansWithCounts = availableLoans.map(loan => ({
      ...loan,
      applicationCount: applicationsCache.filter(app => 
        app.loanId === loan.id && app.status === 'pending'
      ).length
    }));

    logger.info(`✅ Found ${loansWithCounts.length} available loans`);
    
    res.json({ 
      success: true, 
      loans: loansWithCounts 
    });
  } catch (error) {
    logger.error('❌ Failed to fetch available loans:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch loans' 
    });
  }
});

/**
 * GET /api/loan/lender/:lenderAddress
 * Get all loans created by a specific lender
 */
router.get('/lender/:lenderAddress', async (req, res) => {
  try {
    const { lenderAddress } = req.params;
    logger.info(`📋 Fetching loans for lender: ${lenderAddress}`);

    // Find loans by lender
    const lenderLoans = loansCache.filter(loan => 
      loan.lenderAddress.toLowerCase() === lenderAddress.toLowerCase()
    );

    // Add application counts
    const loansWithDetails = lenderLoans.map(loan => ({
      ...loan,
      applicationCount: applicationsCache.filter(app => 
        app.loanId === loan.id
      ).length,
      approvedCount: applicationsCache.filter(app => 
        app.loanId === loan.id && app.status === 'approved'
      ).length
    }));

    logger.info(`✅ Found ${loansWithDetails.length} loans for lender`);
    
    res.json({ 
      success: true, 
      loans: loansWithDetails 
    });
  } catch (error) {
    logger.error('❌ Failed to fetch lender loans:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch loans' 
    });
  }
});

/**
 * GET /api/loan/:loanId/applications
 * Get all applications for a specific loan
 */
router.get('/:loanId/applications', async (req, res) => {
  try {
    const { loanId } = req.params;
    logger.info(`📬 Fetching applications for loan: ${loanId}`);

    // Find applications
    const loanApplications = applicationsCache.filter(app => 
      app.loanId === loanId
    );

    logger.info(`✅ Found ${loanApplications.length} applications`);
    
    res.json({ 
      success: true, 
      applications: loanApplications 
    });
  } catch (error) {
    logger.error('❌ Failed to fetch applications:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch applications' 
    });
  }
});

/**
 * GET /api/loan/borrower/:commitmentHash/applications
 * Get all applications submitted by a borrower (by commitment hash)
 */
router.get('/borrower/:commitmentHash/applications', async (req, res) => {
  try {
    const { commitmentHash } = req.params;
    logger.info(`📬 Fetching applications for borrower: ${commitmentHash}`);

    // Find applications by borrower commitment
    const borrowerApplications = applicationsCache.filter(app => 
      app.borrowerCommitment === commitmentHash
    );

    // Add loan details
    const applicationsWithLoans = borrowerApplications.map(app => {
      const loan = loansCache.find(l => l.id === app.loanId);
      return {
        ...app,
        amount: loan?.amount,
        interestRate: loan?.interestRate
      };
    });

    logger.info(`✅ Found ${applicationsWithLoans.length} applications`);
    
    res.json({ 
      success: true, 
      applications: applicationsWithLoans 
    });
  } catch (error) {
    logger.error('❌ Failed to fetch borrower applications:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch applications' 
    });
  }
});

/**
 * GET /api/loan/borrower/:commitmentHash/active
 * Get all active loans for a borrower
 */
router.get('/borrower/:commitmentHash/active', async (req, res) => {
  try {
    const { commitmentHash } = req.params;
    logger.info(`💼 Fetching active loans for borrower: ${commitmentHash}`);

    // Find approved applications
    const approvedApps = applicationsCache.filter(app => 
      app.borrowerCommitment === commitmentHash && app.status === 'approved'
    );

    // Get loan details
    const activeLoans = approvedApps.map(app => {
      const loan = loansCache.find(l => l.id === app.loanId);
      return {
        id: loan.id,
        amount: loan.amount,
        interestRate: loan.interestRate,
        repaymentPeriod: loan.repaymentPeriod,
        deadline: app.deadline,
        approvedAt: app.approvedAt
      };
    });

    logger.info(`✅ Found ${activeLoans.length} active loans`);
    
    res.json({ 
      success: true, 
      loans: activeLoans 
    });
  } catch (error) {
    logger.error('❌ Failed to fetch active loans:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch active loans' 
    });
  }
});

/**
 * POST /api/loan/apply
 * Submit a loan application
 */
router.post('/apply', async (req, res) => {
  try {
    const { loanId, borrowerCommitment, proofHash, activityScore } = req.body;
    
    logger.info(`📝 Processing loan application:`, {
      loanId,
      borrowerCommitment: borrowerCommitment?.slice(0, 10) + '...',
      activityScore
    });

    // Validate input
    if (!loanId || !borrowerCommitment || !proofHash) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: loanId, borrowerCommitment, proofHash' 
      });
    }

    // Find the loan
    const loan = loansCache.find(l => l.id === loanId);
    if (!loan) {
      return res.status(404).json({ 
        success: false, 
        error: 'Loan not found' 
      });
    }

    // Check if slots available
    if (loan.slotsRemaining <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No slots available for this loan' 
      });
    }

    // Check if already applied
    const existingApp = applicationsCache.find(app => 
      app.loanId === loanId && app.borrowerCommitment === borrowerCommitment
    );
    
    if (existingApp) {
      return res.status(400).json({ 
        success: false, 
        error: 'You have already applied for this loan' 
      });
    }

    // Create application
    const application = {
      loanId,
      borrowerCommitment,
      proofHash,
      activityScore,
      status: 'pending',
      timestamp: new Date().toISOString()
    };

    applicationsCache.push(application);
    logger.info(`✅ Application submitted for loan ${loanId}`);

    res.json({ 
      success: true, 
      message: 'Application submitted successfully',
      application 
    });
  } catch (error) {
    logger.error('❌ Failed to process application:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to submit application: ' + error.message 
    });
  }
});

/**
 * Helper: Add a loan to cache (called from event listener or manual creation)
 */
function addLoanToCache(loanData) {
  loansCache.push(loanData);
  logger.info(`➕ Added loan to cache: ${loanData.id}`);
}

/**
 * Helper: Update application status
 */
function updateApplicationStatus(loanId, borrowerCommitment, status, additionalData = {}) {
  const app = applicationsCache.find(a => 
    a.loanId === loanId && a.borrowerCommitment === borrowerCommitment
  );
  
  if (app) {
    app.status = status;
    Object.assign(app, additionalData);
    logger.info(`✅ Updated application status: ${loanId} - ${borrowerCommitment.slice(0, 10)} - ${status}`);
    
    // Update loan slots
    if (status === 'approved') {
      const loan = loansCache.find(l => l.id === loanId);
      if (loan) {
        loan.slotsRemaining--;
        if (loan.slotsRemaining === 0) {
          loan.status = 'filled';
        }
      }
    }
  }
}

/**
 * Helper: Get cache stats (for debugging)
 */
router.get('/cache/stats', (req, res) => {
  res.json({
    success: true,
    stats: {
      totalLoans: loansCache.length,
      availableLoans: loansCache.filter(l => l.slotsRemaining > 0).length,
      totalApplications: applicationsCache.length,
      pendingApplications: applicationsCache.filter(a => a.status === 'pending').length
    },
    loans: loansCache,
    applications: applicationsCache
  });
});

/**
 * Helper: Clear cache (for testing)
 */
router.post('/cache/clear', (req, res) => {
  loansCache = [];
  applicationsCache = [];
  logger.info('🗑️ Cache cleared');
  res.json({ success: true, message: 'Cache cleared' });
});

/**
 * Helper: Manually add test loan (for testing)
 */
router.post('/test/create-loan', (req, res) => {
  const testLoan = {
    id: `loan_${Date.now()}`,
    lenderAddress: req.body.lenderAddress || '0x123...',
    lenderName: req.body.lenderName || 'Test Lender',
    amount: req.body.amount || '50',
    interestRate: req.body.interestRate || '5',
    repaymentPeriod: req.body.repaymentPeriod || '600',
    totalSlots: parseInt(req.body.totalSlots) || 2,
    slotsRemaining: parseInt(req.body.totalSlots) || 2,
    status: 'active',
    createdAt: new Date().toISOString()
  };
  
  loansCache.push(testLoan);
  logger.info('➕ Test loan created:', testLoan);
  
  res.json({ success: true, loan: testLoan });
});

// Approve borrower
router.post('/approve-borrower', (req, res) => {
  const { loanId, borrowerCommitment, lenderAddress } = req.body;

  if (!loanId || !borrowerCommitment || !lenderAddress) {
    return res.status(400).json({ error: 'Missing required fields: loanId, borrowerCommitment, lenderAddress' });
  }

  // Find loan
  const loan = loansCache.find(l => l.id === loanId || l.loanId === loanId);
  if (!loan) {
    return res.status(404).json({ error: 'Loan not found' });
  }

  // Verify lender
  if (loan.lenderAddress.toLowerCase() !== lenderAddress.toLowerCase()) {
    return res.status(403).json({ error: 'Only loan creator can approve borrowers' });
  }

  // Find application
  const application = applicationsCache.find(
    app => app.loanId === loanId && app.borrowerCommitment === borrowerCommitment && app.status === 'pending'
  );

  if (!application) {
    return res.status(404).json({ error: 'Application not found or already processed' });
  }

  // Update application status
  application.status = 'approved';
  application.approvedAt = new Date().toISOString();

  // Update loan slots
  loan.slotsRemaining = (loan.slotsRemaining || loan.totalSlots) - 1;
  loan.status = loan.slotsRemaining === 0 ? 'funded' : 'active';

  logger.info(`✅ Borrower approved for loan ${loanId}:`, application);

  res.json({ 
    success: true, 
    application,
    loan: {
      id: loan.id,
      slotsRemaining: loan.slotsRemaining,
      status: loan.status
    }
  });
});

// Repay loan
router.post('/repay', (req, res) => {
  const { loanId, borrowerAddress, borrowerCommitment } = req.body;

  if (!loanId || !borrowerAddress) {
    return res.status(400).json({ error: 'Missing required fields: loanId, borrowerAddress' });
  }

  // Find loan
  const loan = loansCache.find(l => l.id === loanId || l.loanId === loanId);
  if (!loan) {
    return res.status(404).json({ error: 'Loan not found' });
  }

  // Find borrower's approved application
  const application = applicationsCache.find(
    app => app.loanId === loanId && 
           app.borrowerCommitment === borrowerCommitment && 
           app.status === 'approved'
  );

  if (!application) {
    return res.status(404).json({ error: 'No approved application found for this borrower' });
  }

  // Update application status
  application.status = 'repaid';
  application.repaidAt = new Date().toISOString();

  // Check if all borrowers repaid
  const allApplications = applicationsCache.filter(app => app.loanId === loanId);
  const allRepaid = allApplications.every(app => app.status === 'repaid');

  if (allRepaid) {
    loan.status = 'completed';
  }

  logger.info(`✅ Loan repayment recorded for ${loanId}:`, application);

  res.json({ 
    success: true, 
    message: 'Loan repayment recorded successfully',
    application,
    loan: {
      id: loan.id,
      status: loan.status
    }
  });
});

module.exports = router;
module.exports.addLoanToCache = addLoanToCache;
module.exports.updateApplicationStatus = updateApplicationStatus;
