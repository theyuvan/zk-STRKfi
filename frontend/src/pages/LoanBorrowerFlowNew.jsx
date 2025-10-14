import React, { useState, useEffect } from 'react';
import { connect, disconnect } from 'get-starknet';
import { Contract, RpcProvider, uint256, CallData, hash, num } from 'starknet';
import StarkNetService from '../services/starknetService';
import { getActivityData } from '../utils/activityScoreCalculator';
import IdentityUpload from '../components/IdentityUpload';
import axios from 'axios';
import './LoanBorrowerFlowNew.css';

// ✅ Updated to use new contract addresses from .env
const LOAN_ESCROW_ADDRESS = import.meta.env.VITE_LOAN_ESCROW_ZK_ADDRESS || 
  '0x06b058a0946bb36fa846e6a954da885fa20809f43a9e47038dc83b4041f7f012';
const STRK_TOKEN_ADDRESS = import.meta.env.VITE_STRK_TOKEN_ADDRESS || 
  '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';

// ⏰ Countdown Timer Component
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

const LoanBorrowerFlow = () => {
  // Wallet state
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [strkBalance, setStrkBalance] = useState('0');

  // Identity verification state (Stage 1)
  const [identityVerified, setIdentityVerified] = useState(false);
  const [identityCommitment, setIdentityCommitment] = useState(null);

  // Activity & ZK state (Stage 2)
  const [activityData, setActivityData] = useState(null);
  const [zkProofGenerated, setZkProofGenerated] = useState(false);
  const [zkProof, setZkProof] = useState(null);
  
  // Load saved data from localStorage on mount
  useEffect(() => {
    // Check identity verification
    const savedIdentityCommitment = localStorage.getItem('identityCommitment');
    const savedIdentityVerified = localStorage.getItem('identityVerified');
    
    if (savedIdentityCommitment && savedIdentityVerified === 'true') {
      console.log('📦 Loaded saved identity commitment from localStorage');
      setIdentityCommitment(savedIdentityCommitment);
      setIdentityVerified(true);
    }

    // Check activity ZK proof
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

  // Step 1.5: Handle Identity Verification Completion
  const handleIdentityVerified = (data) => {
    console.log('✅ Identity verified:', data);
    setIdentityCommitment(data.commitment);
    setIdentityVerified(true);
    
    // Auto-fetch activity data after identity verification
    fetchActivityData();
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
      // USE THE REACT STATE, not localStorage directly!
      const currentIdentityCommitment = identityCommitment; // Use state from Stage 1
      
      if (currentIdentityCommitment) {
        console.log('✅ Found existing identity commitment:', currentIdentityCommitment.slice(0, 20) + '...');
      } else {
        console.log('⚠️ WARNING: No identity commitment found! Did you complete Stage 1?');
      }
      
      // ===== STEP 2: Generate proof with backend (includes current score) =====
      const proofRequest = {
        salary: activityData.score,
        threshold: 100,
        walletAddress: walletAddress,
        identityCommitment: currentIdentityCommitment // Pass identity from Stage 1
      };

      const response = await axios.post('http://localhost:3000/api/proof/generate', proofRequest);

      console.log('✅ Backend proof response:', response.data);

      // ===== STEP 3: Save identity commitment on FIRST proof generation =====
      // This should NEVER happen if user completed Stage 1 properly
      if (!currentIdentityCommitment && response.data.identityCommitment) {
        const newIdentityCommitment = response.data.identityCommitment;
        localStorage.setItem('identityCommitment', newIdentityCommitment);
        setIdentityCommitment(newIdentityCommitment); // Update state too
        console.log('💾 Saved NEW identity commitment:', newIdentityCommitment.slice(0, 20) + '...');
      }

      // Map backend response to expected format
      // CRITICAL: Truncate commitments to 65 chars to match contract felt252 limit
      const truncatedIdentityCommitment = response.data.identityCommitment.slice(0, 65);
      const truncatedCommitment = response.data.commitment.slice(0, 65);
      
      console.log('🔍 Commitment analysis:', {
        identityCommitment: truncatedIdentityCommitment,
        activityCommitment: truncatedCommitment,
        same: truncatedIdentityCommitment === truncatedCommitment,
        identityLength: truncatedIdentityCommitment.length,
        activityLength: truncatedCommitment.length
      });
      
      const zkProofData = {
        ...response.data,
        commitmentHash: truncatedCommitment, // ✅ ACTIVITY commitment for applications (changes with score)
        commitment: truncatedCommitment, // Activity proof commitment (changes with score)
        identityCommitment: truncatedIdentityCommitment // ✅ PERMANENT identity (only for reveal)
      };

      setZkProof(zkProofData);
      console.log('📊 Activity commitment (for applications):', response.data.commitment.slice(0, 20) + '...');
      console.log('🆔 Identity commitment (for reveal only):', response.data.identityCommitment.slice(0, 20) + '...');
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

      // Convert to BigInt (NO MASKING - backend already ensures correct size)
      // Backend truncates to 63 hex chars which naturally fits in felt252
      let proofHashNum = BigInt('0x' + proofHashHex);
      let commitmentNum = BigInt('0x' + commitmentHex);

      console.log('✅ Commitment values (no masking):', {
        proofHashNum: proofHashNum.toString(),
        commitmentNum: commitmentNum.toString(),
        proofHashHex: '0x' + proofHashHex,
        commitmentHex: '0x' + commitmentHex
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

      console.log('🔍 VERIFIER ADDRESS CHECK:', {
        ACTIVITY_VERIFIER_ADDRESS,
        isCorrect: ACTIVITY_VERIFIER_ADDRESS === '0x071b94eb84b81868b61fb0ec1bbb59df47bb508583bc79325e5fa997ee3eb4be',
        connectedWallet: starknet.selectedAddress
      });

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
            activityScoreU256.low.toString(), // u256.low as string
            activityScoreU256.high.toString() // u256.high as string
          ]
        });

        console.log('Proof registration transaction submitted:', registerTx.transaction_hash);
        console.log('Waiting for confirmation...');
        
        await provider.waitForTransaction(registerTx.transaction_hash);
        console.log('Proof registered on-chain!');
        
        // CRITICAL: Save ACTIVITY COMMITMENT (for applications), not identity commitment
        // zkProofData.commitmentHash = activity commitment (used for loan applications)
        // zkProofData.identityCommitment = permanent identity (only revealed on default)
        const activityCommitment = zkProofData.commitmentHash.slice(0, 65);
        
        // Save to localStorage for persistence
        localStorage.setItem('zkCommitment', activityCommitment);
        localStorage.setItem('zkProofHash', zkProofData.proofHash);
        localStorage.setItem('zkActivityScore', activityData.score.toString());
        localStorage.setItem('identityCommitment', zkProofData.identityCommitment.slice(0, 65)); // Store separately
        console.log('💾 Saved ACTIVITY commitment to localStorage:', activityCommitment.slice(0, 20) + '...');
        console.log('🆔 Saved IDENTITY commitment separately:', zkProofData.identityCommitment.slice(0, 20) + '...');
        console.log('📊 Activity commitment will be used for loan applications');
        console.log('🔒 Identity commitment will ONLY be revealed on loan default');
        
        alert('✅ Proof registered successfully! Transaction: ' + registerTx.transaction_hash.slice(0, 10) + '...');
      } catch (txError) {
        console.error('Transaction error:', txError);
        if (txError.message?.includes('User abort')) {
          throw new Error('Transaction rejected by user');
        }
        throw txError;
      }

      setZkProofGenerated(true);
      
      // Load available loans, applications, and active loans
      await loadAvailableLoans();
      await loadMyApplications();
      await loadMyActiveLoans();
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
        '0x06b058a0946bb36fa846e6a954da885fa20809f43a9e47038dc83b4041f7f012';

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

      // Convert to BigInt (NO MASKING - just use truncated hex as-is)
      // Backend already truncated to 63 chars, which fits in felt252
      let proofHashNum = BigInt('0x' + proofHashHex);
      let commitmentNum = BigInt('0x' + commitmentHex);

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
      console.log('💸 Repaying loan:', loan.loanId);
      
      // DEBUG: Verify contract addresses are loaded
      console.log('🔍 Contract addresses check:', {
        LOAN_ESCROW_ADDRESS,
        STRK_TOKEN_ADDRESS,
        escrowDefined: !!LOAN_ESCROW_ADDRESS,
        strkDefined: !!STRK_TOKEN_ADDRESS
      });
      
      if (!LOAN_ESCROW_ADDRESS || !STRK_TOKEN_ADDRESS) {
        throw new Error('Contract addresses not loaded from .env file. Please restart frontend.');
      }
      
      const starknet = await connect();
      const provider = new RpcProvider({ 
        nodeUrl: import.meta.env.VITE_STARKNET_RPC 
      });

      // Calculate repayment amount (amount is in wei already from backend)
      const principalWei = BigInt(loan.amount);
      const interestRateBps = BigInt(loan.interestRate);
      const interestWei = (principalWei * interestRateBps) / BigInt(10000);
      const repaymentWei = principalWei + interestWei;

      console.log('💰 Repayment breakdown:');
      console.log('  Principal:', (Number(principalWei) / 1e18).toFixed(4), 'STRK');
      console.log('  Interest:', (Number(interestWei) / 1e18).toFixed(4), 'STRK');
      console.log('  Total:', (Number(repaymentWei) / 1e18).toFixed(4), 'STRK');

      // 1. Approve STRK tokens
      console.log('📝 Approving STRK spending...');
      const amountUint256 = uint256.bnToUint256(repaymentWei);
      
      console.log('📤 APPROVE TRANSACTION DETAILS:', {
        tokenAddress: STRK_TOKEN_ADDRESS,
        spender: LOAN_ESCROW_ADDRESS,
        amount_low: amountUint256.low.toString(),
        amount_high: amountUint256.high.toString()
      });
      
      const approveTx = await starknet.account.execute({
        contractAddress: STRK_TOKEN_ADDRESS,
        entrypoint: 'approve',
        calldata: [
          LOAN_ESCROW_ADDRESS,
          amountUint256.low.toString(),
          amountUint256.high.toString()
        ]
      });
      
      console.log('⏳ Waiting for approval tx:', approveTx.transaction_hash);
      await provider.waitForTransaction(approveTx.transaction_hash);
      console.log('✅ STRK spending approved!');

      // 2. Call repay_loan on contract
      console.log('💰 Calling repay_loan on contract...');
      const loanIdU256 = uint256.bnToUint256(BigInt(loan.loanId));
      
      // Get borrower commitment from localStorage
      const borrowerCommitment = localStorage.getItem('zkCommitment');
      if (!borrowerCommitment) {
        throw new Error('ZK commitment not found. Please regenerate your ZK proof.');
      }
      
      console.log('🔑 Using commitment:', borrowerCommitment.slice(0, 20) + '...');
      
      // CRITICAL DEBUG: Log exactly what we're sending to the contract
      console.log('📤 REPAY TRANSACTION DETAILS:', {
        contractAddress: LOAN_ESCROW_ADDRESS,
        contractAddressType: typeof LOAN_ESCROW_ADDRESS,
        contractAddressDefined: !!LOAN_ESCROW_ADDRESS,
        entrypoint: 'repay_loan',
        calldata: {
          loanId_low: loanIdU256.low.toString(),
          loanId_high: loanIdU256.high.toString(),
          commitment: borrowerCommitment
        }
      });
      
      if (!LOAN_ESCROW_ADDRESS || LOAN_ESCROW_ADDRESS === 'undefined') {
        throw new Error(
          '🚨 LOAN_ESCROW_ADDRESS is not defined!\n\n' +
          'The .env file is not loaded. Please:\n' +
          '1. Stop frontend (Ctrl+C)\n' +
          '2. Delete node_modules\\.vite folder\n' +
          '3. Restart: npm run dev\n' +
          '4. Clear browser cache and reload'
        );
      }
      
      const repayTx = await starknet.account.execute({
        contractAddress: LOAN_ESCROW_ADDRESS,
        entrypoint: 'repay_loan',
        calldata: [
          loanIdU256.low.toString(),
          loanIdU256.high.toString(),
          borrowerCommitment  // Add the commitment parameter
        ]
      });
      
      console.log('⏳ Waiting for repayment tx:', repayTx.transaction_hash);
      const receipt = await provider.waitForTransaction(repayTx.transaction_hash);
      console.log('✅ Loan repaid on blockchain!', receipt);

      alert(`✅ Loan #${loan.loanId} repaid successfully!\n\nYou repaid ${(Number(repaymentWei) / 1e18).toFixed(4)} STRK`);
      
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

  // Initial load when zkProof is available
  useEffect(() => {
    if (zkProofGenerated && zkProof) {
      console.log('🔄 Initial load - fetching all loan data...');
      loadAvailableLoans();
      loadMyApplications();
      loadMyActiveLoans();
    }
  }, [zkProofGenerated, zkProof]);

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

  // Render: Identity Verification (Stage 1)
  if (!identityVerified) {
    return (
      <div className="borrower-flow">
        <div className="identity-section">
          <div className="dashboard-header" style={{ marginBottom: '30px' }}>
            <h1>🆔 Stage 1: Identity Verification</h1>
            <p className="wallet-info">
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)} | 
              💰 {strkBalance} STRK
            </p>
          </div>
          
          <IdentityUpload 
            walletAddress={walletAddress}
            onIdentityVerified={handleIdentityVerified}
          />
          
          <div className="info-box" style={{ marginTop: '20px' }}>
            <h4>🔐 Two-Stage Privacy Protection</h4>
            <p>✅ Stage 1 (Current): Upload identity documents - generates identity_commitment</p>
            <p>⏳ Stage 2 (Next): Generate activity score proof - generates activity_commitment</p>
            <p>🚀 Stage 3 (Final): Apply for loans with both commitments</p>
            <hr style={{ margin: '10px 0' }} />
            <p>🛡️ Your documents are hashed and deleted immediately</p>
            <p>🔒 Only your identity_commitment is stored locally</p>
            <p>👁️ Lenders NEVER see your documents or personal details</p>
          </div>
        </div>
      </div>
    );
  }

  // Render: Activity Fetch (Stage 2 preparation)
  if (!activityData) {
    return (
      <div className="borrower-flow">
        <div className="loading-section">
          <div className="spinner"></div>
          <h2>📊 Stage 2: Fetching Activity Data...</h2>
          <p>Analyzing your wallet activity</p>
          <p className="wallet-address">Wallet: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</p>
          <div className="info-box" style={{ marginTop: '20px' }}>
            <p>✅ Identity verified: {identityCommitment?.slice(0, 20)}...</p>
          </div>
        </div>
      </div>
    );
  }

  // Render: ZK Verification (Stage 2)
  if (!zkProofGenerated) {
    return (
      <div className="borrower-flow">
        <div className="zk-section">
          <h1>🔐 Stage 2: Activity Score Verification</h1>
          
          <div className="info-box" style={{ marginBottom: '20px' }}>
            <p>✅ Stage 1 Complete: Identity verified</p>
            <p>🔒 Identity Commitment: {identityCommitment?.slice(0, 20)}...{identityCommitment?.slice(-20)}</p>
          </div>
          
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
                <span className="stat-hint" style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                  {activityData.metrics?.nonce > 0 
                    ? `${activityData.metrics.nonce} total on-chain`
                    : `${activityData.metrics?.transferCount || 0} STRK transfers`}
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Activity Score</span>
                <span className="stat-value">{activityData.score}</span>
              </div>
            </div>
          </div>
          
          <button onClick={generateZKProof} className="btn-primary btn-large">
            🔐 Generate Activity Proof & Enter Dashboard
          </button>
          
          <div className="info-box">
            <p>🛡️ Your activity data will be proven with ZK</p>
            <p>✨ Lenders will only see your activity_commitment hash</p>
            <p>🔒 Your identity_commitment will be sent with loan applications</p>
          </div>
        </div>
      </div>
    );
  }

  // Render: Main Dashboard (Stage 3 - Ready to Apply)
  return (
    <div className="borrower-flow">
      <div className="dashboard">
        {/* Header */}
        <div className="dashboard-header">
          <div>
            <h1>💼 Borrower Dashboard (Stage 3: Ready to Apply)</h1>
            <p className="wallet-info">
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)} | 
              💰 {strkBalance} STRK | 
              📊 Score: {activityData.score}
            </p>
            <p className="commitment-hash">
              🆔 Identity (Reveal Only): {zkProof?.identityCommitment ? `${zkProof.identityCommitment.slice(0, 10)}...${zkProof.identityCommitment.slice(-8)}` : identityCommitment ? `${identityCommitment.slice(0, 10)}...${identityCommitment.slice(-8)}` : 'Not verified'}
              <span style={{ fontSize: '11px', color: '#888', marginLeft: '8px' }}>🔒 Private until default</span>
            </p>
            <p className="commitment-hash">
              📊 Activity (Applications): {zkProof?.commitmentHash ? `${zkProof.commitmentHash.slice(0, 10)}...${zkProof.commitmentHash.slice(-8)}` : 'Not generated'}
              <span style={{ fontSize: '11px', color: '#888', marginLeft: '8px' }}>📤 Sent with each application</span>
              {zkProof && (
                <button 
                  onClick={() => {
                    if (window.confirm('⚠️ Regenerating proof will create a NEW activity commitment. Your active loans will still be tracked by identity commitment. Continue?')) {
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
              {myActiveLoans.map((loan, idx) => {
                const repaymentAmount = parseFloat(loan.amount) * (1 + parseFloat(loan.interestRate) / 10000);
                
                return (
                  <div key={idx} className="loan-card active-loan">
                    <div className="loan-header">
                      <h3>Loan #{loan.loanId}</h3>
                      <span className="status-badge active">✅ ACTIVE</span>
                    </div>
                    
                    <div className="loan-details">
                      <div className="detail-row">
                        <span>💰 Borrowed:</span>
                        <strong>{(parseFloat(loan.amount) / 1e18).toFixed(4)} STRK</strong>
                      </div>
                      <div className="detail-row">
                        <span>💸 Must Repay:</span>
                        <strong>{(repaymentAmount / 1e18).toFixed(4)} STRK</strong>
                      </div>
                      <div className="detail-row">
                        <span>📈 Interest:</span>
                        <strong>{(parseFloat(loan.interestRate) / 100).toFixed(2)}%</strong>
                      </div>
                      <div className="detail-row">
                        <span>� Approved:</span>
                        <strong>{new Date(loan.approvedAt).toLocaleDateString()}</strong>
                      </div>
                    </div>

                    {/* ⏰ Countdown Timer */}
                    {loan.repaymentDeadline && (
                      <RepaymentCountdown deadline={loan.repaymentDeadline} />
                    )}

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
                );
              })}
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
