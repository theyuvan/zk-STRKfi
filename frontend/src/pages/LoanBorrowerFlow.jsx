import { useState, useEffect } from 'react';
import { connect, disconnect } from 'get-starknet';
import toast from 'react-hot-toast';
import { starknetService } from '../services/starknetService';
import { activityScoreCalculator } from '../services/activityScoreCalculator';
import { zkProofCache } from '../services/zkProofCache';
import axios from 'axios';

/**
 * Complete Loan Borrower Flow
 * Step-by-step process:
 * 1. Connect StarkNet wallet
 * 2. Fetch STRK balance & transaction history
 * 3. Calculate activity score
 * 4. Generate/retrieve ZK proof (cached)
 * 5. Browse available loans
 * 6. Apply for loan
 * 7. Receive STRK tokens
 * 8. Repay within 10 minutes or identity revealed
 */
export default function LoanBorrowerFlow() {
  // Connection state
  const [wallet, setWallet] = useState(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  // Activity data
  const [strkBalance, setStrkBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [activityMetrics, setActivityMetrics] = useState(null);
  const [activityScore, setActivityScore] = useState(null);
  const [isFetchingActivity, setIsFetchingActivity] = useState(false);

  // ZK Proof state
  const [zkProof, setZkProof] = useState(null);
  const [isGeneratingProof, setIsGeneratingProof] = useState(false);
  const [proofCached, setProofCached] = useState(false);

  // Loan state
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [activeLoan, setActiveLoan] = useState(null);
  const [repaymentDeadline, setRepaymentDeadline] = useState(null);
  const [isApplyingForLoan, setIsApplyingForLoan] = useState(false);

  // Current step in the flow
  const [currentStep, setCurrentStep] = useState(1);

  // Check wallet connection on mount
  useEffect(() => {
    checkWalletConnection();
  }, []);

  /**
   * STEP 1: Connect StarkNet Wallet
   */
  const checkWalletConnection = async () => {
    try {
      const starknet = await connect({ modalMode: 'neverAsk' });
      if (starknet?.isConnected) {
        setWallet(starknet);
        setWalletAddress(starknet.selectedAddress);
        setCurrentStep(2);
        console.log('✅ Wallet already connected:', starknet.selectedAddress);
      }
    } catch (error) {
      console.log('No wallet connected yet');
    }
  };

  const connectWallet = async () => {
    try {
      setIsConnecting(true);
      toast.loading('Connecting to StarkNet wallet...', { id: 'connect' });

      const starknet = await connect({ modalMode: 'alwaysAsk' });

      if (!starknet) {
        throw new Error('No StarkNet wallet found. Please install Argent X or Braavos.');
      }

      await starknet.enable();

      if (!starknet.isConnected) {
        throw new Error('Failed to connect wallet');
      }

      setWallet(starknet);
      setWalletAddress(starknet.selectedAddress);
      setCurrentStep(2);

      toast.success('Wallet connected!', { id: 'connect' });
      console.log('✅ Wallet connected:', starknet.selectedAddress);

      // Auto-fetch activity
      setTimeout(() => fetchWalletActivity(), 1000);

    } catch (error) {
      console.error('❌ Wallet connection failed:', error);
      toast.error(error.message, { id: 'connect' });
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = async () => {
    try {
      if (wallet) {
        await disconnect();
      }
      setWallet(null);
      setWalletAddress('');
      setStrkBalance(null);
      setTransactions([]);
      setActivityMetrics(null);
      setActivityScore(null);
      setZkProof(null);
      setCurrentStep(1);
      toast.success('Wallet disconnected');
    } catch (error) {
      console.error('❌ Disconnect failed:', error);
    }
  };

  /**
   * STEP 2: Fetch STRK Balance & Transaction History
   */
  const fetchWalletActivity = async () => {
    if (!walletAddress) return;

    try {
      setIsFetchingActivity(true);
      toast.loading('Fetching wallet activity...', { id: 'activity' });

      console.log('🔍 Fetching activity for:', walletAddress);

      // Fetch balance, transactions, and metrics in parallel
      const [balance, txHistory, metrics] = await Promise.all([
        starknetService.fetchStrkBalance(walletAddress),
        starknetService.fetchTransactionHistory(walletAddress),
        starknetService.calculateActivityMetrics(walletAddress)
      ]);

      setStrkBalance(balance);
      setTransactions(txHistory);
      setActivityMetrics(metrics);

      // Calculate activity score
      const scoreData = activityScoreCalculator.calculateScore(metrics);
      setActivityScore(scoreData);

      setCurrentStep(3);

      toast.success(`Activity fetched! Score: ${scoreData.total}/1000`, { id: 'activity' });

      console.log('✅ Activity data loaded:', {
        balance: balance.formatted,
        txCount: txHistory.length,
        score: scoreData.total
      });

    } catch (error) {
      console.error('❌ Failed to fetch activity:', error);
      toast.error('Failed to fetch wallet activity: ' + error.message, { id: 'activity' });
    } finally {
      setIsFetchingActivity(false);
    }
  };

  /**
   * STEP 3: Generate ZK Proof (with caching)
   */
  const generateZKProof = async () => {
    if (!activityScore || !walletAddress) return;

    try {
      setIsGeneratingProof(true);
      toast.loading('Generating ZK proof...', { id: 'proof' });

      console.log('🔐 Generating ZK proof for score:', activityScore.total);

      // Prepare metrics for cache check
      const currentMetrics = {
        activityScore: activityScore.total,
        txCount: activityMetrics.txCount,
        totalVolume: activityMetrics.totalVolume,
        lastTxHash: transactions[0]?.txHash || null
      };

      // Check cache or generate new proof
      const proofResult = await zkProofCache.getOrUpdateProof(
        walletAddress,
        currentMetrics,
        async () => {
          // Call backend to generate proof
          const response = await axios.post('http://localhost:3000/api/proof/generate', {
            salary: activityScore.total,
            threshold: 1, // Minimum threshold for proof validity
            walletAddress: walletAddress
          });

          return {
            proof: response.data.proof,
            publicSignals: response.data.publicSignals,
            commitment: response.data.commitment,
            proofHash: response.data.proofHash
          };
        }
      );

      setZkProof(proofResult);
      setProofCached(proofResult.cached);
      setCurrentStep(4);

      if (proofResult.cached) {
        toast.success('✅ Using cached proof', { id: 'proof' });
        console.log('✅ Proof loaded from cache');
      } else {
        toast.success('✅ ZK proof generated!', { id: 'proof' });
        console.log('✅ New proof generated:', {
          commitment: proofResult.commitment,
          reason: proofResult.reason
        });
      }

      // Log cache stats
      zkProofCache.logCacheActivity();

    } catch (error) {
      console.error('❌ Proof generation failed:', error);
      toast.error('Failed to generate proof: ' + error.message, { id: 'proof' });
    } finally {
      setIsGeneratingProof(false);
    }
  };

  /**
   * STEP 4: Apply for Loan
   */
  const applyForLoan = async (loan) => {
    if (!zkProof || !walletAddress) return;

    try {
      setIsApplyingForLoan(true);
      toast.loading('Applying for loan...', { id: 'apply' });

      console.log('📋 Applying for loan:', loan.name);

      // Check if score meets threshold
      const eligibility = activityScoreCalculator.checkLoanEligibility(
        activityScore.total,
        loan.thresholdScore
      );

      if (!eligibility.eligible) {
        toast.error(eligibility.message, { id: 'apply' });
        return;
      }

      // Submit loan application
      const response = await axios.post('http://localhost:3000/api/loan/apply', {
        borrowerAddress: walletAddress,
        loanId: loan.id,
        amount: loan.loanAmount,
        threshold: loan.thresholdScore,
        proofHash: zkProof.proofHash,
        commitment: zkProof.commitment,
        proof: zkProof.proof,
        publicSignals: zkProof.publicSignals
      });

      // Set active loan
      const loanData = {
        ...loan,
        loanId: response.data.loanId,
        borrowedAt: Date.now(),
        deadline: Date.now() + (loan.repaymentPeriod * 1000),
        status: 'active'
      };

      setActiveLoan(loanData);
      setRepaymentDeadline(loanData.deadline);
      setCurrentStep(5);

      toast.success(`✅ Loan approved! ${loan.loanAmount / 1e18} STRK transferred to your wallet`, { id: 'apply' });

      console.log('✅ Loan activated:', loanData);

    } catch (error) {
      console.error('❌ Loan application failed:', error);
      toast.error('Loan application failed: ' + (error.response?.data?.error || error.message), { id: 'apply' });
    } finally {
      setIsApplyingForLoan(false);
    }
  };

  /**
   * STEP 5: Repay Loan
   */
  const repayLoan = async () => {
    if (!activeLoan) return;

    try {
      toast.loading('Processing repayment...', { id: 'repay' });

      const response = await axios.post('http://localhost:3000/api/loan/repay', {
        loanId: activeLoan.loanId,
        borrowerAddress: walletAddress,
        amount: activeLoan.repaymentAmount
      });

      toast.success('✅ Loan repaid successfully!', { id: 'repay' });

      setActiveLoan(null);
      setRepaymentDeadline(null);
      setCurrentStep(4);

      console.log('✅ Loan repaid:', response.data);

    } catch (error) {
      console.error('❌ Repayment failed:', error);
      toast.error('Repayment failed: ' + (error.response?.data?.error || error.message), { id: 'repay' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">ZK Loan Platform</h1>
              <p className="text-sm text-gray-500">Privacy-preserving loans on StarkNet</p>
            </div>

            {walletAddress ? (
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-gray-500">Connected Wallet</p>
                  <p className="text-sm font-mono font-medium text-gray-900">
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </p>
                </div>
                <button
                  onClick={disconnectWallet}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-12">
          {[
            { num: 1, label: 'Connect Wallet' },
            { num: 2, label: 'Fetch Activity' },
            { num: 3, label: 'Generate Proof' },
            { num: 4, label: 'Select Loan' },
            { num: 5, label: 'Repayment' }
          ].map((step, index) => (
            <div key={step.num} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                    currentStep >= step.num
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {step.num}
                </div>
                <p
                  className={`mt-2 text-sm font-medium ${
                    currentStep >= step.num ? 'text-indigo-600' : 'text-gray-500'
                  }`}
                >
                  {step.label}
                </p>
              </div>
              {index < 4 && (
                <div
                  className={`h-1 flex-1 mx-4 transition-all ${
                    currentStep > step.num ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Main Content Area */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Step 1: Connect Wallet */}
          {currentStep === 1 && (
            <WalletConnectSection
              onConnect={connectWallet}
              isConnecting={isConnecting}
            />
          )}

          {/* Step 2: Activity Data */}
          {currentStep === 2 && (
            <ActivitySection
              strkBalance={strkBalance}
              transactions={transactions}
              activityMetrics={activityMetrics}
              activityScore={activityScore}
              isFetching={isFetchingActivity}
              onFetch={fetchWalletActivity}
              onNext={() => setCurrentStep(3)}
            />
          )}

          {/* Step 3: ZK Proof */}
          {currentStep === 3 && (
            <ZKProofSection
              activityScore={activityScore}
              zkProof={zkProof}
              proofCached={proofCached}
              isGenerating={isGeneratingProof}
              onGenerate={generateZKProof}
              onNext={() => setCurrentStep(4)}
            />
          )}

          {/* Step 4: Loan Selection */}
          {currentStep === 4 && (
            <LoanSelectionSection
              activityScore={activityScore}
              zkProof={zkProof}
              onSelectLoan={applyForLoan}
              isApplying={isApplyingForLoan}
            />
          )}

          {/* Step 5: Active Loan & Repayment */}
          {currentStep === 5 && activeLoan && (
            <RepaymentSection
              loan={activeLoan}
              deadline={repaymentDeadline}
              walletAddress={walletAddress}
              onRepay={repayLoan}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Step 1: Wallet Connect Section
 */
function WalletConnectSection({ onConnect, isConnecting }) {
  return (
    <div className="text-center py-12">
      <div className="mb-8">
        <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-10 h-10 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Connect Your StarkNet Wallet</h2>
        <p className="text-gray-600 max-w-md mx-auto">
          Connect your Argent X or Braavos wallet to get started with privacy-preserving loans
        </p>
      </div>

      <button
        onClick={onConnect}
        disabled={isConnecting}
        className="px-8 py-4 bg-indigo-600 text-white text-lg font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
      >
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </button>

      <div className="mt-8 text-sm text-gray-500">
        <p>Don't have a StarkNet wallet?</p>
        <div className="flex gap-4 justify-center mt-2">
          <a href="https://www.argent.xyz/argent-x/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
            Get Argent X
          </a>
          <span>•</span>
          <a href="https://braavos.app/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
            Get Braavos
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * Step 2: Activity Data Section
 */
function ActivitySection({ strkBalance, transactions, activityMetrics, activityScore, isFetching, onFetch, onNext }) {
  if (isFetching) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-600">Fetching your wallet activity from StarkNet...</p>
      </div>
    );
  }

  if (!activityScore) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Analyze Your Wallet Activity</h2>
        <p className="text-gray-600 mb-6">We'll fetch your STRK balance and transaction history to calculate your activity score</p>
        <button
          onClick={onFetch}
          className="px-8 py-4 bg-indigo-600 text-white text-lg font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
        >
          Fetch My Activity
        </button>
      </div>
    );
  }

  const scoreTier = activityScoreCalculator.getScoreTier(activityScore.total);
  const suggestions = activityScoreCalculator.getImprovementSuggestions(activityScore);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Wallet Activity</h2>

      {/* Activity Score Card */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-8 text-white mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-indigo-100 text-sm font-medium">Activity Score</p>
            <div className="flex items-baseline gap-2">
              <span className="text-6xl font-bold">{activityScore.total}</span>
              <span className="text-2xl text-indigo-100">/ 1000</span>
            </div>
          </div>
          <div className={`px-4 py-2 rounded-full bg-${scoreTier.color}-500 bg-opacity-20 border-2 border-white`}>
            <span className="text-lg font-bold">{scoreTier.tier}</span>
          </div>
        </div>
        <p className="text-indigo-100">{scoreTier.description}</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="STRK Balance"
          value={`${strkBalance.formatted} STRK`}
          score={`${activityScore.balanceScore}/300`}
        />
        <MetricCard
          label="Transactions"
          value={transactions.length}
          score={`${activityScore.transactionCountScore}/400`}
        />
        <MetricCard
          label="Total Volume"
          value={`${activityMetrics.totalVolume.toFixed(2)} STRK`}
          score={`${activityScore.volumeScore}/200`}
        />
        <MetricCard
          label="Consistency"
          value={activityMetrics.recentTxCount > 0 ? 'Active' : 'Dormant'}
          score={`${activityScore.consistencyScore}/150`}
        />
      </div>

      {/* Score Breakdown */}
      <div className="bg-gray-50 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Score Breakdown</h3>
        <div className="space-y-3">
          <ScoreBar label="Balance Score" value={activityScore.balanceScore} max={300} />
          <ScoreBar label="Transaction Count" value={activityScore.transactionCountScore} max={400} />
          <ScoreBar label="Volume Score" value={activityScore.volumeScore} max={200} />
          <ScoreBar label="Consistency" value={activityScore.consistencyScore} max={150} />
          {activityScore.recentActivityBonus > 0 && (
            <ScoreBar label="Recent Activity Bonus" value={activityScore.recentActivityBonus} max={50} />
          )}
        </div>
      </div>

      {/* Improvement Suggestions */}
      {suggestions.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-blue-900 mb-3">💡 Improve Your Score</h3>
          <ul className="space-y-2">
            {suggestions.map((suggestion, idx) => (
              <li key={idx} className="text-sm text-blue-800">{suggestion}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent Transactions */}
      {transactions.length > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Recent Transactions (Last 5)</h3>
          <div className="space-y-2">
            {transactions.slice(0, 5).map((tx) => (
              <div key={tx.txHash} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-mono text-gray-600">
                    {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-8)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(tx.timestamp * 1000).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${tx.type === 'sent' ? 'text-red-600' : 'text-green-600'}`}>
                    {tx.type === 'sent' ? '-' : '+'}{tx.valueInStrk.toFixed(4)} STRK
                  </p>
                  <p className="text-xs text-gray-500 capitalize">{tx.type}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onNext}
        className="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
      >
        Continue to ZK Proof →
      </button>
    </div>
  );
}

/**
 * Helper Components
 */
function MetricCard({ label, value, score }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900 mb-1">{value}</p>
      <p className="text-xs text-indigo-600 font-medium">{score} pts</p>
    </div>
  );
}

function ScoreBar({ label, value, max }) {
  const percentage = (value / max) * 100;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-700">{label}</span>
        <span className="text-gray-900 font-medium">{value} / {max}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-indigo-600 h-2 rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Step 3: ZK Proof Generation Section
 */
function ZKProofSection({ activityScore, zkProof, proofCached, isGenerating, onGenerate, onNext }) {
  if (isGenerating) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-600">Generating your zero-knowledge proof...</p>
        <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
      </div>
    );
  }

  if (!zkProof) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Generate Privacy-Preserving Proof</h2>
        
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-indigo-200 rounded-xl p-8 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Zero-Knowledge Proof</h3>
              <p className="text-gray-700 mb-4">
                Generate a cryptographic proof that your activity score is <strong>{activityScore.total}</strong> without revealing 
                your exact transaction history or wallet balance to lenders.
              </p>
              <div className="bg-white rounded-lg p-4 mb-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">What gets proven:</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>✅ Your activity score meets loan requirements</li>
                  <li>✅ Your wallet has transaction history</li>
                  <li>✅ You control the wallet address</li>
                </ul>
              </div>
              <div className="bg-white rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">What stays private:</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>🔒 Your exact activity score ({activityScore.total})</li>
                  <li>🔒 Your STRK balance</li>
                  <li>🔒 Your transaction history</li>
                  <li>🔒 Your wallet address</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={onGenerate}
          className="w-full px-6 py-4 bg-indigo-600 text-white text-lg font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Generate ZK Proof
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">ZK Proof Generated ✅</h2>

      <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-green-900">Proof Ready</h3>
            <p className="text-sm text-green-700">
              {proofCached ? '♻️ Loaded from cache' : '🆕 Newly generated'}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 space-y-3">
          <div>
            <p className="text-xs text-gray-500 mb-1">Commitment</p>
            <p className="text-sm font-mono text-gray-900 break-all">
              {zkProof.commitment}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Proof Hash</p>
            <p className="text-sm font-mono text-gray-900 break-all">
              {zkProof.proofHash}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Public Signals</p>
              <p className="text-sm font-semibold text-gray-900">
                {zkProof.publicSignals?.length || 0} signals
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Status</p>
              <p className="text-sm font-semibold text-green-600">Valid</p>
            </div>
          </div>
        </div>
      </div>

      {proofCached && zkProof.reason && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-900">
            ℹ️ This proof was retrieved from cache because: <strong>{zkProof.reason.replace(/_/g, ' ')}</strong>
          </p>
        </div>
      )}

      <div className="flex gap-4">
        <button
          onClick={onGenerate}
          className="flex-1 px-6 py-3 bg-white border-2 border-indigo-600 text-indigo-600 font-semibold rounded-lg hover:bg-indigo-50 transition-colors"
        >
          Regenerate Proof
        </button>
        <button
          onClick={onNext}
          className="flex-1 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Browse Loans →
        </button>
      </div>
    </div>
  );
}

/**
 * Step 4: Loan Selection Section
 */
function LoanSelectionSection({ activityScore, zkProof, onSelectLoan, isApplying }) {
  // MOCK LOAN (as requested - single loan provider)
  const mockLoan = {
    id: 1,
    providerAddress: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    name: "DeFi Lender Alpha",
    loanAmount: "50000000000000000000", // 50 STRK (wei)
    interestRate: 5, // 5%
    thresholdScore: 50, // Minimum activity score required
    repaymentPeriod: 600, // 10 minutes (600 seconds)
    repaymentAmount: "52500000000000000000", // 52.5 STRK (with interest)
    availableFunds: "1000000000000000000000", // 1000 STRK
    activeLoanCount: 0,
    maxActiveLoans: 10,
    terms: "Repay within 10 minutes or identity will be revealed to lender"
  };

  const loanAmountStrk = parseInt(mockLoan.loanAmount) / 1e18;
  const repaymentAmountStrk = parseInt(mockLoan.repaymentAmount) / 1e18;
  const eligibility = activityScoreCalculator.checkLoanEligibility(activityScore.total, mockLoan.thresholdScore);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Available Loans</h2>

      <div className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden hover:border-indigo-300 transition-colors">
        {/* Loan Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-2xl font-bold">{mockLoan.name}</h3>
            <div className="px-4 py-2 bg-white bg-opacity-20 rounded-full">
              <span className="text-sm font-semibold">Premium Lender</span>
            </div>
          </div>
          <p className="text-indigo-100 text-sm font-mono">
            {mockLoan.providerAddress.slice(0, 10)}...{mockLoan.providerAddress.slice(-8)}
          </p>
        </div>

        {/* Loan Details */}
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Loan Amount</p>
              <p className="text-2xl font-bold text-gray-900">{loanAmountStrk} STRK</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Interest Rate</p>
              <p className="text-2xl font-bold text-gray-900">{mockLoan.interestRate}%</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Repayment</p>
              <p className="text-2xl font-bold text-gray-900">{repaymentAmountStrk} STRK</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Duration</p>
              <p className="text-2xl font-bold text-gray-900">10 min</p>
            </div>
          </div>

          {/* Requirements */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h4 className="text-sm font-semibold text-blue-900 mb-3">📋 Requirements</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-800">Minimum Activity Score</span>
                <span className="text-sm font-bold text-blue-900">{mockLoan.thresholdScore}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-800">Your Score</span>
                <span className={`text-sm font-bold ${eligibility.eligible ? 'text-green-600' : 'text-red-600'}`}>
                  {activityScore.total}
                </span>
              </div>
            </div>
          </div>

          {/* Eligibility Check */}
          {eligibility.eligible ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-sm font-semibold text-green-900">{eligibility.message}</p>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <p className="text-sm font-semibold text-red-900">{eligibility.message}</p>
              </div>
            </div>
          )}

          {/* Terms */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-900">
              <strong>⚠️ Important:</strong> {mockLoan.terms}
            </p>
          </div>

          {/* Apply Button */}
          <button
            onClick={() => onSelectLoan(mockLoan)}
            disabled={!eligibility.eligible || isApplying || !zkProof}
            className="w-full px-6 py-4 bg-indigo-600 text-white text-lg font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isApplying ? 'Processing Application...' : `Apply for ${loanAmountStrk} STRK Loan`}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Step 5: Repayment Section
 */
function RepaymentSection({ loan, deadline, walletAddress, onRepay }) {
  const [timeLeft, setTimeLeft] = useState(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const remaining = deadline - now;

      if (remaining <= 0) {
        setIsExpired(true);
        setTimeLeft(0);
        clearInterval(timer);
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [deadline]);

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const loanAmountStrk = parseInt(loan.loanAmount) / 1e18;
  const repaymentAmountStrk = parseInt(loan.repaymentAmount) / 1e18;
  const progress = timeLeft ? ((loan.repaymentPeriod * 1000 - timeLeft) / (loan.repaymentPeriod * 1000)) * 100 : 100;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Active Loan - Repayment Required</h2>

      {/* Timer */}
      <div className={`rounded-xl p-8 mb-6 ${isExpired ? 'bg-red-500' : 'bg-gradient-to-r from-orange-500 to-red-500'} text-white`}>
        <div className="text-center mb-4">
          <p className="text-sm font-medium text-white text-opacity-90 mb-2">
            {isExpired ? '⏰ TIME EXPIRED' : '⏱️ Time Remaining'}
          </p>
          <p className="text-6xl font-bold tabular-nums">
            {timeLeft !== null ? formatTime(timeLeft) : '10:00'}
          </p>
        </div>
        
        <div className="w-full bg-white bg-opacity-20 rounded-full h-3 mb-4">
          <div
            className="bg-white h-3 rounded-full transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>

        {isExpired && (
          <div className="bg-white bg-opacity-20 rounded-lg p-4 text-center">
            <p className="font-bold text-lg mb-2">⚠️ LOAN DEFAULTED</p>
            <p className="text-sm">Your identity will be revealed to the lender for collection purposes</p>
          </div>
        )}
      </div>

      {/* Loan Details */}
      <div className="bg-white border-2 border-gray-200 rounded-xl p-6 mb-6">
        <h3 className="font-bold text-gray-900 mb-4">Loan Details</h3>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-500">Borrowed Amount</p>
            <p className="text-xl font-bold text-gray-900">{loanAmountStrk} STRK</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total to Repay</p>
            <p className="text-xl font-bold text-red-600">{repaymentAmountStrk} STRK</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Interest</p>
            <p className="text-sm font-medium text-gray-900">{loan.interestRate}%</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Deadline</p>
            <p className="text-sm font-medium text-gray-900">{new Date(deadline).toLocaleTimeString()}</p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Loan ID</p>
          <p className="text-sm font-mono text-gray-900">{loan.loanId}</p>
        </div>
      </div>

      {/* Repay Button */}
      <button
        onClick={onRepay}
        disabled={isExpired}
        className="w-full px-6 py-4 bg-green-600 text-white text-lg font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isExpired ? 'Loan Defaulted - Cannot Repay' : `Repay ${repaymentAmountStrk} STRK Now`}
      </button>

      {!isExpired && (
        <p className="text-center text-sm text-gray-500 mt-4">
          Make sure you have {repaymentAmountStrk} STRK in your wallet
        </p>
      )}
    </div>
  );
}
