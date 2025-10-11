const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payrollController');

// Start Plaid OAuth flow
router.post('/plaid/start', payrollController.startPlaidOAuth.bind(payrollController));

// Handle Plaid callback
router.post('/plaid/callback', payrollController.plaidCallback.bind(payrollController));

// Get Plaid income attestation
router.post('/plaid/income', payrollController.getPlaidIncome.bind(payrollController));

// Get ADP income attestation
router.post('/adp/income', payrollController.getADPIncome.bind(payrollController));

// Register custom employer API
router.post('/custom/register', payrollController.registerEmployer.bind(payrollController));

// Get custom income attestation
router.post('/custom/income', payrollController.getCustomIncome.bind(payrollController));

// Receive webhook
router.post('/webhook', payrollController.receiveWebhook.bind(payrollController));

// Validate attestation
router.post('/validate', payrollController.validateAttestation.bind(payrollController));

module.exports = router;
