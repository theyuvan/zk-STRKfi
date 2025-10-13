/**
 * Commitment Cache Service
 * 
 * This service maintains a cache of known borrower commitments (permanent identities)
 * to solve the contract limitation where get_application() requires knowing the 
 * commitment beforehand.
 * 
 * The cache is built by:
 * 1. Monitoring application events (LoanApplicationSubmitted)
 * 2. Scanning borrower queries
 * 3. Manual addition when borrowers generate proofs
 * 
 * This allows lenders to see WHO applied to their loans by their commitment hash.
 */

const logger = require('../utils/logger');

class CommitmentCacheService {
  constructor() {
    // In-memory cache: Set of known commitments
    // In production, use Redis or database
    this.knownCommitments = new Set();
    
    // Map: loan_id -> Set of commitments
    this.loanApplications = new Map();
    
    logger.info('💾 Commitment Cache Service initialized');
  }

  /**
   * Add a commitment to the cache
   * @param {string} commitment - The borrower's permanent identity commitment (felt252)
   * @param {string} loanId - Optional: The loan ID this commitment applied to
   */
  addCommitment(commitment, loanId = null) {
    if (!commitment || commitment === '0x0') {
      return;
    }

    // Normalize commitment (ensure 0x prefix)
    const normalizedCommitment = commitment.startsWith('0x') ? commitment : `0x${commitment}`;
    
    // Add to global known commitments
    if (!this.knownCommitments.has(normalizedCommitment)) {
      this.knownCommitments.add(normalizedCommitment);
      logger.info(`✅ [CACHE] New commitment added: ${normalizedCommitment.slice(0, 20)}...`);
    }

    // If loan ID provided, add to loan-specific mapping
    if (loanId) {
      const loanIdStr = loanId.toString();
      if (!this.loanApplications.has(loanIdStr)) {
        this.loanApplications.set(loanIdStr, new Set());
      }
      this.loanApplications.get(loanIdStr).add(normalizedCommitment);
      logger.info(`✅ [CACHE] Commitment linked to loan #${loanIdStr}`);
    }
  }

  /**
   * Add multiple commitments at once
   * @param {Array<string>} commitments - Array of commitment hashes
   */
  addCommitments(commitments) {
    commitments.forEach(commitment => this.addCommitment(commitment));
  }

  /**
   * Get all known commitments
   * @returns {Array<string>} Array of all known commitment hashes
   */
  getAllCommitments() {
    return Array.from(this.knownCommitments);
  }

  /**
   * Get commitments for a specific loan
   * @param {string} loanId - The loan ID
   * @returns {Array<string>} Array of commitments that applied to this loan
   */
  getCommitmentsForLoan(loanId) {
    const loanIdStr = loanId.toString();
    const commitments = this.loanApplications.get(loanIdStr);
    return commitments ? Array.from(commitments) : [];
  }

  /**
   * Check if a commitment exists in cache
   * @param {string} commitment - The commitment hash to check
   * @returns {boolean} True if commitment is known
   */
  hasCommitment(commitment) {
    const normalizedCommitment = commitment.startsWith('0x') ? commitment : `0x${commitment}`;
    return this.knownCommitments.has(normalizedCommitment);
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    return {
      totalCommitments: this.knownCommitments.size,
      loansWithApplications: this.loanApplications.size,
      commitmentsList: Array.from(this.knownCommitments).map(c => c.slice(0, 20) + '...')
    };
  }

  /**
   * Clear cache (for testing or reset)
   */
  clear() {
    this.knownCommitments.clear();
    this.loanApplications.clear();
    logger.info('🗑️ [CACHE] Cache cleared');
  }
}

// Export singleton instance
const commitmentCache = new CommitmentCacheService();
module.exports = commitmentCache;
