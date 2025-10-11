const snarkjs = require('snarkjs');
const { buildPoseidon } = require('circomlibjs');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class ZKService {
  constructor() {
    this.poseidon = null;
    this.wasmPath = path.join(__dirname, '../../contracts/zk/build/incomeVerifier.wasm');
    this.zkeyPath = path.join(__dirname, '../../contracts/zk/build/incomeVerifier.zkey');
    this.vkeyPath = path.join(__dirname, '../../contracts/zk/build/verification_key.json');
  }

  /**
   * Initialize Poseidon hash function
   */
  async initialize() {
    if (!this.poseidon) {
      this.poseidon = await buildPoseidon();
      logger.info('ZK Service initialized');
    }
  }

  /**
   * Generate witness from inputs
   * @param {object} inputs - Circuit inputs
   * @returns {object} Witness
   */
  async generateWitness(inputs) {
    try {
      await this.initialize();
      
      const { witness } = await snarkjs.wtns.calculate(
        inputs,
        this.wasmPath,
        null
      );

      logger.info('Generated witness', {
        inputKeys: Object.keys(inputs)
      });

      return witness;
    } catch (error) {
      logger.error('Witness generation failed', { error: error.message });
      throw new Error(`Witness generation failed: ${error.message}`);
    }
  }

  /**
   * Generate ZK proof
   * @param {object} inputs - Circuit inputs { salary, threshold, salt }
   * @returns {object} { proof, publicSignals }
   */
  async generateProof(inputs) {
    try {
      await this.initialize();

      logger.info('Generating ZK proof', {
        hasThreshold: !!inputs.threshold,
        hasSalt: !!inputs.salt
      });

      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        inputs,
        this.wasmPath,
        this.zkeyPath
      );

      logger.info('ZK proof generated successfully', {
        publicSignalsCount: publicSignals.length
      });

      return { proof, publicSignals };
    } catch (error) {
      logger.error('Proof generation failed', { error: error.message });
      throw new Error(`Proof generation failed: ${error.message}`);
    }
  }

  /**
   * Verify ZK proof
   * @param {object} proof - Proof object
   * @param {array} publicSignals - Public signals
   * @returns {boolean} True if proof is valid
   */
  async verifyProof(proof, publicSignals) {
    try {
      await this.initialize();

      const vkeyData = await fs.readFile(this.vkeyPath, 'utf8');
      const vkey = JSON.parse(vkeyData);

      const verified = await snarkjs.groth16.verify(vkey, publicSignals, proof);

      logger.info('Proof verification completed', { verified });
      return verified;
    } catch (error) {
      logger.error('Proof verification failed', { error: error.message });
      throw new Error(`Proof verification failed: ${error.message}`);
    }
  }

  /**
   * Hash inputs using Poseidon
   * @param {array} inputs - Array of field elements to hash
   * @returns {string} Hash output
   */
  async poseidonHash(inputs) {
    await this.initialize();
    const hash = this.poseidon(inputs);
    return this.poseidon.F.toString(hash);
  }

  /**
   * Generate commitment (hash of salary + salt)
   * @param {number} salary - Salary value
   * @param {string} salt - Random salt
   * @returns {string} Commitment hash
   */
  async generateCommitment(salary, salt) {
    return await this.poseidonHash([BigInt(salary), BigInt(salt)]);
  }

  /**
   * Prepare proof inputs for income verification
   * @param {number} salary - Annual salary
   * @param {number} threshold - Minimum required salary
   * @param {string} salt - Random salt for privacy
   * @returns {object} Circuit inputs
   */
  prepareIncomeProofInputs(salary, threshold, salt) {
    return {
      salary: salary.toString(),
      threshold: threshold.toString(),
      salt: salt
    };
  }

  /**
   * Export proof for on-chain verification
   * @param {object} proof - Proof object
   * @param {array} publicSignals - Public signals
   * @returns {object} Formatted proof for contract
   */
  exportProofForContract(proof, publicSignals) {
    return {
      a: [proof.pi_a[0], proof.pi_a[1]],
      b: [
        [proof.pi_b[0][1], proof.pi_b[0][0]],
        [proof.pi_b[1][1], proof.pi_b[1][0]]
      ],
      c: [proof.pi_c[0], proof.pi_c[1]],
      publicSignals: publicSignals.map(s => s.toString())
    };
  }
}

module.exports = new ZKService();
