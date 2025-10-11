const onchainService = require('../services/onchainService');
const scheduler = require('../utils/scheduler');
const walletConnectHelper = require('../utils/walletConnectHelper');
const logger = require('../utils/logger');

/**
 * Controller for loan lifecycle operations
 * All transactions are signed client-side
 */
class LoanController {
  /**
   * Create a loan request
   * Returns data for client-side transaction signing
   */
  async createRequest(req, res) {
    try {
      const { borrowerAddress, amount, threshold, proofHash, commitment } = req.body;

      if (!borrowerAddress || !amount || !threshold || !proofHash || !commitment) {
        return res.status(400).json({
          error: 'Missing required fields: borrowerAddress, amount, threshold, proofHash, commitment'
        });
      }

      // Generate message for client to sign
      const signatureMessage = walletConnectHelper.generateSignatureMessage(
        'create_loan_request',
        {
          borrowerAddress,
          amount,
          threshold,
          proofHash,
          commitment
        }
      );

      logger.info('Loan request prepared for signing', {
        borrowerAddress,
        amount
      });

      // Return transaction data for client-side signing
      res.json({
        message: 'Loan request prepared. Sign and submit transaction.',
        signatureMessage,
        contractAddress: process.env.STARKNET_LOAN_ESCROW_CONTRACT,
        functionName: 'create_loan_request',
        calldata: {
          amount: amount.toString(),
          threshold: threshold.toString(),
          proof_hash: proofHash,
          borrower_commit: commitment
        }
      });
    } catch (error) {
      logger.error('Create loan request failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Fund a loan
   * Returns data for client-side transaction signing
   */
  async fundLoan(req, res) {
    try {
      const { loanId, lenderAddress, cid } = req.body;

      if (!loanId || !lenderAddress || !cid) {
        return res.status(400).json({
          error: 'Missing required fields: loanId, lenderAddress, cid'
        });
      }

      // Verify loan exists and is in correct state
      const loanDetails = await onchainService.getLoanDetails(loanId);
      
      if (loanDetails.state !== 'pending') {
        return res.status(400).json({
          error: `Loan is not in pending state: ${loanDetails.state}`
        });
      }

      // Generate message for client to sign
      const signatureMessage = walletConnectHelper.generateSignatureMessage(
        'fund_loan',
        { loanId, lenderAddress, cid }
      );

      logger.info('Loan funding prepared for signing', {
        loanId,
        lenderAddress
      });

      res.json({
        message: 'Loan funding prepared. Sign and submit transaction.',
        signatureMessage,
        contractAddress: process.env.STARKNET_LOAN_ESCROW_CONTRACT,
        functionName: 'fund_loan',
        calldata: {
          loan_id: loanId,
          cid: cid
        },
        loanDetails
      });
    } catch (error) {
      logger.error('Fund loan failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Report loan payment
   * Returns data for client-side transaction signing
   */
  async reportPayment(req, res) {
    try {
      const { loanId, amount, borrowerAddress } = req.body;

      if (!loanId || !amount || !borrowerAddress) {
        return res.status(400).json({
          error: 'Missing required fields: loanId, amount, borrowerAddress'
        });
      }

      // Verify loan exists
      const loanDetails = await onchainService.getLoanDetails(loanId);

      if (loanDetails.state !== 'active') {
        return res.status(400).json({
          error: `Loan is not active: ${loanDetails.state}`
        });
      }

      // Generate message for client to sign
      const signatureMessage = walletConnectHelper.generateSignatureMessage(
        'report_payment',
        { loanId, amount, borrowerAddress }
      );

      logger.info('Payment report prepared for signing', {
        loanId,
        amount
      });

      res.json({
        message: 'Payment report prepared. Sign and submit transaction.',
        signatureMessage,
        contractAddress: process.env.STARKNET_LOAN_ESCROW_CONTRACT,
        functionName: 'report_payment',
        calldata: {
          loan_id: loanId,
          amount: amount.toString()
        }
      });
    } catch (error) {
      logger.error('Report payment failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Trigger default on a loan
   * Starts dispute window
   */
  async triggerDefault(req, res) {
    try {
      const { loanId, lenderAddress } = req.body;

      if (!loanId || !lenderAddress) {
        return res.status(400).json({
          error: 'Missing required fields: loanId, lenderAddress'
        });
      }

      // Verify loan exists and can be defaulted
      const loanDetails = await onchainService.getLoanDetails(loanId);

      if (loanDetails.state !== 'active') {
        return res.status(400).json({
          error: `Cannot default loan in state: ${loanDetails.state}`
        });
      }

      // Schedule dispute window completion
      const disputeTaskId = scheduler.scheduleDisputeWindow(loanId, () => {
        logger.info('Dispute window completed', { loanId });
        // Trigger identity reveal process
      });

      // Generate message for client to sign
      const signatureMessage = walletConnectHelper.generateSignatureMessage(
        'trigger_default',
        { loanId, lenderAddress }
      );

      logger.info('Default trigger prepared for signing', {
        loanId,
        disputeTaskId
      });

      res.json({
        message: 'Default trigger prepared. Sign and submit transaction.',
        signatureMessage,
        contractAddress: process.env.STARKNET_LOAN_ESCROW_CONTRACT,
        functionName: 'trigger_default',
        calldata: {
          loan_id: loanId
        },
        disputeTaskId,
        disputeWindowSeconds: process.env.DISPUTE_WINDOW_SECONDS
      });
    } catch (error) {
      logger.error('Trigger default failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get loan details
   */
  async getLoanDetails(req, res) {
    try {
      const { loanId } = req.params;

      if (!loanId) {
        return res.status(400).json({ error: 'Loan ID required' });
      }

      const loanDetails = await onchainService.getLoanDetails(loanId);

      logger.info('Loan details retrieved', { loanId });

      res.json({
        loanId,
        ...loanDetails
      });
    } catch (error) {
      logger.error('Get loan details failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get all loans for an address
   */
  async getLoansForAddress(req, res) {
    try {
      const { address } = req.params;

      if (!address) {
        return res.status(400).json({ error: 'Address required' });
      }

      // This would query events or indexed data for loans involving this address
      const loans = [];

      logger.info('Loans retrieved for address', {
        address,
        count: loans.length
      });

      res.json({ address, loans });
    } catch (error) {
      logger.error('Get loans for address failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new LoanController();
