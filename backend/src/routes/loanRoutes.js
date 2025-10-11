const express = require('express');
const router = express.Router();
const loanController = require('../controllers/loanController');

// Create loan request
router.post('/create-request', loanController.createRequest.bind(loanController));

// Fund a loan
router.post('/fund', loanController.fundLoan.bind(loanController));

// Report payment
router.post('/report-payment', loanController.reportPayment.bind(loanController));

// Trigger default
router.post('/trigger-default', loanController.triggerDefault.bind(loanController));

// Get loan details
router.get('/:loanId', loanController.getLoanDetails.bind(loanController));

// Get loans for address
router.get('/address/:address', loanController.getLoansForAddress.bind(loanController));

module.exports = router;
