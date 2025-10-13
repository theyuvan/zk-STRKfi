import React, { useState, useEffect } from 'react';
import { connect, disconnect } from 'get-starknet';
import { Contract, RpcProvider, uint256, CallData } from 'starknet';
import StarkNetService from '../services/starknetService';
import { getActivityData } from '../utils/activityScoreCalculator';
import axios from 'axios';
import './LoanBorrowerFlowNew.css';

// ✅ Updated to use new contract addresses from .env
const LOAN_ESCROW_ADDRESS = import.meta.env.VITE_LOAN_ESCROW_ZK_ADDRESS || 
  '0x05a4d3ed7d102ab91715c2b36c70b5e9795a3e917214dbd9af40503d2c29f83d';
const STRK_TOKEN_ADDRESS = import.meta.env.VITE_STRK_TOKEN_ADDRESS || 
  '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';

const LoanBorrowerFlow = () => {
  // Wallet state
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [strkBalance, setStrkBalance] = useState('0');

  // Activity & ZK state
  const [activityData, setActivityData] = useState(null);
  const [zkProofGenerated, setZkProofGenerated] = useState(false);
  const [zkProof, setZkProof] = useState(null);

  // Loans state
  const [availableLoans, setAvailableLoans] = useState([]);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [myApplications, setMyApplications] = useState([]);
  const [myActiveLoans, setMyActiveLoans] = useState([]);

  const starknetService = new StarkNetService();

  // Step 1: Connect Wallet
  const handleConnectWallet = async () => {
    try {
      console.log('🔌 Connecting wallet...');
      const starknet = await connect();
      
      if (!starknet || !starknet.isConnected) {
        throw new Error('Failed to connect wallet');
      }

      await starknet.enable();
      const address = starknet.selectedAddress;
      
      setWalletAddress(address);
      setWalletConnected(true);
      console.log('✅ Wallet connected:', address);

      // Auto-fetch activity
      await fetchBalance(address);
    } catch (error) {
      console.error('❌ Wallet connection failed:', error);
      alert('Failed to connect wallet. Please try again.');
    }
  };

  const fetchBalance = async (address) => {
    try {
      const result = await starknetService.fetchStrkBalance(address);
      setStrkBalance(result.formatted);
      console.log('💰 STRK Balance:', result.formatted);
    } catch (error) {
      console.error('❌ Failed to fetch balance:', error);
      setStrkBalance('0');
    }
  };

  // Step 2: Fetch Activity Data
  const fetchActivityData = async () => {
    try {
      console.log('📊 Fetching activity data...');
      const activity = await getActivityData(walletAddress);
      setActivityData(activity);
      console.log('✅ Activity data:', activity);
    } catch (error) {
      console.error('❌ Activity fetch failed:', error);
      alert('Failed to fetch activity data');
    }
  };

  // Step 3: Generate ZK Proof
  const generateZKProof = async () => {
    try {
      console.log('🔐 Generating ZK proof for score:', activityData.score);
      const response = await axios.post('http://localhost:3000/api/proof/generate', {
        salary: activityData.score,
        threshold: 100
      });

      // Map backend response to expected format
      const zkProofData = {
        ...response.data,
        commitmentHash: response.data.commitment // Map commitment to commitmentHash for consistency
      };

      setZkProof(zkProofData);
      setZkProofGenerated(true);
      console.log('✅ ZK proof generated:', zkProofData);
      
      // Load available loans
      await loadAvailableLoans();
      await loadMyApplications();
    } catch (error) {
      console.error('❌ ZK proof generation failed:', error);
      alert('Failed to generate ZK proof: ' + error.message);
    }
  };

  // Load Available Loans
  const loadAvailableLoans = async () => {
    try {
      console.log('📋 Loading available loans...');
      const response = await axios.get('http://localhost:3000/api/loan/available');
      setAvailableLoans(response.data.loans || []);
      console.log('✅ Loaded loans:', response.data.loans?.length || 0);
    } catch (error) {
      console.error('❌ Failed to load loans:', error);
      setAvailableLoans([]);
    }
  };

  // Load My Applications
  const loadMyApplications = async () => {
    try {
      if (!zkProof || !zkProof.commitmentHash) {
        console.log('⏭️ Skipping applications - no ZK proof yet');
        return;
      }
      console.log('📬 Loading my applications...');
      const response = await axios.get(`http://localhost:3000/api/loan/borrower/${zkProof.commitmentHash}/applications`);
      setMyApplications(response.data.applications || []);
      console.log('✅ My applications:', response.data.applications?.length || 0);
    } catch (error) {
      console.error('❌ Failed to load applications:', error);
      setMyApplications([]);
    }
  };

  // Load My Active Loans
  const loadMyActiveLoans = async () => {
    try {
      if (!zkProof || !zkProof.commitmentHash) {
        console.log('⏭️ Skipping active loans - no ZK proof yet');
        return;
      }
      console.log('💼 Loading my active loans...');
      const response = await axios.get(`http://localhost:3000/api/loan/borrower/${zkProof.commitmentHash}/active`);
      setMyActiveLoans(response.data.loans || []);
      console.log('✅ My active loans:', response.data.loans?.length || 0);
    } catch (error) {
      console.error('❌ Failed to load active loans:', error);
      setMyActiveLoans([]);
    }
  };

  // Apply for Loan
  const applyForLoan = async (loan) => {
    try {
      console.log('📝 Applying for loan:', loan.loanId || loan.id);
      console.log('📦 Loan object:', loan);
      console.log('📦 ZK Proof:', zkProof);
      
      const response = await axios.post('http://localhost:3000/api/loan/apply', {
        loanId: loan.loanId || loan.id,
        borrowerCommitment: zkProof.commitmentHash,
        proofHash: zkProof.proofHash,
        activityScore: activityData.score
      });

      console.log('✅ Application submitted:', response.data);
      alert('✅ Application submitted successfully!');
      
      // Reload data
      await loadMyApplications();
      setSelectedLoan(null);
    } catch (error) {
      console.error('❌ Application failed:', error);
      console.error('❌ Error response:', error.response?.data);
      alert('Failed to apply for loan: ' + (error.response?.data?.error || error.message));
    }
  };

  // Repay Loan
  const repayLoan = async (loan) => {
    try {
      console.log('💸 Repaying loan:', loan.id);
      
      const starknet = await connect();
      const provider = new RpcProvider({ 
        nodeUrl: import.meta.env.VITE_STARKNET_RPC 
      });

      // Calculate repayment amount
      const repaymentAmount = parseFloat(loan.amount) * (1 + parseFloat(loan.interestRate) / 100);
      const repaymentWei = BigInt(Math.floor(repaymentAmount * 1e18));

      // ERC20 ABI for approve function
      const erc20Abi = [
        {
          name: 'approve',
          type: 'function',
          inputs: [
            { name: 'spender', type: 'felt' },
            { name: 'amount', type: 'Uint256' }
          ],
          outputs: [{ name: 'success', type: 'felt' }],
          stateMutability: 'external'
        }
      ];

      // 1. Approve STRK
      console.log('📝 Approving STRK...');
      const strkContract = new Contract(
        erc20Abi,
        STRK_TOKEN_ADDRESS,
        starknet.account
      );
      
      console.log('💰 Repayment amount:', repaymentAmount, 'STRK =', repaymentWei.toString(), 'wei');

      // Convert to Uint256 format and use CallData.compile
      const amountUint256 = uint256.bnToUint256(repaymentWei);
      console.log('💰 Uint256 format:', amountUint256);

      const approveCalldata = CallData.compile({
        spender: LOAN_ESCROW_ADDRESS,
        amount: amountUint256
      });

      const approveTx = await strkContract.invoke('approve', approveCalldata);
      
      console.log('⏳ Waiting for approval tx:', approveTx.transaction_hash);
      await provider.waitForTransaction(approveTx.transaction_hash);
      console.log('✅ Approval confirmed');

      // 2. Repay loan via backend
      console.log('💰 Repaying loan via API...');
      const response = await axios.post('http://localhost:3000/api/loan/repay', {
        loanId: loan.id || loan.loanId,
        borrowerAddress: walletAddress,
        borrowerCommitment: zkProof?.commitmentHash
      });

      console.log('✅ Loan repayment recorded:', response.data);

      alert('✅ Loan repaid successfully!');
      
      // Reload data
      await loadMyActiveLoans();
      await fetchBalance(walletAddress);
    } catch (error) {
      console.error('❌ Repayment failed:', error);
      alert('Failed to repay loan: ' + error.message);
    }
  };

  // Auto-fetch activity when wallet connected
  useEffect(() => {
    if (walletConnected && walletAddress && !activityData) {
      fetchActivityData();
    }
  }, [walletConnected, walletAddress]);

  // Auto-refresh loans every 30 seconds
  useEffect(() => {
    if (zkProofGenerated) {
      const interval = setInterval(() => {
        loadAvailableLoans();
        loadMyApplications();
        loadMyActiveLoans();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [zkProofGenerated]);

  // Render: Wallet Connection
  if (!walletConnected) {
    return (
      <div className="borrower-flow">
        <div className="connect-wallet-section">
          <h1>🔌 Connect Your Wallet</h1>
          <p>Connect your StarkNet wallet to start borrowing</p>
          <button onClick={handleConnectWallet} className="btn-primary btn-large">
            Connect StarkNet Wallet
          </button>
          
          <div className="info-box">
            <p>✨ Your identity is protected with zero-knowledge proofs</p>
            <p>🔒 Lenders only see your salted commitment hash</p>
            <p>💰 Get instant STRK loans based on your activity</p>
          </div>
        </div>
      </div>
    );
  }

  // Render: Activity Fetch
  if (!activityData) {
    return (
      <div className="borrower-flow">
        <div className="loading-section">
          <div className="spinner"></div>
          <h2>📊 Fetching Activity Data...</h2>
          <p>Analyzing your wallet activity</p>
          <p className="wallet-address">Wallet: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</p>
        </div>
      </div>
    );
  }

  // Render: ZK Verification
  if (!zkProofGenerated) {
    return (
      <div className="borrower-flow">
        <div className="zk-section">
          <h1>🔐 Zero-Knowledge Verification</h1>
          <div className="activity-summary">
            <h3>Your Activity Summary</h3>
            <div className="stat-grid">
              <div className="stat-card">
                <span className="stat-label">Balance</span>
                <span className="stat-value">{activityData.balance} STRK</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Transactions</span>
                <span className="stat-value">{activityData.txCount}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Activity Score</span>
                <span className="stat-value">{activityData.score}</span>
              </div>
            </div>
          </div>
          
          <button onClick={generateZKProof} className="btn-primary btn-large">
            🔐 Generate ZK Proof & Enter Dashboard
          </button>
          
          <div className="info-box">
            <p>🛡️ Your identity will remain private</p>
            <p>✨ Lenders will only see your commitment hash</p>
          </div>
        </div>
      </div>
    );
  }

  // Render: Main Dashboard
  return (
    <div className="borrower-flow">
      <div className="dashboard">
        {/* Header */}
        <div className="dashboard-header">
          <div>
            <h1>💼 Borrower Dashboard</h1>
            <p className="wallet-info">
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)} | 
              💰 {strkBalance} STRK | 
              📊 Score: {activityData.score}
            </p>
            <p className="commitment-hash">
              🔒 Your Commitment: {zkProof?.commitmentHash ? `${zkProof.commitmentHash.slice(0, 10)}...${zkProof.commitmentHash.slice(-8)}` : 'Not generated'}
            </p>
          </div>
          <button onClick={() => {
            loadAvailableLoans();
            loadMyApplications();
            loadMyActiveLoans();
          }} className="btn-secondary">
            🔄 Refresh
          </button>
        </div>

        {/* My Active Loans */}
        {myActiveLoans.length > 0 && (
          <div className="loans-section urgent">
            <h2>⚠️ Your Active Loans ({myActiveLoans.length})</h2>
            <div className="loans-grid">
              {myActiveLoans.map((loan, idx) => (
                <div key={idx} className="loan-card active-loan">
                  <div className="loan-header">
                    <h3>Loan #{loan.id}</h3>
                    <span className="status-badge active">ACTIVE</span>
                  </div>
                  
                  <div className="loan-details">
                    <div className="detail-row">
                      <span>💰 Borrowed:</span>
                      <strong>{loan.amount} STRK</strong>
                    </div>
                    <div className="detail-row">
                      <span>💸 Repayment:</span>
                      <strong>{(parseFloat(loan.amount) * (1 + parseFloat(loan.interestRate) / 100)).toFixed(2)} STRK</strong>
                    </div>
                    <div className="detail-row">
                      <span>⏰ Deadline:</span>
                      <strong className="deadline">{loan.deadline}</strong>
                    </div>
                    <div className="detail-row">
                      <span>📈 Interest:</span>
                      <strong>{loan.interestRate}%</strong>
                    </div>
                  </div>

                  <button 
                    onClick={() => repayLoan(loan)}
                    className="btn-primary btn-block"
                  >
                    💸 Repay Now
                  </button>
                  
                  <div className="warning-box">
                    <p>⚠️ Repay before deadline or your identity will be revealed!</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My Applications */}
        {myApplications.length > 0 && (
          <div className="loans-section">
            <h2>📬 My Applications ({myApplications.length})</h2>
            <div className="applications-list">
              {myApplications.map((app, idx) => (
                <div key={idx} className="application-card">
                  <div className="app-header">
                    <span>Loan #{app.loanId}</span>
                    <span className={`status-badge ${app.status}`}>
                      {app.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="app-details">
                    <p>💰 Amount: <strong>{app.amount} STRK</strong></p>
                    <p>📈 Interest: <strong>{app.interestRate}%</strong></p>
                    <p>📅 Applied: {new Date(app.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available Loans */}
        <div className="loans-section">
          <h2>🏦 Available Loans ({availableLoans.length})</h2>
          
          {availableLoans.length === 0 ? (
            <div className="empty-state">
              <p>📭 No loans available at the moment</p>
              <p>Check back soon or refresh the page</p>
            </div>
          ) : (
            <div className="loans-grid">
              {availableLoans.map((loan, idx) => (
                <div key={idx} className="loan-card">
                  <div className="loan-header">
                    <h3>🏦 {loan.lenderName || 'Anonymous Lender'}</h3>
                    <span className="status-badge funded">AVAILABLE</span>
                  </div>
                  
                  <div className="loan-details">
                    <div className="detail-row">
                      <span>💰 Amount:</span>
                      <strong>{loan.amount} STRK</strong>
                    </div>
                    <div className="detail-row">
                      <span>📈 Interest:</span>
                      <strong>{loan.interestRate}%</strong>
                    </div>
                    <div className="detail-row">
                      <span>⏰ Repayment Period:</span>
                      <strong>{loan.repaymentPeriod} seconds</strong>
                    </div>
                    <div className="detail-row">
                      <span>👥 Slots Available:</span>
                      <strong>{loan.slotsRemaining}/{loan.totalSlots}</strong>
                    </div>
                    <div className="detail-row">
                      <span>📬 Applications:</span>
                      <strong>{loan.applicationCount || 0}</strong>
                    </div>
                  </div>

                  <div className="repayment-calc">
                    <p>💸 You'll repay: <strong>{
                      (parseFloat(loan.amount) * (1 + parseFloat(loan.interestRate) / 100)).toFixed(2)
                    } STRK</strong></p>
                  </div>

                  <button 
                    onClick={() => setSelectedLoan(loan)}
                    className="btn-primary btn-block"
                    disabled={loan.slotsRemaining === 0}
                  >
                    {loan.slotsRemaining === 0 ? '❌ No Slots Available' : '📝 Apply for Loan'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Loan Application Modal */}
        {selectedLoan && (
          <div className="modal-overlay" onClick={() => setSelectedLoan(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>📝 Apply for Loan</h2>
              
              <div className="loan-summary">
                <h3>Loan Details</h3>
                <div className="detail-row">
                  <span>💰 Loan Amount:</span>
                  <strong>{selectedLoan.amount} STRK</strong>
                </div>
                <div className="detail-row">
                  <span>📈 Interest Rate:</span>
                  <strong>{selectedLoan.interestRate}%</strong>
                </div>
                <div className="detail-row">
                  <span>💸 Repayment Amount:</span>
                  <strong>{
                    (parseFloat(selectedLoan.amount) * (1 + parseFloat(selectedLoan.interestRate) / 100)).toFixed(2)
                  } STRK</strong>
                </div>
                <div className="detail-row">
                  <span>⏰ Repayment Period:</span>
                  <strong>{selectedLoan.repaymentPeriod} seconds</strong>
                </div>
              </div>

              <div className="warning-box">
                <p>⚠️ <strong>Important:</strong> If you fail to repay within the deadline, your wallet address will be revealed to the lender!</p>
                <p>🔒 Your activity score ({activityData.score}) has been verified with zero-knowledge proof</p>
              </div>

              <div className="modal-actions">
                <button 
                  onClick={() => setSelectedLoan(null)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => applyForLoan(selectedLoan)}
                  className="btn-primary"
                >
                  ✅ Confirm Application
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoanBorrowerFlow;
