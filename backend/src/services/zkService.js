const snarkjs = require('snarkjs');
const { buildPoseidon } = require('circomlibjs');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

/**
 * ZK Proof Service for wallet activity verification
 * Uses Groth16 zkSNARK protocol with Poseidon hash
 * 
 * CIRCUIT REQUIREMENTS:
 * This service expects compiled circuit files in contracts/zk/build/:
 * - activityVerifier.wasm (witness generator)
 * - activityVerifier.zkey (proving key)
 * - verification_key.json (verification key)
 * 
 * See contracts/zk/README.md for circuit compilation instructions
 */
class ZKService {
  constructor() {
    this.poseidon = null;
    // Circuit files will be in contracts/zk/build/ after compilation
    this.wasmPath = path.join(__dirname, '../../../contracts/zk/build/activityVerifier.wasm');
    this.zkeyPath = path.join(__dirname, '../../../contracts/zk/build/activityVerifier.zkey');
    this.vkeyPath = path.join(__dirname, '../../../contracts/zk/build/verification_key.json');
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
   * Generate witness from circuit inputs
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
   * Generate ZK proof using Groth16
   * @param {object} inputs - Circuit inputs { salary: activityScore, threshold, salt }
   * @returns {object} { proof, publicSignals }
   */
  async generateProof(inputs) {
    try {
      await this.initialize();

      logger.info('Generating ZK proof', {
        hasThreshold: !!inputs.threshold,
        hasSalt: !!inputs.salt
      });

      // Use fullProve which combines witness generation and proving
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
   * @param {object} proof - Proof object from generateProof
   * @param {array} publicSignals - Public signals from generateProof
   * @returns {boolean} True if proof is valid
   */
  async verifyProof(proof, publicSignals) {
    try {
      await this.initialize();

      // Load verification key
      const vkeyData = await fs.readFile(this.vkeyPath, 'utf8');
      const vkey = JSON.parse(vkeyData);

      // Verify the proof
      const verified = await snarkjs.groth16.verify(vkey, publicSignals, proof);

      logger.info('Proof verification completed', { verified });
      return verified;
    } catch (error) {
      logger.error('Proof verification failed', { error: error.message });
      throw new Error(`Proof verification failed: ${error.message}`);
    }
  }

  /**
   * Hash inputs using Poseidon hash function
   * @param {array} inputs - Array of field elements to hash
   * @returns {string} Hash output as string
   */
  async poseidonHash(inputs) {
    await this.initialize();
    const hash = this.poseidon(inputs);
    return this.poseidon.F.toString(hash);
  }

  /**
   * Generate commitment (hash of salary/activityScore + salt)
   * Used for hiding the actual score while proving it meets threshold
   * @param {number} salary - Activity score (or salary in traditional system)
   * @param {string} salt - Random salt (hex string)
   * @returns {string} Commitment hash
   */
  async generateCommitment(salary, salt) {
    // Convert hex string to BigInt (add 0x prefix if not present)
    const saltBigInt = BigInt(salt.startsWith('0x') ? salt : '0x' + salt);
    return await this.poseidonHash([BigInt(salary), saltBigInt]);
  }

  /**
   * Prepare circuit inputs for activity/income verification
   * @param {number} salary - Activity score or annual salary
   * @param {number} threshold - Minimum required score/salary
   * @param {string} salt - Random salt for privacy
   * @param {string} walletAddress - Wallet address (optional, defaults to placeholder)
   * @returns {object} Circuit inputs ready for proof generation
   */
  prepareIncomeProofInputs(salary, threshold, salt, walletAddress = '12345678901234567890') {
    // Convert wallet address to BigInt for circuit
    const addressBigInt = walletAddress.startsWith('0x') 
      ? BigInt(walletAddress).toString()
      : walletAddress;

    // Convert salt to BigInt (add 0x prefix if not present)
    const saltBigInt = BigInt(salt.startsWith('0x') ? salt : '0x' + salt).toString();

    return {
      activity_score: salary.toString(),
      threshold: threshold.toString(),
      salt: saltBigInt,
      wallet_address: addressBigInt
    };
  }

  /**
   * Export proof in format suitable for on-chain verification
   * @param {object} proof - Proof object from generateProof
   * @param {array} publicSignals - Public signals array
   * @returns {object} Formatted proof for smart contract
   */
  exportProofForContract(proof, publicSignals) {
    return {
      a: [proof.pi_a[0], proof.pi_a[1]],
      b: [
        [proof.pi_b[0][1], proof.pi_b[0][0]],
        [proof.pi_b[1][1], proof.pi_b[1][0]]
      ],
      c: [proof.pi_c[0], proof.pi_c[1]],
      publicSignals: publicSignals
    };
  }

  /**
   * Hash proof data for on-chain storage
   * Used to create a compact reference to the full proof
   * @param {object} proof - Proof object
   * @param {array} publicSignals - Public signals
   * @returns {string} Hash of proof data
   */
  async hashProof(proof, publicSignals) {
    await this.initialize();
    
    // Concatenate all proof elements
    const proofElements = [
      ...proof.pi_a,
      ...proof.pi_b.flat(),
      ...proof.pi_c,
      ...publicSignals.map(s => BigInt(s))
    ];

    // Hash using Poseidon
    return await this.poseidonHash(proofElements.map(e => 
      typeof e === 'string' ? BigInt(e) : e
    ));
  }
}

module.exports = new ZKService();
