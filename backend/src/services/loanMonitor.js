/**
 * Loan Monitor Service
 * Tracks active loans and handles default/repayment logic
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');

class LoanMonitor extends EventEmitter {
  constructor() {
    super();
    this.activeLoans = new Map(); // loanId -> loan data
    this.timers = new Map(); // loanId -> timeout reference
  }

  /**
   * Register a new loan for monitoring
   * @param {Object} loanData - Loan details
   * @param {string} loanData.loanId - Unique loan identifier
   * @param {string} loanData.borrowerAddress - Borrower's wallet address
   * @param {string} loanData.lenderAddress - Lender's wallet address
   * @param {string} loanData.amount - Loan amount in wei
   * @param {string} loanData.repaymentAmount - Total repayment amount with interest
   * @param {number} loanData.deadline - Unix timestamp of repayment deadline
   * @param {string} loanData.proofHash - ZK proof hash
   * @param {string} loanData.commitment - Activity score commitment
   */
  startMonitoring(loanData) {
    const { loanId, deadline, borrowerAddress, lenderAddress } = loanData;

    if (this.activeLoans.has(loanId)) {
      logger.warn(`Loan ${loanId} is already being monitored`);
      return;
    }

    // Store loan data
    this.activeLoans.set(loanId, {
      ...loanData,
      status: 'active',
      monitoringStartedAt: Date.now()
    });

    // Calculate time until deadline
    const timeUntilDeadline = deadline - Date.now();

    if (timeUntilDeadline <= 0) {
      // Already past deadline
      logger.warn(`Loan ${loanId} deadline has already passed`);
      this.handleDefault(loanId);
      return;
    }

    // Set timeout for automatic default handling
    const timer = setTimeout(() => {
      this.handleDefault(loanId);
    }, timeUntilDeadline);

    this.timers.set(loanId, timer);

    logger.info(`📊 Monitoring started for loan ${loanId}`, {
      borrower: borrowerAddress,
      lender: lenderAddress,
      deadline: new Date(deadline).toISOString(),
      timeRemaining: `${Math.floor(timeUntilDeadline / 1000)}s`
    });

    // Emit event
    this.emit('loan:monitoring_started', { loanId, loanData });
  }

  /**
   * Handle loan repayment
   * @param {string} loanId - Loan ID
   * @param {string} txHash - Transaction hash of repayment
   */
  handleRepayment(loanId, txHash) {
    const loan = this.activeLoans.get(loanId);

    if (!loan) {
      logger.warn(`Attempt to repay non-existent loan: ${loanId}`);
      throw new Error('Loan not found');
    }

    if (loan.status !== 'active') {
      logger.warn(`Attempt to repay non-active loan: ${loanId} (status: ${loan.status})`);
      throw new Error(`Cannot repay loan with status: ${loan.status}`);
    }

    // Clear the default timer
    const timer = this.timers.get(loanId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(loanId);
    }

    // Update loan status
    loan.status = 'repaid';
    loan.repaidAt = Date.now();
    loan.repaymentTxHash = txHash;

    logger.info(`✅ Loan repaid successfully`, {
      loanId,
      borrower: loan.borrowerAddress,
      amount: loan.repaymentAmount,
      txHash,
      repaidAt: new Date(loan.repaidAt).toISOString()
    });

    // Emit repayment event
    this.emit('loan:repaid', {
      loanId,
      borrowerAddress: loan.borrowerAddress,
      lenderAddress: loan.lenderAddress,
      amount: loan.repaymentAmount,
      txHash,
      repaidAt: loan.repaidAt
    });

    // Remove from active monitoring after 1 minute (keep in history)
    setTimeout(() => {
      this.activeLoans.delete(loanId);
      logger.info(`Loan ${loanId} removed from monitoring (repaid)`);
    }, 60000);

    return loan;
  }

  /**
   * Handle loan default (deadline passed without repayment)
   * @param {string} loanId - Loan ID
   */
  handleDefault(loanId) {
    const loan = this.activeLoans.get(loanId);

    if (!loan) {
      logger.warn(`Attempt to default non-existent loan: ${loanId}`);
      return;
    }

    if (loan.status !== 'active') {
      logger.warn(`Attempt to default non-active loan: ${loanId} (status: ${loan.status})`);
      return;
    }

    // Clear timer if exists
    const timer = this.timers.get(loanId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(loanId);
    }

    // Update loan status
    loan.status = 'defaulted';
    loan.defaultedAt = Date.now();

    // **IDENTITY REVEAL - Console Logging**
    console.log('\n' + '='.repeat(80));
    console.log('🚨 LOAN DEFAULT DETECTED - IDENTITY REVEAL 🚨');
    console.log('='.repeat(80));
    console.log('Loan ID:           ', loanId);
    console.log('Borrower Address:  ', loan.borrowerAddress);
    console.log('Lender Address:    ', loan.lenderAddress);
    console.log('Loan Amount:       ', `${parseInt(loan.amount) / 1e18} STRK`);
    console.log('Repayment Amount:  ', `${parseInt(loan.repaymentAmount) / 1e18} STRK`);
    console.log('Deadline:          ', new Date(loan.deadline).toISOString());
    console.log('Defaulted At:      ', new Date(loan.defaultedAt).toISOString());
    console.log('Proof Hash:        ', loan.proofHash);
    console.log('Commitment:        ', loan.commitment);
    console.log('='.repeat(80));
    console.log('⚠️  Borrower identity revealed to lender for collection purposes');
    console.log('='.repeat(80) + '\n');

    logger.warn(`❌ Loan defaulted - Identity revealed`, {
      loanId,
      borrower: loan.borrowerAddress,
      lender: loan.lenderAddress,
      amount: loan.amount,
      deadline: new Date(loan.deadline).toISOString(),
      defaultedAt: new Date(loan.defaultedAt).toISOString()
    });

    // Emit default event
    this.emit('loan:defaulted', {
      loanId,
      borrowerAddress: loan.borrowerAddress,
      lenderAddress: loan.lenderAddress,
      amount: loan.amount,
      repaymentAmount: loan.repaymentAmount,
      deadline: loan.deadline,
      defaultedAt: loan.defaultedAt,
      proofHash: loan.proofHash,
      commitment: loan.commitment
    });

    // Keep in history for a while, then remove
    setTimeout(() => {
      this.activeLoans.delete(loanId);
      logger.info(`Loan ${loanId} removed from monitoring (defaulted)`);
    }, 300000); // 5 minutes

    return loan;
  }

  /**
   * Get loan status
   * @param {string} loanId - Loan ID
   * @returns {Object|null} Loan data or null if not found
   */
  getLoanStatus(loanId) {
    return this.activeLoans.get(loanId) || null;
  }

  /**
   * Get all active loans
   * @returns {Array} Array of active loan data
   */
  getActiveLoans() {
    return Array.from(this.activeLoans.values()).filter(loan => loan.status === 'active');
  }

  /**
   * Get loans by borrower address
   * @param {string} borrowerAddress - Borrower's wallet address
   * @returns {Array} Array of loans for this borrower
   */
  getLoansByBorrower(borrowerAddress) {
    return Array.from(this.activeLoans.values()).filter(
      loan => loan.borrowerAddress.toLowerCase() === borrowerAddress.toLowerCase()
    );
  }

  /**
   * Get loans by lender address
   * @param {string} lenderAddress - Lender's wallet address
   * @returns {Array} Array of loans for this lender
   */
  getLoansByLender(lenderAddress) {
    return Array.from(this.activeLoans.values()).filter(
      loan => loan.lenderAddress.toLowerCase() === lenderAddress.toLowerCase()
    );
  }

  /**
   * Manually trigger default (for testing or admin purposes)
   * @param {string} loanId - Loan ID
   */
  forceDefault(loanId) {
    logger.info(`Force defaulting loan: ${loanId}`);
    return this.handleDefault(loanId);
  }

  /**
   * Cancel loan monitoring (e.g., loan was canceled)
   * @param {string} loanId - Loan ID
   */
  stopMonitoring(loanId) {
    const timer = this.timers.get(loanId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(loanId);
    }

    const loan = this.activeLoans.get(loanId);
    if (loan) {
      loan.status = 'canceled';
      this.activeLoans.delete(loanId);
      logger.info(`Monitoring stopped for loan ${loanId} (canceled)`);
    }
  }

  /**
   * Get monitoring statistics
   * @returns {Object} Statistics about monitored loans
   */
  getStats() {
    const loans = Array.from(this.activeLoans.values());
    return {
      totalLoans: loans.length,
      activeLoans: loans.filter(l => l.status === 'active').length,
      repaidLoans: loans.filter(l => l.status === 'repaid').length,
      defaultedLoans: loans.filter(l => l.status === 'defaulted').length,
      loans: loans.map(l => ({
        loanId: l.loanId,
        status: l.status,
        borrower: l.borrowerAddress,
        deadline: new Date(l.deadline).toISOString(),
        timeRemaining: l.deadline - Date.now()
      }))
    };
  }
}

// Singleton instance
const loanMonitor = new LoanMonitor();

module.exports = loanMonitor;
