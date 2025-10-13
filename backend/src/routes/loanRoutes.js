const express = require('express');
const router = express.Router();
const loanController = require('../controllers/loanController');
const blockchainLoanController = require('../controllers/blockchainLoanController');

// Apply for a loan
router.post('/apply', loanController.applyForLoan);

// Repay a loan
router.post('/repay', loanController.repayLoan);

// Get loan status
router.get('/status/:loanId', loanController.getLoanStatus);

// Force default (testing/admin)
router.post('/default/:loanId', loanController.forceDefault);

// Get all active loans
router.get('/active', loanController.getActiveLoans);

// Get available loans (for borrowers)
router.get('/available', loanController.getAvailableLoans);

// Get loans by borrower
router.get('/borrower/:address', loanController.getLoansByBorrower);

// Get loans by lender (from blockchain)
router.get('/lender/:address', loanController.getLoansByLender);

// Get loan applications
router.get('/:loanId/applications', loanController.getLoanApplications);

// Get monitoring stats
router.get('/stats', loanController.getStats);

// Test endpoint to verify backend is running latest code
router.get('/test-version', (req, res) => {
  res.json({ version: 'v2.0-with-blockchain-query', timestamp: new Date().toISOString() });
});

module.exports = router;

