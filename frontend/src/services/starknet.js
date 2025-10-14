import { Contract } from 'starknet';

// ✅ Contract addresses from environment variables - UPDATED
const STARKNET_PAYROLL_CONTRACT = import.meta.env.VITE_STARKNET_PAYROLL_CONTRACT;
const STARKNET_LOAN_ESCROW_CONTRACT = import.meta.env.VITE_LOAN_ESCROW_ZK_ADDRESS || 
  '0x06b058a0946bb36fa846e6a954da885fa20809f43a9e47038dc83b4041f7f012';
const STARKNET_VERIFIER_CONTRACT = import.meta.env.VITE_ACTIVITY_VERIFIER_ADDRESS || 
  '0x071b94eb84b81868b61fb0ec1bbb59df47bb508583bc79325e5fa997ee3eb4be';

export class StarkNetService {
  constructor(wallet) {
    this.wallet = wallet;
    this.account = wallet?.account;
  }
  
  // Create loan request
  async createLoanRequest(amount, threshold, proofHash, borrowerCommit) {
    if (!this.account) {
      throw new Error('Wallet not connected');
    }
    
    try {
      const calldata = {
        amount: amount.toString(),
        threshold: threshold.toString(),
        proof_hash: proofHash,
        borrower_commit: borrowerCommit,
      };
      
      const tx = await this.account.execute({
        contractAddress: STARKNET_LOAN_ESCROW_CONTRACT,
        entrypoint: 'create_loan_request',
        calldata: Object.values(calldata),
      });
      
      await this.account.waitForTransaction(tx.transaction_hash);
      
      return {
        transactionHash: tx.transaction_hash,
        success: true,
      };
    } catch (error) {
      console.error('Create loan request error:', error);
      throw error;
    }
  }
  
  // Fund loan
  async fundLoan(loanId, cid) {
    if (!this.account) {
      throw new Error('Wallet not connected');
    }
    
    try {
      const tx = await this.account.execute({
        contractAddress: STARKNET_LOAN_ESCROW_CONTRACT,
        entrypoint: 'fund_loan',
        calldata: [loanId, cid],
      });
      
      await this.account.waitForTransaction(tx.transaction_hash);
      
      return {
        transactionHash: tx.transaction_hash,
        success: true,
      };
    } catch (error) {
      console.error('Fund loan error:', error);
      throw error;
    }
  }
  
  // Report payment
  async reportPayment(loanId, amount) {
    if (!this.account) {
      throw new Error('Wallet not connected');
    }
    
    try {
      const tx = await this.account.execute({
        contractAddress: STARKNET_LOAN_ESCROW_CONTRACT,
        entrypoint: 'report_payment',
        calldata: [loanId, amount],
      });
      
      await this.account.waitForTransaction(tx.transaction_hash);
      
      return {
        transactionHash: tx.transaction_hash,
        success: true,
      };
    } catch (error) {
      console.error('Report payment error:', error);
      throw error;
    }
  }
  
  // Get loan details
  async getLoanDetails(loanId) {
    if (!this.account) {
      throw new Error('Wallet not connected');
    }
    
    try {
      const result = await this.account.callContract({
        contractAddress: STARKNET_LOAN_ESCROW_CONTRACT,
        entrypoint: 'get_loan',
        calldata: [loanId],
      });
      
      return result;
    } catch (error) {
      console.error('Get loan details error:', error);
      throw error;
    }
  }
}

export default StarkNetService;
