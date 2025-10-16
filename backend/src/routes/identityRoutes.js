const express = require('express');
const router = express.Router();
const identityController = require('../controllers/identityController');
const documentService = require('../services/documentService');
const zkService = require('../services/zkService');
const commitmentCache = require('../services/commitmentCacheService');
const identityCommitmentStore = require('../services/identityCommitmentStore');
const logger = require('../utils/logger');

// ====== STAGE 1: Document Verification (NEW) ======

/**
 * POST /api/identity/verify-document
 * Upload passport/document and prepare ZK proof inputs for Stage 1
 */
router.post('/verify-document', documentService.upload.single('document'), async (req, res) => {
  try {
    logger.info('🔐 Stage 1: Identity verification request', {
      wallet: req.body.walletAddress
    });
    
    // Validate required fields
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Document photo is required (passport, ID, or driver license)'
      });
    }
    
    if (!req.body.passportNumber) {
      return res.status(400).json({
        success: false,
        error: 'Passport/ID number is required'
      });
    }
    
    if (!req.body.address) {
      return res.status(400).json({
        success: false,
        error: 'Address is required'
      });
    }
    
    if (!req.body.dateOfBirth) {
      return res.status(400).json({
        success: false,
        error: 'Date of birth is required'
      });
    }
    
    if (!req.body.walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required'
      });
    }
    
    // Process document and generate ZK inputs
    const result = await documentService.processIdentityDocument(
      {
        passportNumber: req.body.passportNumber,
        address: req.body.address,
        dateOfBirth: req.body.dateOfBirth
      },
      req.file.path,
      req.body.walletAddress
    );
    
    // Delete uploaded document immediately (privacy protection)
    documentService.deleteDocument(req.file.path);
    
    logger.info('✅ Stage 1: Identity verified', {
      wallet: req.body.walletAddress,
      age: result.metadata.age
    });
    
    res.json({
      success: true,
      message: 'Identity verification successful. Proceed to Stage 2 (Activity Score)',
      stage: 1,
      zkInputs: result.zkInputs,
      metadata: {
        age: result.metadata.age,
        ageVerified: result.metadata.age >= 18,
        timestamp: result.metadata.timestamp
      }
    });
    
  } catch (error) {
    logger.error('❌ Stage 1: Identity verification error', { error: error.message });
    
    // Clean up uploaded file on error
    if (req.file) {
      documentService.deleteDocument(req.file.path);
    }
    
    // Return detailed error response with validation info if available
    const errorResponse = {
      success: false,
      error: error.message || 'Identity verification failed'
    };
    
    // Add validation details if this was a validation error
    if (error.message && (
      error.message.includes('MISMATCH') || 
      error.message.includes('validation') ||
      error.message.includes('could not be read')
    )) {
      errorResponse.validation = {
        errors: [error.message],
        warnings: [],
        hints: [
          'Ensure document is clear and well-lit',
          'Check that entered data matches document exactly',
          'Use original document (not photocopy)',
          'Supported formats: JPEG, PNG, PDF (max 5MB)'
        ]
      };
    }
    
    res.status(400).json(errorResponse);
  }
});

/**
 * POST /api/identity/generate-proof
 * Generate ZK proof from identity inputs
 */
router.post('/generate-proof', async (req, res) => {
  try {
    const { identityInputs } = req.body;
    
    if (!identityInputs) {
      return res.status(400).json({
        success: false,
        error: 'Identity inputs required'
      });
    }
    
    logger.info('Generating identity ZK proof', {
      wallet: identityInputs.wallet_address
    });
    
    // Generate ZK proof using idAuth circuit
    const proofResult = await zkService.generateIdentityProof(identityInputs);
    
    if (!proofResult.verified) {
      throw new Error('Proof verification failed');
    }
    
    if (!proofResult.age_verified) {
      return res.status(400).json({
        success: false,
        error: 'Age verification failed - must be 18 or older'
      });
    }
    
    logger.info('✅ Identity ZK proof generated', {
      identity_commitment: proofResult.identity_commitment,
      wallet_commitment: proofResult.wallet_commitment
    });

    // Add commitment to cache for loan discovery
    commitmentCache.addCommitment(proofResult.identity_commitment);
    logger.info('✅ [CACHE] Identity commitment added', {
      commitment: proofResult.identity_commitment
    });

    // ===== STORE IDENTITY COMMITMENT IN JSON FILE =====
    try {
      await identityCommitmentStore.storeIdentityCommitment(
        identityInputs.wallet_address,
        proofResult.identity_commitment
      );
      logger.info('💾 [STORE] Identity commitment saved to JSON file', {
        wallet: identityInputs.wallet_address.slice(0, 10) + '...',
        identity_commitment: proofResult.identity_commitment.slice(0, 20) + '...'
      });
    } catch (storeError) {
      logger.error('❌ [STORE] Failed to save identity commitment:', storeError.message);
      // Don't fail the request if storage fails - just log it
    }

    res.json({
      success: true,
      message: 'Identity proof generated successfully',
      proof: proofResult.proof,
      publicSignals: proofResult.publicSignals,
      identity_commitment: proofResult.identity_commitment,
      wallet_commitment: proofResult.wallet_commitment,
      age_verified: proofResult.age_verified
    });  } catch (error) {
    logger.error('❌ Identity proof generation failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/identity/verify-age-only
 * Quick age verification without document upload (for testing)
 */
router.post('/verify-age-only', async (req, res) => {
  try {
    const { dateOfBirth } = req.body;
    
    if (!dateOfBirth) {
      return res.status(400).json({
        success: false,
        error: 'Date of birth is required'
      });
    }
    
    const dobTimestamp = documentService.dobToTimestamp(dateOfBirth);
    const age = documentService.calculateAge(dobTimestamp);
    
    logger.info('Age quick check', { age, verified: age >= 18 });
    
    res.json({
      success: true,
      age: age,
      verified: age >= 18,
      message: age >= 18 ? '✅ Age verified (18+)' : '❌ Must be 18 or older'
    });
    
  } catch (error) {
    logger.error('Age verification error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/identity/current-timestamp
 * Get current timestamp for ZK proof verification
 */
router.get('/current-timestamp', (req, res) => {
  const timestamp = Math.floor(Date.now() / 1000);
  
  res.json({
    success: true,
    timestamp: timestamp,
    date: new Date().toISOString()
  });
});

// ====== STAGE 3: Identity Reveal (Existing - for overdue loans) ======

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

/**
 * GET /api/identity/cache-stats
 * Debug endpoint to check commitment cache status
 */
router.get('/cache-stats', (req, res) => {
  try {
    const stats = commitmentCache.getStats();
    logger.info('📊 [DEBUG] Cache stats requested', stats);
    res.json({
      success: true,
      ...stats
    });
  } catch (error) {
    logger.error('❌ [DEBUG] Failed to get cache stats', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/identity/cache-add
 * Debug endpoint to manually add commitment to cache
 */
router.post('/cache-add', (req, res) => {
  try {
    const { commitment } = req.body;
    
    if (!commitment) {
      return res.status(400).json({
        success: false,
        error: 'Commitment is required'
      });
    }
    
    commitmentCache.addCommitment(commitment);
    logger.info('✅ [DEBUG] Manually added commitment to cache', { 
      commitment: commitment.slice(0, 20) + '...' 
    });
    
    res.json({
      success: true,
      message: 'Commitment added to cache',
      commitment: commitment,
      stats: commitmentCache.getStats()
    });
  } catch (error) {
    logger.error('❌ [DEBUG] Failed to add commitment', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
