const express = require('express');
const router = express.Router();
const proofController = require('../controllers/proofController');

// Prepare proof inputs
router.post('/prepare-inputs', proofController.prepareProofInputs.bind(proofController));

// Generate ZK proof (server-side - use with caution)
router.post('/generate', proofController.generateProof.bind(proofController));

// Verify ZK proof
router.post('/verify', proofController.verifyProof.bind(proofController));

// Generate commitment
router.post('/commitment', proofController.generateCommitment.bind(proofController));

// Get proof status from blockchain
router.get('/status/:proofHash', proofController.getProofStatus.bind(proofController));

// Hash proof for on-chain storage
router.post('/hash', proofController.hashProof.bind(proofController));

module.exports = router;
