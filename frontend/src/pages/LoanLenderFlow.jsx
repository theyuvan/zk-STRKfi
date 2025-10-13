import React, { useState, useEffect } from 'react';
import { connect, disconnect } from 'get-starknet';
import { Contract, RpcProvider, uint256, CallData } from 'starknet';
import StarkNetService from '../services/starknetService';
import { getActivityData } from '../utils/activityScoreCalculator';
import axios from 'axios';
import './LoanLenderFlow.css';

const LENDER_PASSWORD = '12345678';
// ✅ Updated to use new contract addresses from .env
const LOAN_ESCROW_ADDRESS = import.meta.env.VITE_LOAN_ESCROW_ZK_ADDRESS || 
  '0x05a4d3ed7d102ab91715c2b36c70b5e9795a3e917214dbd9af40503d2c29f83d';
const STRK_TOKEN_ADDRESS = import.meta.env.VITE_STRK_TOKEN_ADDRESS || 
  '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';

const LoanLenderFlow = () => {
  // Authentication state
  const [passwordEntered, setPasswordEntered] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Wallet state
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [strkBalance, setStrkBalance] = useState('0');

  // Activity & ZK state
  const [activityData, setActivityData] = useState(null);
  const [zkProofGenerated, setZkProofGenerated] = useState(false);
  const [zkProof, setZkProof] = useState(null);

  // Loan creation state
  const [showCreateLoan, setShowCreateLoan] = useState(false);
  const [loanForm, setLoanForm] = useState({
    loanAmount: '',
    numberOfBorrowers: '',
    interestRate: '',
    repaymentPeriod: ''
  });
  const [creatingLoan, setCreatingLoan] = useState(false);

  // My loans state
  const [myLoans, setMyLoans] = useState([]);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [applications, setApplications] = useState([]);

  const starknetService = new StarkNetService();

  // Step 1: Password Authentication
  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordInput === LENDER_PASSWORD) {
      setPasswordEntered(true);
      setPasswordError('');
    } else {
      setPasswordError('Invalid password. Please try again.');
      setPasswordInput('');
    }
  };

  // Step 2: Connect Wallet
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

      // Fetch balance
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

  // Step 3: Fetch Activity Data
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

  // Step 4: Generate ZK Proof
  const generateZKProof = async () => {
    try {
      console.log('🔐 Generating ZK proof...');
      const response = await axios.post('http://localhost:3000/api/proof/generate', {
        salary: activityData.score,
        threshold: 100 // Minimum score for lenders
      });

      setZkProof(response.data);
      setZkProofGenerated(true);
      console.log('✅ ZK proof generated');
      
      // Load loans
      await loadMyLoans();
    } catch (error) {
      console.error('❌ ZK proof generation failed:', error);
      alert('Failed to generate ZK proof');
    }
  };

  // Create New Loan
  const handleCreateLoan = async (e) => {
    e.preventDefault();
    setCreatingLoan(true);

    try {
      const { loanAmount, numberOfBorrowers, interestRate, repaymentPeriod } = loanForm;
      
      // Validate inputs
      if (!loanAmount || !numberOfBorrowers) {
        alert('Please fill in all required fields');
        setCreatingLoan(false);
        return;
      }

      const totalAmount = parseFloat(loanAmount) * parseInt(numberOfBorrowers);
      const amountPerBorrower = BigInt(Math.floor(parseFloat(loanAmount) * 1e18));
      const totalSlots = parseInt(numberOfBorrowers);
      const interestRateBps = parseInt(interestRate || '500'); // Default 5% = 500 bps
      const repaymentPeriodSeconds = parseInt(repaymentPeriod || '600'); // Default 10 minutes
      const minActivityScore = BigInt(100); // Minimum score required

      console.log('💼 Creating loan offer:', {
        amountPerBorrower: loanAmount + ' STRK',
        totalSlots,
        interestRateBps: interestRateBps / 100 + '%',
        repaymentPeriod: repaymentPeriodSeconds + 's',
        minActivityScore: minActivityScore.toString(),
        totalAmount: totalAmount + ' STRK'
      });

      // Get connected wallet
      const starknet = await connect();
      if (!starknet || !starknet.account) {
        throw new Error('Wallet not connected');
      }

      const provider = new RpcProvider({ 
        nodeUrl: import.meta.env.VITE_STARKNET_RPC || 'https://starknet-sepolia.public.blastapi.io'
      });

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

      // Loan Escrow ZK ABI for create_loan_offer
      const loanEscrowAbi = [
        {
          name: 'create_loan_offer',
          type: 'function',
          inputs: [
            { name: 'amount_per_borrower', type: 'u256' },
            { name: 'total_slots', type: 'u8' },
            { name: 'interest_rate_bps', type: 'u16' },
            { name: 'repayment_period', type: 'u64' },
            { name: 'min_activity_score', type: 'u256' }
          ],
          outputs: [{ name: 'loan_id', type: 'u256' }],
          stateMutability: 'external'
        }
      ];

      // STEP 1: Approve STRK spending
      console.log('📝 Step 1/2: Approving STRK spending...');
      const strkContract = new Contract(
        erc20Abi,
        STRK_TOKEN_ADDRESS,
        starknet.account
      );

      const approveAmount = BigInt(Math.floor(totalAmount * 1e18));
      const approveUint256 = uint256.bnToUint256(approveAmount);
      
      console.log('💰 Approve amount:', totalAmount, 'STRK =', approveAmount.toString(), 'wei');
      console.log('💰 Uint256 format:', approveUint256);
      
      // Use CallData.compile to properly format Uint256
      const approveCalldata = CallData.compile({
        spender: LOAN_ESCROW_ADDRESS,
        amount: approveUint256
      });
      
      const approveTx = await strkContract.invoke('approve', approveCalldata);
      
      console.log('⏳ Waiting for approval tx:', approveTx.transaction_hash);
      await provider.waitForTransaction(approveTx.transaction_hash);
      console.log('✅ Approval confirmed');

      // STEP 2: Create loan offer on blockchain
      console.log('📜 Step 2/2: Creating loan offer on blockchain...');
      const loanEscrowContract = new Contract(
        loanEscrowAbi,
        LOAN_ESCROW_ADDRESS,
        starknet.account
      );

      const amountUint256 = uint256.bnToUint256(amountPerBorrower);
      const interestRateUint256 = uint256.bnToUint256(BigInt(interestRateBps));
      const minScoreUint256 = uint256.bnToUint256(minActivityScore);

      console.log('📊 Loan parameters:', {
        amount_per_borrower: amountUint256,
        total_slots: totalSlots,
        interest_rate_bps: interestRateUint256,
        repayment_period: repaymentPeriodSeconds.toString(),
        min_activity_score: minScoreUint256
      });

      // Use CallData.compile to properly format all parameters
      const createLoanCalldata = CallData.compile({
        amount_per_borrower: amountUint256,
        total_slots: totalSlots.toString(),
        interest_rate_bps: interestRateUint256,
        repayment_period: repaymentPeriodSeconds.toString(),
        min_activity_score: minScoreUint256
      });

      const createLoanTx = await loanEscrowContract.invoke('create_loan_offer', createLoanCalldata);

      console.log('⏳ Waiting for loan creation tx:', createLoanTx.transaction_hash);
      const receipt = await provider.waitForTransaction(createLoanTx.transaction_hash);
      console.log('✅ Loan offer created on blockchain!', receipt);

      // Reset form
      setLoanForm({
        loanAmount: '',
        numberOfBorrowers: '',
        interestRate: '',
        repaymentPeriod: ''
      });
      setShowCreateLoan(false);

      // Reload loans
      await loadMyLoans();
      await fetchBalance(walletAddress);

      alert('✅ Loan offer created successfully on blockchain!\nTransaction: ' + createLoanTx.transaction_hash);
    } catch (error) {
      console.error('❌ Loan creation failed:', error);
      alert('Failed to create loan: ' + (error.message || error));
    } finally {
      setCreatingLoan(false);
    }
  };

  // Load lender's loans
  const loadMyLoans = async () => {
    try {
      console.log('📋 Loading my loans...');
      const response = await axios.get(`http://localhost:3000/api/loan/lender/${walletAddress}`);
      setMyLoans(response.data.loans || []);
      console.log('✅ Loaded loans:', response.data.loans?.length || 0);
    } catch (error) {
      console.error('❌ Failed to load loans:', error);
      setMyLoans([]);
    }
  };

  // Load applications for a loan
  const loadApplications = async (loanId) => {
    try {
      console.log('📬 Loading applications for loan:', loanId);
      const response = await axios.get(`http://localhost:3000/api/loan/${loanId}/applications`);
      setApplications(response.data.applications || []);
      setSelectedLoan(loanId);
    } catch (error) {
      console.error('❌ Failed to load applications:', error);
      setApplications([]);
    }
  };

  // Approve borrower
  const approveBorrower = async (loanId, borrowerCommitment) => {
    try {
      console.log('✅ Approving borrower for loan:', loanId);
      console.log('📝 Borrower commitment:', borrowerCommitment);
      
      // For now, just update via backend API
      // TODO: Integrate with smart contract later
      const response = await axios.post('http://localhost:3000/api/loan/approve-borrower', {
        loanId,
        borrowerCommitment,
        lenderAddress: walletAddress
      });

      console.log('✅ Borrower approved:', response.data);
      
      // Reload applications
      await loadApplications(loanId);
      await loadMyLoans();

      alert('✅ Borrower approved! Loan activated.');
    } catch (error) {
      console.error('❌ Approval failed:', error);
      alert('Failed to approve borrower: ' + (error.response?.data?.error || error.message));
    }
  };

  // Auto-fetch activity when wallet connected
  useEffect(() => {
    if (walletConnected && walletAddress && !activityData) {
      fetchActivityData();
    }
  }, [walletConnected, walletAddress]);

  // Render: Password Gate
  if (!passwordEntered) {
    return (
      <div className="lender-flow">
        <div className="password-gate">
          <div className="password-card">
            <h1>🏦 Loan Lender Portal</h1>
            <p className="subtitle">Secured access for loan providers</p>
            
            <form onSubmit={handlePasswordSubmit}>
              <div className="form-group">
                <label>Enter Access Password</label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter password"
                  className="password-input"
                  autoFocus
                />
              </div>
              
              {passwordError && (
                <div className="error-message">
                  ❌ {passwordError}
                </div>
              )}
              
              <button type="submit" className="btn-primary">
                🔓 Unlock Portal
              </button>
            </form>
            
            <div className="info-box">
              <p>💡 This portal is restricted to authorized loan providers</p>
              <p>🔒 All lender identities are protected with zero-knowledge proofs</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render: Wallet Connection
  if (!walletConnected) {
    return (
      <div className="lender-flow">
        <div className="connect-wallet-section">
          <h1>🔌 Connect Your Wallet</h1>
          <p>Connect your StarkNet wallet to access the lender dashboard</p>
          <button onClick={handleConnectWallet} className="btn-primary btn-large">
            Connect StarkNet Wallet
          </button>
        </div>
      </div>
    );
  }

  // Render: Activity Fetch
  if (!activityData) {
    return (
      <div className="lender-flow">
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
      <div className="lender-flow">
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
            <p>✨ Borrowers will only see your salted commitment hash</p>
          </div>
        </div>
      </div>
    );
  }

  // Render: Main Dashboard
  return (
    <div className="lender-flow">
      <div className="dashboard">
        {/* Header */}
        <div className="dashboard-header">
          <div>
            <h1>🏦 Lender Dashboard</h1>
            <p className="wallet-info">
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)} | 
              💰 {strkBalance} STRK
            </p>
          </div>
          <button 
            onClick={() => setShowCreateLoan(true)} 
            className="btn-primary"
          >
            ➕ Create New Loan
          </button>
        </div>

        {/* Create Loan Modal */}
        {showCreateLoan && (
          <div className="modal-overlay" onClick={() => setShowCreateLoan(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>➕ Create New Loan</h2>
              <form onSubmit={handleCreateLoan}>
                <div className="form-group">
                  <label>Loan Amount (STRK per borrower)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={loanForm.loanAmount}
                    onChange={(e) => setLoanForm({...loanForm, loanAmount: e.target.value})}
                    placeholder="e.g., 50"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Number of Borrowers</label>
                  <input
                    type="number"
                    min="1"
                    value={loanForm.numberOfBorrowers}
                    onChange={(e) => setLoanForm({...loanForm, numberOfBorrowers: e.target.value})}
                    placeholder="e.g., 2"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Interest Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={loanForm.interestRate}
                    onChange={(e) => setLoanForm({...loanForm, interestRate: e.target.value})}
                    placeholder="e.g., 5"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Repayment Period (seconds)</label>
                  <input
                    type="number"
                    value={loanForm.repaymentPeriod}
                    onChange={(e) => setLoanForm({...loanForm, repaymentPeriod: e.target.value})}
                    placeholder="e.g., 600"
                    required
                  />
                </div>

                {loanForm.loanAmount && loanForm.numberOfBorrowers && (
                  <div className="info-box">
                    <p>💰 Total STRK to deposit: <strong>{
                      (parseFloat(loanForm.loanAmount) * parseInt(loanForm.numberOfBorrowers)).toFixed(2)
                    } STRK</strong></p>
                    <p>📦 This amount will be sent to escrow contract</p>
                  </div>
                )}

                <div className="modal-actions">
                  <button 
                    type="button" 
                    onClick={() => setShowCreateLoan(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn-primary"
                    disabled={creatingLoan}
                  >
                    {creatingLoan ? '⏳ Creating...' : '✅ Create Loan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* My Loans */}
        <div className="loans-section">
          <h2>📋 My Loans ({myLoans.length})</h2>
          
          {myLoans.length === 0 ? (
            <div className="empty-state">
              <p>📭 No loans created yet</p>
              <p>Click "Create New Loan" to start lending</p>
            </div>
          ) : (
            <div className="loans-grid">
              {myLoans.map((loan, idx) => (
                <div key={idx} className="loan-card">
                  <div className="loan-header">
                    <h3>Loan #{loan.id}</h3>
                    <span className={`status-badge ${loan.status}`}>
                      {loan.status}
                    </span>
                  </div>
                  
                  <div className="loan-details">
                    <div className="detail-row">
                      <span>💰 Amount:</span>
                      <strong>{loan.amount} STRK</strong>
                    </div>
                    <div className="detail-row">
                      <span>👥 Borrowers:</span>
                      <strong>{loan.approvedCount}/{loan.maxBorrowers}</strong>
                    </div>
                    <div className="detail-row">
                      <span>📈 Interest:</span>
                      <strong>{loan.interestRate}%</strong>
                    </div>
                    <div className="detail-row">
                      <span>📬 Applications:</span>
                      <strong>{loan.applicationCount || 0}</strong>
                    </div>
                  </div>

                  <button 
                    onClick={() => loadApplications(loan.id)}
                    className="btn-secondary btn-block"
                  >
                    👀 View Applications
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Applications View */}
        {selectedLoan && (
          <div className="applications-section">
            <h2>📬 Applications for Loan #{selectedLoan}</h2>
            
            {applications.length === 0 ? (
              <p className="empty-state">No applications yet</p>
            ) : (
              <div className="applications-list">
                {applications.map((app, idx) => (
                  <div key={idx} className="application-card">
                    <div className="app-header">
                      <span className="commitment-hash">
                        🔒 {app.borrowerCommitment.slice(0, 10)}...{app.borrowerCommitment.slice(-8)}
                      </span>
                      <span className={`status-badge ${app.status}`}>
                        {app.status}
                      </span>
                    </div>
                    
                    <div className="app-details">
                      <p>📊 Activity Score: <strong>{app.activityScore || 'Verified ✅'}</strong></p>
                      <p>📅 Applied: {new Date(app.timestamp).toLocaleString()}</p>
                    </div>

                    {app.status === 'pending' && (
                      <button
                        onClick={() => approveBorrower(selectedLoan, app.borrowerCommitment)}
                        className="btn-primary btn-block"
                      >
                        ✅ Approve & Release Funds
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LoanLenderFlow;
