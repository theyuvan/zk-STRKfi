const express = require('express');
const router = express.Router();
const loanController = require('../controllers/loanController');

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

// Get loans by borrower
router.get('/borrower/:address', loanController.getLoansByBorrower);

// Get monitoring stats
router.get('/stats', loanController.getStats);

module.exports = router;

