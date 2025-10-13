import React, { useState, useEffect } from 'react';
import { connect, disconnect } from 'get-starknet';
import { Contract, RpcProvider, uint256, CallData, hash, num } from 'starknet';
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
  
  // Load saved commitment from localStorage on mount
  useEffect(() => {
    const savedCommitment = localStorage.getItem('zkCommitment');
    const savedProofHash = localStorage.getItem('zkProofHash');
    const savedActivityScore = localStorage.getItem('zkActivityScore');
    
    if (savedCommitment && savedProofHash && savedActivityScore) {
      console.log('📦 Loaded saved ZK proof from localStorage');
      setZkProof({
        commitmentHash: savedCommitment,
        commitment: savedCommitment,
        proofHash: savedProofHash,
        activityScore: parseInt(savedActivityScore)
      });
      setZkProofGenerated(true);
    }
  }, []);

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
      
      // Get connected wallet for wallet_address
      const starknet = await connect();
      if (!starknet || !starknet.account) {
        throw new Error('Wallet not connected');
      }
      
      const walletAddress = starknet.account.address;
      console.log('Using wallet address:', walletAddress);

      // ===== STEP 1: Get or retrieve identity commitment =====
      // Identity commitment is PERMANENT and stored on first proof generation
      // It never changes even when activity score updates
      let identityCommitment = localStorage.getItem('identityCommitment');
      
      if (identityCommitment) {
        console.log('✅ Found existing identity commitment:', identityCommitment.slice(0, 20) + '...');
      } else {
        console.log('🆕 First time - will create new identity commitment');
      }
      
      // ===== STEP 2: Generate proof with backend (includes current score) =====
      const proofRequest = {
        salary: activityData.score,
        threshold: 100,
        walletAddress: walletAddress,
        identityCommitment: identityCommitment || undefined // Pass existing identity if we have it
      };

      const response = await axios.post('http://localhost:3000/api/proof/generate', proofRequest);

      console.log('✅ Backend proof response:', response.data);

      // ===== STEP 3: Save identity commitment on FIRST proof generation =====
      if (!identityCommitment && response.data.identityCommitment) {
        identityCommitment = response.data.identityCommitment;
        localStorage.setItem('identityCommitment', identityCommitment);
        console.log('💾 Saved NEW identity commitment:', identityCommitment.slice(0, 20) + '...');
      }

      // Map backend response to expected format
      const zkProofData = {
        ...response.data,
        commitmentHash: response.data.identityCommitment, // Use IDENTITY for applications
        commitment: response.data.commitment, // Current proof commitment (may differ)
        identityCommitment: response.data.identityCommitment // Permanent identity
      };

      setZkProof(zkProofData);
      console.log('🎯 Identity commitment (for applications):', response.data.identityCommitment.slice(0, 20) + '...');
      console.log('📝 Current proof commitment:', response.data.commitment.slice(0, 20) + '...');
      console.log('ZK proof data stored:', zkProofData);

      // ===== STEP 2: Register proof on-chain =====
      console.log('Registering proof on verifier contract...');

      const provider = new RpcProvider({ 
        nodeUrl: import.meta.env.VITE_STARKNET_RPC || 'https://starknet-sepolia.public.blastapi.io'
      });

      const ACTIVITY_VERIFIER_ADDRESS = import.meta.env.VITE_ACTIVITY_VERIFIER_ADDRESS || 
        '0x071b94eb84b81868b61fb0ec1bbb59df47bb508583bc79325e5fa997ee3eb4be';

      const verifierAbi = [
        {
          name: 'register_proof',
          type: 'function',
          inputs: [
            { name: 'proof_hash', type: 'felt252' },
            { name: 'commitment', type: 'felt252' },
            { name: 'activity_score', type: 'u256' }
          ],
          outputs: [],
          stateMutability: 'external'
        }
      ];

      const verifierContract = new Contract(
        verifierAbi,
        ACTIVITY_VERIFIER_ADDRESS,
        starknet.account
      );

      // Clean hex strings
      // CRITICAL: felt252 can only hold 252 bits (max 63 hex chars)
      // SHA256 produces 256 bits (64 hex chars), so we MUST truncate
      const cleanHex = (hexStr) => {
        if (!hexStr) return '0';
        const cleaned = hexStr.startsWith?.('0x') ? hexStr.slice(2) : hexStr;
        // Truncate to 63 chars (252 bits) to fit in felt252
        return cleaned.slice(0, 63);
      };

      const proofHashHex = cleanHex(zkProofData.proofHash);
      const commitmentHex = cleanHex(zkProofData.commitmentHash);

      console.log('🔍 After cleanHex:', {
        proofHashHex_length: proofHashHex.length,
        proofHashHex: proofHashHex,
        commitmentHex_length: commitmentHex.length,
        commitmentHex: commitmentHex
      });

      // Convert to BigInt
      let proofHashNum = BigInt('0x' + proofHashHex);
      let commitmentNum = BigInt('0x' + commitmentHex);

      // CRITICAL: Mask to ensure value fits in felt252 (max = 2^251 - 1)
      // Even 63 hex chars can exceed this limit if high bits are set
      const FELT252_MAX = (BigInt(2) ** BigInt(251)) - BigInt(1);
      if (proofHashNum > FELT252_MAX) {
        console.log('⚠️ proofHash exceeds felt252 max, masking...');
        proofHashNum = proofHashNum & FELT252_MAX; // Bitwise AND to fit in range
      }
      if (commitmentNum > FELT252_MAX) {
        console.log('⚠️ commitment exceeds felt252 max, masking...');
        commitmentNum = commitmentNum & FELT252_MAX;
      }

      console.log('✅ Values after masking:', {
        proofHashNum: proofHashNum.toString(),
        commitmentNum: commitmentNum.toString(),
        withinRange: proofHashNum <= FELT252_MAX && commitmentNum <= FELT252_MAX
      });

      // Use num.toHex() to ensure proper felt252 format for starknet.js validation
      const proofHashFelt = num.toHex(proofHashNum);
      const commitmentFelt = num.toHex(commitmentNum);

      console.log('🔍 After num.toHex:', {
        proofHashFelt_length: proofHashFelt.length - 2, // minus 0x
        proofHashFelt: proofHashFelt,
        commitmentFelt_length: commitmentFelt.length - 2,
        commitmentFelt: commitmentFelt
      });

      // Convert activity score to u256
      const activityScoreU256 = uint256.bnToUint256(BigInt(activityData.score));

      console.log('Registering proof with params:', {
        proof_hash_hex: proofHashFelt,
        proof_hash_decimal: proofHashNum.toString(),
        commitment_hex: commitmentFelt,
        commitment_decimal: commitmentNum.toString(),
        activity_score: activityScoreU256
      });

      // Register the proof using account.execute for better control
      // This bypasses Contract validation and uses direct calldata
      try {
        const registerTx = await starknet.account.execute({
          contractAddress: ACTIVITY_VERIFIER_ADDRESS,
          entrypoint: 'register_proof',
          calldata: [
            proofHashNum.toString(),         // felt252 as decimal string
            commitmentNum.toString(),        // felt252 as decimal string
            activityScoreU256.low.toString(), // u256.low
            activityScoreU256.high.toString() // u256.high
          ]
        });

        console.log('Proof registration transaction submitted:', registerTx.transaction_hash);
        console.log('Waiting for confirmation...');
        
        await provider.waitForTransaction(registerTx.transaction_hash);
        console.log('Proof registered on-chain!');
        
        // Save to localStorage for persistence
        localStorage.setItem('zkCommitment', zkProofData.commitmentHash);
        localStorage.setItem('zkProofHash', zkProofData.proofHash);
        localStorage.setItem('zkActivityScore', activityData.score.toString());
        console.log('💾 Saved ZK proof to localStorage');
        
        alert('✅ Proof registered successfully! Transaction: ' + registerTx.transaction_hash.slice(0, 10) + '...');
      } catch (txError) {
        console.error('Transaction error:', txError);
        if (txError.message?.includes('User abort')) {
          throw new Error('Transaction rejected by user');
        }
        throw txError;
      }

      setZkProofGenerated(true);
      
      // Load available loans
      await loadAvailableLoans();
      await loadMyApplications();
    } catch (error) {
      console.error('ZK proof generation/registration failed:', error);
      alert('Failed to generate/register ZK proof: ' + error.message);
    }
  };

  // Load Available Loans
  const loadAvailableLoans = async () => {
    try {
      console.log('📋 Loading available loans...');
      const response = await axios.get('http://localhost:3000/api/loan/available');
      // Backend returns plain array, not {loans: [...]}
      const loans = Array.isArray(response.data) ? response.data : (response.data.loans || []);
      
      // Debug: Check loan #36
      const loan36 = loans.find(l => l.id === '36');
      if (loan36) {
        console.log('🔍 Loan #36 received from backend:', {
          id: loan36.id,
          totalSlots: loan36.totalSlots,
          filledSlots: loan36.filledSlots,
          slotsRemaining: loan36.slotsRemaining,
          display: `${loan36.filledSlots}/${loan36.totalSlots}` // FIXED: Show filled instead of remaining
        });
      }
      
      setAvailableLoans(loans);
      console.log('✅ Loaded loans:', loans.length);
      console.log('📦 Loan details:', loans);
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

  // Apply for Loan - ON-CHAIN IMPLEMENTATION
  const applyForLoan = async (loan) => {
    try {
      console.log('📝 Applying for loan:', loan.id);
      console.log('📦 Loan object:', loan);
      console.log('📦 ZK Proof:', zkProof);
      
      // Validate ZK proof exists
      if (!zkProof || !zkProof.commitmentHash || !zkProof.proofHash) {
        throw new Error('ZK proof not generated. Please refresh and try again.');
      }

      // Get connected wallet
      const starknet = await connect();
      if (!starknet || !starknet.account) {
        throw new Error('Wallet not connected');
      }

      const provider = new RpcProvider({ 
        nodeUrl: import.meta.env.VITE_STARKNET_RPC || 'https://starknet-sepolia.public.blastapi.io'
      });

      // Loan Escrow ZK ABI for apply_for_loan
      const loanEscrowAbi = [
        {
          name: 'apply_for_loan',
          type: 'function',
          inputs: [
            { name: 'loan_id', type: 'u256' },
            { name: 'proof_hash', type: 'felt252' },
            { name: 'commitment', type: 'felt252' }
          ],
          outputs: [],
          stateMutability: 'external'
        }
      ];

      const LOAN_ESCROW_ADDRESS = import.meta.env.VITE_LOAN_ESCROW_ZK_ADDRESS || 
        '0x05a4d3ed7d102ab91715c2b36c70b5e9795a3e917214dbd9af40503d2c29f83d';

      const loanEscrowContract = new Contract(
        loanEscrowAbi,
        LOAN_ESCROW_ADDRESS,
        starknet.account
      );

      // Convert loan_id to u256
      const loanIdU256 = uint256.bnToUint256(BigInt(loan.id));

      // Convert proof_hash and commitment to proper felt252 format
      let proofHashFelt = zkProof.proofHash;
      let commitmentFelt = zkProof.commitmentHash; // This is already the identityCommitment

      console.log('🔍 Raw ZK proof data:', {
        proofHash: proofHashFelt,
        proofHashType: typeof proofHashFelt,
        commitment: commitmentFelt,
        commitmentType: typeof commitmentFelt,
        commitmentLength: commitmentFelt?.length
      });

      // Clean and truncate hex strings to fit in felt252 (max 252 bits = 63 hex chars)
      // SHA256 produces 256 bits (64 chars), so we MUST truncate
      const cleanHex = (hexStr) => {
        if (!hexStr) return '0';
        const cleaned = hexStr.startsWith?.('0x') ? hexStr.slice(2) : hexStr;
        // Truncate to 63 chars (252 bits) to fit in felt252
        return cleaned.slice(0, 63);
      };

      const proofHashHex = cleanHex(proofHashFelt);
      const commitmentHex = cleanHex(commitmentFelt);

      // Convert to BigInt
      let proofHashNum = BigInt('0x' + proofHashHex);
      let commitmentNum = BigInt('0x' + commitmentHex);

      // CRITICAL: Mask to ensure value fits in felt252 (max = 2^251 - 1)
      const FELT252_MAX = (BigInt(2) ** BigInt(251)) - BigInt(1);
      if (proofHashNum > FELT252_MAX) {
        proofHashNum = proofHashNum & FELT252_MAX;
      }
      if (commitmentNum > FELT252_MAX) {
        commitmentNum = commitmentNum & FELT252_MAX;
      }

      // Use num.toHex() for proper felt252 format
      const proofHashFeltFormatted = num.toHex(proofHashNum);
      const commitmentFeltFormatted = num.toHex(commitmentNum);

      console.log('📊 Application parameters:', {
        loan_id: loanIdU256,
        proof_hash_hex: proofHashFeltFormatted,
        proof_hash_decimal: proofHashNum.toString(),
        commitment_hex: commitmentFeltFormatted,
        commitment_hex_length: commitmentHex.length,
        commitment_decimal: commitmentNum.toString()
      });

      // Call apply_for_loan on-chain using account.execute for direct control
      console.log('⏳ Submitting application to blockchain...');
      const applyTx = await starknet.account.execute({
        contractAddress: LOAN_ESCROW_ADDRESS,
        entrypoint: 'apply_for_loan',
        calldata: [
          loanIdU256.low.toString(),    // u256.low
          loanIdU256.high.toString(),   // u256.high
          proofHashNum.toString(),      // felt252 as decimal string
          commitmentNum.toString()      // felt252 as decimal string
        ]
      });
      
      console.log('⏳ Waiting for application tx:', applyTx.transaction_hash);
      await provider.waitForTransaction(applyTx.transaction_hash);
      console.log('✅ Application submitted on blockchain!');

      // Reload data
      await loadMyApplications();
      await loadAvailableLoans();
      setSelectedLoan(null);

      alert('✅ Application submitted successfully!\nYour identity is protected with ZK proof.\nTransaction: ' + applyTx.transaction_hash);
    } catch (error) {
      console.error('❌ Application failed:', error);
      alert('Failed to apply for loan: ' + (error.message || error));
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
              {zkProof && (
                <button 
                  onClick={() => {
                    if (window.confirm('⚠️ Regenerating proof will create a NEW identity. Your previous applications will NOT be accessible. Continue?')) {
                      localStorage.removeItem('zkCommitment');
                      localStorage.removeItem('zkProofHash');
                      localStorage.removeItem('zkActivityScore');
                      setZkProof(null);
                      setZkProofGenerated(false);
                      alert('🔄 Please reconnect your wallet and generate a new proof.');
                      window.location.reload();
                    }
                  }}
                  className="btn-secondary"
                  style={{ marginLeft: '10px', padding: '5px 10px', fontSize: '12px' }}
                >
                  🔄 Update Credit Score
                </button>
              )}
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
                    <h3>🏦 Loan #{loan.id}</h3>
                    <span className="status-badge funded">AVAILABLE</span>
                  </div>
                  
                  <div className="loan-details">
                    <div className="detail-row">
                      <span>💰 Amount per Borrower:</span>
                      <strong>{(parseFloat(loan.amountPerBorrower) / 1e18).toFixed(2)} STRK</strong>
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
                      <span>👥 Borrowers:</span>
                      <strong>{loan.filledSlots}/{loan.totalSlots} slots</strong>
                    </div>
                    <div className="detail-row">
                      <span>🎯 Min Activity Score:</span>
                      <strong>{loan.minActivityScore}</strong>
                    </div>
                  </div>

                  <div className="repayment-calc">
                    <p>💸 You'll repay: <strong>{
                      ((parseFloat(loan.amountPerBorrower) / 1e18) * (1 + parseFloat(loan.interestRate) / 10000)).toFixed(2)
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
                  <strong>{(parseFloat(selectedLoan.amountPerBorrower) / 1e18).toFixed(2)} STRK</strong>
                </div>
                <div className="detail-row">
                  <span>📈 Interest Rate:</span>
                  <strong>{(parseFloat(selectedLoan.interestRate) / 100).toFixed(2)}%</strong>
                </div>
                <div className="detail-row">
                  <span>💸 Repayment Amount:</span>
                  <strong>{
                    ((parseFloat(selectedLoan.amountPerBorrower) / 1e18) * (1 + parseFloat(selectedLoan.interestRate) / 10000)).toFixed(2)
                  } STRK</strong>
                </div>
                <div className="detail-row">
                  <span>⏰ Repayment Period:</span>
                  <strong>{Math.floor(selectedLoan.repaymentPeriod / 60)}min</strong>
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
