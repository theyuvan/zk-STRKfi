const zkService = require('../services/zkService');
const crypto = require('crypto');
const logger = require('../utils/logger');

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
      let { salary, threshold, salt } = req.body;

      if (!salary || !threshold) {
        return res.status(400).json({
          error: 'Missing required fields: salary, threshold'
        });
      }

      // Generate salt if not provided
      if (!salt) {
        salt = crypto.randomBytes(32).toString('hex');
        logger.info('Generated salt for proof', { hasSalt: true });
      }

      // Generate commitment
      const commitment = await zkService.generateCommitment(salary, salt);

      // Prepare inputs
      const inputs = zkService.prepareIncomeProofInputs(salary, threshold, salt);

      // Generate proof
      const { proof, publicSignals } = await zkService.generateProof(inputs);

      // Generate proof hash for on-chain storage
      const proofHash = crypto.createHash('sha256')
        .update(JSON.stringify(proof))
        .digest('hex');

      // Format for contract submission
      const formattedProof = zkService.exportProofForContract(proof, publicSignals);

      logger.info('ZK proof generated', {
        threshold,
        publicSignalsCount: publicSignals.length,
        proofHash: proofHash.substring(0, 16) + '...'
      });

      res.json({
        message: 'Proof generated successfully',
        proof: formattedProof,
        publicSignals,
        rawProof: proof,
        commitment,
        proofHash,
        salt
      });
    } catch (error) {
      logger.error('Generate proof failed', { error: error.message });
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
