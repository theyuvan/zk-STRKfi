const express = require('express');
const router = express.Router();
const identityController = require('../controllers/identityController');

// Encrypt and store identity
router.post('/encrypt-and-store', identityController.encryptAndStore.bind(identityController));

// Distribute shares to trustees
router.post('/distribute-shares', identityController.distributeShares.bind(identityController));

// Reconstruct identity from shares
router.post('/reconstruct', identityController.reconstructIdentity.bind(identityController));

// Get share status
router.get('/share-status/:loanId', identityController.getShareStatus.bind(identityController));

// Decrypt identity from IPFS
router.post('/decrypt-from-ipfs', identityController.decryptFromIPFS.bind(identityController));

module.exports = router;
