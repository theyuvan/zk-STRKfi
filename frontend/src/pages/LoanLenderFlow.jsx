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
  '0x06b058a0946bb36fa846e6a954da885fa20809f43a9e47038dc83b4041f7f012';
const STRK_TOKEN_ADDRESS = import.meta.env.VITE_STRK_TOKEN_ADDRESS || 
  '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';

// ⏰ Countdown Timer Component (reused from borrower)
const RepaymentCountdown = ({ deadline }) => {
  const [timeRemaining, setTimeRemaining] = useState(null);

  const calculateTimeRemaining = (deadlineISO) => {
    const now = Date.now();
    const deadlineMs = new Date(deadlineISO).getTime();
    const remaining = deadlineMs - now;

    if (remaining <= 0) {
      const overdueDuration = Math.abs(remaining);
      const days = Math.floor(overdueDuration / (1000 * 60 * 60 * 24));
      const hours = Math.floor((overdueDuration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      return {
        expired: true,
        text: `⚠️ OVERDUE: ${days}d ${hours}h past deadline`,
        class: 'countdown-expired'
      };
    }

    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    let urgencyClass = 'countdown-safe';
    if (days === 0 && hours < 6) {
      urgencyClass = 'countdown-critical';
    } else if (days < 2) {
      urgencyClass = 'countdown-warning';
    }

    return {
      expired: false,
      text: `⏳ ${days}d ${hours}h ${minutes}m remaining`,
      class: urgencyClass,
      days,
      hours,
      minutes
    };
  };

  useEffect(() => {
    // Initial calculation
    setTimeRemaining(calculateTimeRemaining(deadline));

    // Update every minute
    const timer = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining(deadline));
    }, 60000);

    return () => clearInterval(timer);
  }, [deadline]);

  if (!timeRemaining) return null;

  return (
    <div className={`countdown-timer ${timeRemaining.class}`}>
      <div className="countdown-text">{timeRemaining.text}</div>
      {!timeRemaining.expired && (
        <div className="countdown-details">
          <small>Deadline: {new Date(deadline).toLocaleString()}</small>
        </div>
      )}
    </div>
  );
};

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
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'approved', 'repaid'

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
      console.log('Generating ZK proof for lender...');
      
      // Get connected wallet
      const starknet = await connect();
      if (!starknet || !starknet.account) {
        throw new Error('Wallet not connected');
      }
      
      const walletAddress = starknet.account.address;
      console.log('Using wallet address:', walletAddress);
      
      const response = await axios.post('http://localhost:3000/api/proof/generate', {
        salary: activityData.score,
        threshold: 100, // Minimum score for lenders
        walletAddress: walletAddress
      });

      setZkProof(response.data);
      setZkProofGenerated(true);
      console.log('ZK proof generated:', response.data);
      
      // Load loans
      await loadMyLoans();
    } catch (error) {
      console.error('ZK proof generation failed:', error);
      alert('Failed to generate ZK proof: ' + error.message);
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
      console.log('🔌 Connecting to wallet...');
      const starknet = await connect();
      console.log('✅ Wallet connected:', starknet?.account?.address);
      
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
      const loans = response.data.loans || [];
      console.log('✅ Loaded loans:', loans.length);
      console.log('📦 Loan details:', loans);
      setMyLoans(loans);
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

  // Approve borrower - ON-CHAIN IMPLEMENTATION
  const approveBorrower = async (loanId, borrowerCommitment) => {
    try {
      console.log('👍 Approving borrower for loan:', loanId);
      console.log('📝 Borrower commitment:', borrowerCommitment);
      
      // Get connected wallet
      const starknet = await connect();
      if (!starknet || !starknet.account) {
        throw new Error('Wallet not connected');
      }

      const provider = new RpcProvider({ 
        nodeUrl: import.meta.env.VITE_STARKNET_RPC || 'https://starknet-sepolia.public.blastapi.io'
      });

      // Loan Escrow ZK ABI for approve_borrower
      const loanEscrowAbi = [
        {
          name: 'approve_borrower',
          type: 'function',
          inputs: [
            { name: 'loan_id', type: 'u256' },
            { name: 'borrower_commitment', type: 'felt252' }
          ],
          outputs: [],
          stateMutability: 'external'
        }
      ];

      const loanEscrowContract = new Contract(
        loanEscrowAbi,
        LOAN_ESCROW_ADDRESS,
        starknet.account
      );

      // Convert loan_id to u256
      const loanIdU256 = uint256.bnToUint256(BigInt(loanId));

      console.log('📊 Approval parameters:', {
        loan_id: loanIdU256,
        borrower_commitment: borrowerCommitment
      });

      // Call approve_borrower on-chain
      const approvalCalldata = CallData.compile({
        loan_id: loanIdU256,
        borrower_commitment: borrowerCommitment
      });

      const approveTx = await loanEscrowContract.invoke('approve_borrower', approvalCalldata);
      
      console.log('⏳ Waiting for approval tx:', approveTx.transaction_hash);
      const receipt = await provider.waitForTransaction(approveTx.transaction_hash);
      console.log('✅ Borrower approved on blockchain!', receipt);

      // Reload data
      await loadMyLoans();
      await loadApplications(selectedLoan);

      alert('✅ Borrower approved! STRK transferred to borrower.\nTransaction: ' + approveTx.transaction_hash);
    } catch (error) {
      console.error('❌ Approval failed:', error);
      alert('Failed to approve borrower: ' + (error.message || error));
    }
  };

  // Reveal borrower identity (for overdue loans)
  const revealBorrowerIdentity = async (loanId, borrowerCommitment) => {
    try {
      console.log('🔓 Revealing borrower identity for overdue loan:', loanId);
      
      // Get connected wallet
      const starknet = await connect();
      if (!starknet || !starknet.account) {
        throw new Error('Wallet not connected');
      }

      const provider = new RpcProvider({ 
        nodeUrl: import.meta.env.VITE_STARKNET_RPC || 'https://starknet-sepolia.public.blastapi.io'
      });

      const LOAN_ESCROW_ADDRESS = import.meta.env.VITE_LOAN_ESCROW_ZK_ADDRESS || 
        '0x06b058a0946bb36fa846e6a954da885fa20809f43a9e47038dc83b4041f7f012';

      // First, check the application status from backend to confirm it's overdue
      const appResponse = await axios.get(
        `http://localhost:3000/api/loan/application/${loanId}/${borrowerCommitment}`
      );
      
      const app = appResponse.data;
      if (!app) {
        throw new Error('Application not found');
      }

      if (app.status !== 'approved') {
        throw new Error('Loan must be approved to reveal identity');
      }

      const deadline = new Date(app.repaymentDeadline);
      const now = new Date();
      
      if (now <= deadline) {
        throw new Error('Loan is not overdue yet. Cannot reveal identity.');
      }

      const daysOverdue = Math.floor((now - deadline) / (1000 * 60 * 60 * 24));

      // Convert loan_id to u256
      const loanIdU256 = uint256.bnToUint256(BigInt(loanId));

      // Clean and convert commitment to felt252
      const cleanHex = (hexStr) => {
        if (!hexStr) return '0';
        const cleaned = hexStr.startsWith?.('0x') ? hexStr.slice(2) : hexStr;
        return cleaned.slice(0, 63); // Truncate to 63 chars (252 bits)
      };

      const commitmentHex = cleanHex(borrowerCommitment);
      let commitmentNum = BigInt('0x' + commitmentHex);
      
      // Mask to fit in felt252
      const FELT252_MAX = (BigInt(2) ** BigInt(251)) - BigInt(1);
      if (commitmentNum > FELT252_MAX) {
        commitmentNum = commitmentNum & FELT252_MAX;
      }

      console.log('🔓 Calling reveal_borrower_identity on contract...');
      console.log('  Loan ID:', loanId);
      console.log('  Commitment:', borrowerCommitment);
      console.log('  Days Overdue:', daysOverdue);

      // Call reveal_borrower_identity on-chain
      const revealTx = await starknet.account.execute({
        contractAddress: LOAN_ESCROW_ADDRESS,
        entrypoint: 'reveal_borrower_identity',
        calldata: [
          loanIdU256.low.toString(),
          loanIdU256.high.toString(),
          commitmentNum.toString()
        ]
      });
      
      console.log('⏳ Waiting for reveal tx:', revealTx.transaction_hash);
      await provider.waitForTransaction(revealTx.transaction_hash);
      console.log('✅ Identity revealed on blockchain!');

      // Get the revealed identity from the backend (which reads from contract)
      const revealResponse = await axios.get(
        `http://localhost:3000/api/loan/${loanId}/reveal/${borrowerCommitment}`
      );
      
      const borrowerAddress = revealResponse.data.borrower || app.borrower || 'Unknown';

      alert(
        `🔓 Borrower Identity Revealed!\n\n` +
        `Wallet Address: ${borrowerAddress}\n` +
        `Loan ID: ${loanId}\n` +
        `Overdue by: ${daysOverdue} days\n` +
        `Transaction: ${revealTx.transaction_hash.slice(0, 10)}...\n\n` +
        `⚠️ The borrower failed to repay within the deadline.\n` +
        `✅ Identity revealed on-chain via smart contract.`
      );

      // Reload applications to update UI
      await loadApplications(loanId);
      
    } catch (error) {
      console.error('❌ Failed to reveal identity:', error);
      alert('Failed to reveal borrower identity: ' + (error.message || error));
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
                      <span>💰 Amount per Borrower:</span>
                      <strong>{(parseFloat(loan.amountPerBorrower) / 1e18).toFixed(2)} STRK</strong>
                    </div>
                    <div className="detail-row">
                      <span>👥 Slots:</span>
                      <strong>{loan.filledSlots}/{loan.totalSlots}</strong>
                    </div>
                    <div className="detail-row">
                      <span>📈 Interest:</span>
                      <strong>{(parseFloat(loan.interestRate) / 100).toFixed(2)}%</strong>
                    </div>
                    <div className="detail-row">
                      <span>⏰ Repayment Period:</span>
                      <strong>{Math.floor(loan.repaymentPeriod / 60)}min</strong>
                    </div>
                    <div className="detail-row">
                      <span>📊 Min Score:</span>
                      <strong>{loan.minActivityScore}</strong>
                    </div>
                    <div className="detail-row">
                      <span>🕐 Created:</span>
                      <strong>{new Date(loan.createdAt).toLocaleString()}</strong>
                    </div>
                  </div>

                  <button 
                    onClick={() => loadApplications(loan.id)}
                    className="btn-secondary btn-block"
                  >
                    👀 View Applications ({loan.filledSlots} pending)
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
            
            {/* Status Filter Tabs */}
            <div className="status-filters">
              <button 
                className={`filter-tab ${statusFilter === 'all' ? 'active' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                📋 All ({applications.length})
              </button>
              <button 
                className={`filter-tab ${statusFilter === 'pending' ? 'active' : ''}`}
                onClick={() => setStatusFilter('pending')}
              >
                ⏳ Pending ({applications.filter(a => a.status === 'pending').length})
              </button>
              <button 
                className={`filter-tab ${statusFilter === 'approved' ? 'active' : ''}`}
                onClick={() => setStatusFilter('approved')}
              >
                ✅ Approved ({applications.filter(a => a.status === 'approved').length})
              </button>
              <button 
                className={`filter-tab ${statusFilter === 'repaid' ? 'active' : ''}`}
                onClick={() => setStatusFilter('repaid')}
              >
                💰 Repaid ({applications.filter(a => a.status === 'repaid').length})
              </button>
            </div>
            
            {applications.length === 0 ? (
              <p className="empty-state">No applications yet</p>
            ) : (
              <div className="applications-list">
                {applications
                  .filter(app => statusFilter === 'all' || app.status === statusFilter)
                  .map((app, idx) => {
                    const isOverdue = app.status === 'approved' && 
                                      app.repaymentDeadline && 
                                      new Date(app.repaymentDeadline) < new Date();
                    
                    return (
                      <div key={idx} className={`application-card ${isOverdue ? 'overdue' : ''}`}>
                        <div className="app-header">
                          <span className="commitment-hash">
                            🔒 {app.borrowerCommitment.slice(0, 10)}...{app.borrowerCommitment.slice(-8)}
                          </span>
                          <span className={`status-badge ${app.status}`}>
                            {app.status === 'pending' && '⏳ PENDING'}
                            {app.status === 'approved' && (isOverdue ? '⚠️ OVERDUE' : '✅ APPROVED')}
                            {app.status === 'repaid' && '💰 REPAID'}
                          </span>
                        </div>
                        
                        <div className="app-details">
                          <p>📊 Activity Score: <strong>{app.activityScore || 'Verified ✅'}</strong></p>
                          <p>📅 Applied: {new Date(app.timestamp).toLocaleString()}</p>
                          
                          {app.status === 'approved' && app.approvedAt && (
                            <p>✅ Approved: {new Date(app.approvedAt).toLocaleString()}</p>
                          )}
                          
                          {app.status === 'repaid' && app.repaidAt && (
                            <p>💰 Repaid: {new Date(app.repaidAt).toLocaleString()}</p>
                          )}
                        </div>

                        {/* Show countdown timer for approved loans */}
                        {app.status === 'approved' && app.repaymentDeadline && (
                          <RepaymentCountdown deadline={app.repaymentDeadline} />
                        )}

                        {/* Action buttons based on status */}
                        {app.status === 'pending' && (
                          <button
                            onClick={() => approveBorrower(selectedLoan, app.borrowerCommitment)}
                            className="btn-primary btn-block"
                          >
                            ✅ Approve & Release Funds
                          </button>
                        )}

                        {isOverdue && (
                          <div className="overdue-warning">
                            <p>⚠️ <strong>Loan is overdue!</strong></p>
                            <button
                              onClick={() => revealBorrowerIdentity(selectedLoan, app.borrowerCommitment)}
                              className="btn-danger btn-block"
                            >
                              🔓 Reveal Borrower Identity
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                }
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LoanLenderFlow;
