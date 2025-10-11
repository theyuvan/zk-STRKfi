const rpcClient = require('../utils/rpcClient');
const logger = require('../utils/logger');

/**
 * Service for on-chain reads and event monitoring
 */
class OnchainService {
  constructor() {
    this.payrollContract = process.env.STARKNET_PAYROLL_CONTRACT;
    this.loanEscrowContract = process.env.STARKNET_LOAN_ESCROW_CONTRACT;
    this.verifierContract = process.env.STARKNET_VERIFIER_CONTRACT;
  }

  /**
   * Get loan details from contract
   * @param {string} loanId - Loan ID
   * @returns {object} Loan details
   */
  async getLoanDetails(loanId) {
    try {
      const abi = require('../contracts/starknet/loan_escrow_compiled.json').abi;
      
      const result = await rpcClient.callStarkNet(
        this.loanEscrowContract,
        abi,
        'get_loan',
        [loanId]
      );

      logger.info('Retrieved loan details', { loanId });
      
      return {
        borrower: result.borrower,
        lender: result.lender,
        amount: result.amount,
        state: result.state,
        borrowerCommit: result.borrower_commit,
        cid: result.cid,
        createdAt: result.created_at
      };
    } catch (error) {
      logger.error('Failed to get loan details', {
        loanId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get salary from payroll contract
   * @param {string} address - User address
   * @returns {number} Salary amount
   */
  async getSalary(address) {
    try {
      const abi = require('../contracts/starknet/payroll_compiled.json').abi;
      
      const result = await rpcClient.callStarkNet(
        this.payrollContract,
        abi,
        'get_salary',
        [address]
      );

      logger.info('Retrieved salary from contract', { address });
      return result;
    } catch (error) {
      logger.error('Failed to get salary', {
        address,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Check if proof is verified on-chain
   * @param {string} proofHash - Hash of the proof
   * @returns {boolean} Verification status
   */
  async isProofVerified(proofHash) {
    try {
      const abi = require('../contracts/starknet/verifier_stub_compiled.json').abi;
      
      const result = await rpcClient.callStarkNet(
        this.verifierContract,
        abi,
        'is_verified',
        [proofHash]
      );

      logger.info('Checked proof verification', { proofHash, verified: result });
      return result;
    } catch (error) {
      logger.error('Failed to check proof verification', {
        proofHash,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get loan events from blockchain
   * @param {string} fromBlock - Starting block number
   * @param {string} toBlock - Ending block number
   * @returns {array} Array of events
   */
  async getLoanEvents(fromBlock = 'latest', toBlock = 'latest') {
    try {
      const abi = require('../contracts/starknet/loan_escrow_compiled.json').abi;
      const contract = rpcClient.getStarkNetContract(this.loanEscrowContract, abi);

      // Get events from contract
      // Note: Event fetching implementation depends on StarkNet.js version
      const events = [];

      logger.info('Retrieved loan events', {
        fromBlock,
        toBlock,
        eventCount: events.length
      });

      return events;
    } catch (error) {
      logger.error('Failed to get loan events', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Monitor contract for specific event
   * @param {string} eventName - Event name to monitor
   * @param {function} callback - Callback function for events
   */
  async monitorEvent(eventName, callback) {
    try {
      logger.info('Started monitoring event', { eventName });
      
      // Implementation would use StarkNet provider's event watching
      // This is a placeholder for the actual event monitoring logic
      
    } catch (error) {
      logger.error('Failed to monitor event', {
        eventName,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get current block number
   * @returns {number} Block number
   */
  async getCurrentBlock() {
    try {
      return await rpcClient.getStarkNetBlockNumber();
    } catch (error) {
      logger.error('Failed to get current block', {
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new OnchainService();
