const zkService = require('../services/zkService');
const crypto = require('crypto');
const logger = require('../utils/logger');
const commitmentCache = require('../services/commitmentCacheService');
const identityCommitmentStore = require('../services/identityCommitmentStore');

/**
 * Controller for ZK proof generation and verification
 */
class ProofController {
  /**
   * Prepare proof inputs
   * Generates salt and commitment for client
   */
  async prepareProofInputs(req, res) {
    try {
      const { salary, threshold } = req.body;

      if (!salary || !threshold) {
        return res.status(400).json({
          error: 'Missing required fields: salary, threshold'
        });
      }

      // Validate salary meets threshold
      if (salary < threshold) {
        return res.status(400).json({
          error: 'Salary does not meet threshold requirement'
        });
      }

      // Generate random salt for privacy
      const salt = crypto.randomBytes(32).toString('hex');

      // Generate commitment
      const commitment = await zkService.generateCommitment(salary, salt);

      // Prepare circuit inputs
      const inputs = zkService.prepareIncomeProofInputs(salary, threshold, salt);

      logger.info('Proof inputs prepared', {
        threshold,
        hasSalt: !!salt,
        hasCommitment: !!commitment
      });

      res.json({
        message: 'Proof inputs prepared. Generate proof client-side or use server.',
        inputs,
        commitment,
        salt,
        threshold
      });
    } catch (error) {
      logger.error('Prepare proof inputs failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Generate ZK proof server-side
   * NOTE: In production, this should be done client-side for maximum privacy
   */
  async generateProof(req, res) {
    try {
      let { salary, threshold, salt, walletAddress, identityCommitment } = req.body;

      if (!salary || !threshold) {
        return res.status(400).json({
          error: 'Missing required fields: salary, threshold'
        });
      }

      // Use wallet address or default
      if (!walletAddress) {
        walletAddress = '123456789012345678901234567890';
      }

      // ===== IDENTITY COMMITMENT SYSTEM =====
      // The identity commitment is PERMANENT and doesn't change
      // It's calculated ONCE on first registration: Poseidon(initial_score, wallet, salt)
      // For ALL future proofs, we reuse this SAME commitment for applications
      // This allows lenders to see all applications from same borrower
      // 
      // The actual proof can have DIFFERENT scores (for credit score updates)
      // but applications always use the SAME identity commitment
      
      // Always use deterministic salt from wallet address
      const saltHash = crypto.createHash('sha256')
        .update(walletAddress + '_identity_v1')
        .digest('hex');
      salt = saltHash;

      // Generate current proof commitment (with current score)
      const currentCommitmentBigInt = await zkService.poseidonHash([
        BigInt(salary),
        BigInt(walletAddress),
        BigInt('0x' + salt)
      ]);
      const currentCommitment = '0x' + BigInt(currentCommitmentBigInt).toString(16);

      // If no identity commitment provided, use current as identity (first time)
      const finalIdentityCommitment = identityCommitment || currentCommitment;

      logger.info('� Identity system', { 
        hasExistingIdentity: !!identityCommitment,
        identityCommitment: finalIdentityCommitment.slice(0, 20) + '...',
        currentCommitment: currentCommitment.slice(0, 20) + '...',
        sameAsIdentity: finalIdentityCommitment === currentCommitment,
        walletAddress: walletAddress.slice(0, 20) + '...'
      });

      // Prepare inputs for the circuit
      const inputs = zkService.prepareIncomeProofInputs(salary, threshold, salt, walletAddress);

      logger.info('Circuit inputs prepared:', inputs);

      // Generate proof using real Groth16 circuit
      const { proof, publicSignals } = await zkService.generateProof(inputs);

      // Generate proof hash for on-chain storage (truncated to fit felt252)
      const proofHashFull = crypto.createHash('sha256')
        .update(JSON.stringify(proof))
        .digest('hex');
      
      // Truncate to 63 hex chars (252 bits) to fit in felt252
      const proofHash = '0x' + proofHashFull.slice(0, 63);

      // Format for contract submission
      const formattedProof = zkService.exportProofForContract(proof, publicSignals);

      logger.info('ZK proof generated', {
        threshold,
        activityScore: salary,
        publicSignalsCount: publicSignals.length,
        proofHash: proofHash.substring(0, 20) + '...',
        identityCommitment: finalIdentityCommitment.slice(0, 20) + '...'
      });

      // ===== ADD TO COMMITMENT CACHE =====
      // Cache this borrower's permanent identity so lenders can discover applications
      commitmentCache.addCommitment(finalIdentityCommitment);
      logger.info('💾 [CACHE] Commitment cached for future application discovery');

      // ===== STORE ACTIVITY COMMITMENT IN JSON FILE =====
      // This is the commitment used for loan applications (activity proof)
      // We store it so we can map it back to the identity_commitment during reveal
      try {
        // First, check if there's an existing identity_commitment from Step 2
        const existingData = await identityCommitmentStore.getCommitmentsByWallet(walletAddress);
        
        if (existingData && existingData.identity_commitment) {
          // User already has identity_commitment from Step 2, preserve it
          logger.info('✅ [STORE] Found existing identity_commitment, preserving it', {
            wallet: walletAddress.slice(0, 10) + '...',
            identity: existingData.identity_commitment.slice(0, 20) + '...'
          });
          
          // Update only the activity_commitment
          await identityCommitmentStore.storeActivityCommitment(
            walletAddress,
            finalIdentityCommitment // This is the activity commitment stored on-chain
          );
        } else {
          // No identity_commitment yet (user skipped Step 2 or did it out of order)
          // Just store the activity_commitment for now
          logger.warn('⚠️ [STORE] No identity_commitment found for this wallet. User may not have completed identity verification.', {
            wallet: walletAddress.slice(0, 10) + '...'
          });
          
          await identityCommitmentStore.storeActivityCommitment(
            walletAddress,
            finalIdentityCommitment
          );
        }
        
        logger.info('💾 [STORE] Activity commitment saved to JSON file', {
          wallet: walletAddress.slice(0, 10) + '...',
          activity_commitment: finalIdentityCommitment.slice(0, 20) + '...'
        });
      } catch (storeError) {
        logger.error('❌ [STORE] Failed to save activity commitment:', storeError.message);
        // Don't fail the request if storage fails - just log it
      }

      res.json({
        message: 'Proof generated successfully',
        proof: formattedProof,
        publicSignals,
        rawProof: proof,
        commitment: currentCommitment, // Current proof commitment (changes with score)
        identityCommitment: finalIdentityCommitment, // PERMANENT identity (never changes)
        commitmentHash: finalIdentityCommitment, // For applications - use identity!
        proofHash,
        salt,
        activityScore: salary
      });
    } catch (error) {
      logger.error('Generate proof failed', { error: error.message, stack: error.stack });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Verify ZK proof
   */
  async verifyProof(req, res) {
    try {
      const { proof, publicSignals } = req.body;

      if (!proof || !publicSignals) {
        return res.status(400).json({
          error: 'Missing required fields: proof, publicSignals'
        });
      }

      // Verify proof
      const isValid = await zkService.verifyProof(proof, publicSignals);

      logger.info('Proof verification completed', { isValid });

      res.json({
        verified: isValid,
        publicSignals,
        message: isValid ? 'Proof is valid' : 'Proof verification failed'
      });
    } catch (error) {
      logger.error('Verify proof failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Generate commitment from salary and salt
   */
  async generateCommitment(req, res) {
    try {
      const { salary, salt } = req.body;

      if (!salary || !salt) {
        return res.status(400).json({
          error: 'Missing required fields: salary, salt'
        });
      }

      const commitment = await zkService.generateCommitment(salary, salt);

      logger.info('Commitment generated');

      res.json({
        commitment,
        salary: parseInt(salary),
        message: 'Commitment generated successfully'
      });
    } catch (error) {
      logger.error('Generate commitment failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get proof status from blockchain
   */
  async getProofStatus(req, res) {
    try {
      const { proofHash } = req.params;

      if (!proofHash) {
        return res.status(400).json({ error: 'Proof hash required' });
      }

      const onchainService = require('../services/onchainService');
      const isVerified = await onchainService.isProofVerified(proofHash);

      logger.info('Proof status retrieved', { proofHash, isVerified });

      res.json({
        proofHash,
        verified: isVerified,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Get proof status failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Hash proof for on-chain storage
   */
  async hashProof(req, res) {
    try {
      const { proof, publicSignals } = req.body;

      if (!proof || !publicSignals) {
        return res.status(400).json({
          error: 'Missing required fields: proof, publicSignals'
        });
      }

      // Create hash of proof data
      const proofData = JSON.stringify({ proof, publicSignals });
      const hash = crypto.createHash('sha256').update(proofData).digest('hex');

      logger.info('Proof hashed');

      res.json({
        proofHash: hash,
        message: 'Proof hash generated'
      });
    } catch (error) {
      logger.error('Hash proof failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new ProofController();
