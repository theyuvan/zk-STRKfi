import { ethers } from 'ethers';

// Contract addresses from environment variables
const EVM_ESCROW_CONTRACT = import.meta.env.VITE_EVM_ESCROW_CONTRACT;
const EVM_IDENTITY_REVEAL_CONTRACT = import.meta.env.VITE_EVM_IDENTITY_REVEAL_CONTRACT;

// ABIs (simplified - you should import the full ABI from your build artifacts)
const ESCROW_ABI = [
  'function createLoanRequest(uint256 amount, uint256 threshold, bytes32 proofHash, bytes32 borrowerCommit) returns (uint256)',
  'function fundLoan(uint256 loanId, string memory cid) payable',
  'function reportPayment(uint256 loanId, uint256 amount)',
  'function loans(uint256 loanId) view returns (address borrower, address lender, uint256 amount, uint256 threshold, bytes32 proofHash, bytes32 borrowerCommit, string cid, uint8 state, uint256 createdAt, uint256 fundedAt, uint256 totalPaid)',
  'event LoanRequested(uint256 indexed loanId, address indexed borrower, uint256 amount, uint256 threshold, bytes32 proofHash)',
  'event LoanFunded(uint256 indexed loanId, address indexed lender, string cid)',
];

export class EVMService {
  constructor(signer) {
    this.signer = signer;
    this.escrowContract = new ethers.Contract(EVM_ESCROW_CONTRACT, ESCROW_ABI, signer);
  }
  
  // Create loan request
  async createLoanRequest(amount, threshold, proofHash, borrowerCommit) {
    try {
      const tx = await this.escrowContract.createLoanRequest(
        ethers.parseEther(amount.toString()),
        threshold,
        proofHash,
        borrowerCommit
      );
      
      const receipt = await tx.wait();
      
      // Extract loan ID from event
      const event = receipt.logs.find(log => {
        try {
          return this.escrowContract.interface.parseLog(log)?.name === 'LoanRequested';
        } catch {
          return false;
        }
      });
      
      const parsedEvent = this.escrowContract.interface.parseLog(event);
      const loanId = parsedEvent.args.loanId;
      
      return {
        transactionHash: receipt.hash,
        loanId: loanId.toString(),
        success: true,
      };
    } catch (error) {
      console.error('Create loan request error:', error);
      throw error;
    }
  }
  
  // Fund loan
  async fundLoan(loanId, cid, amount) {
    try {
      const tx = await this.escrowContract.fundLoan(loanId, cid, {
        value: ethers.parseEther(amount.toString()),
      });
      
      const receipt = await tx.wait();
      
      return {
        transactionHash: receipt.hash,
        success: true,
      };
    } catch (error) {
      console.error('Fund loan error:', error);
      throw error;
    }
  }
  
  // Report payment
  async reportPayment(loanId, amount) {
    try {
      const tx = await this.escrowContract.reportPayment(
        loanId,
        ethers.parseEther(amount.toString())
      );
      
      const receipt = await tx.wait();
      
      return {
        transactionHash: receipt.hash,
        success: true,
      };
    } catch (error) {
      console.error('Report payment error:', error);
      throw error;
    }
  }
  
  // Get loan details
  async getLoanDetails(loanId) {
    try {
      const loan = await this.escrowContract.loans(loanId);
      
      return {
        borrower: loan.borrower,
        lender: loan.lender,
        amount: ethers.formatEther(loan.amount),
        threshold: loan.threshold.toString(),
        proofHash: loan.proofHash,
        borrowerCommit: loan.borrowerCommit,
        cid: loan.cid,
        state: ['Pending', 'Active', 'Paid', 'Defaulted'][loan.state],
        createdAt: new Date(Number(loan.createdAt) * 1000).toISOString(),
        fundedAt: loan.fundedAt > 0 ? new Date(Number(loan.fundedAt) * 1000).toISOString() : null,
        totalPaid: ethers.formatEther(loan.totalPaid),
      };
    } catch (error) {
      console.error('Get loan details error:', error);
      throw error;
    }
  }
}

export default EVMService;
