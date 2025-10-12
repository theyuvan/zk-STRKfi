import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Activity, Shield, DollarSign, Send, Loader, CheckCircle } from 'lucide-react';
import { ethers } from 'ethers';
import { useWalletStore } from '../store/walletStore';
import { WalletAnalyzer, generateEphemeralWallet } from '../services/walletAnalyzer';
import { LoanMarketplace } from '../components/LoanMarketplace';
import toast from 'react-hot-toast';

/**
 * Complete Web3 Loan Application Flow
 * 1. Connect Wallet (Starknet or EVM)
 * 2. Analyze Wallet Activity (from blockchain)
 * 3. Generate ZK Proof (privacy-preserving)
 * 4. Select Loan from Marketplace
 * 5. Apply with Proof (funds to original wallet)
 */
function LoanRequestPage() {
  const navigate = useNavigate();
  const {
    starknetAddress,
    evmAddress,
    starknetConnected,
    evmConnected,
    starknetWallet,
    evmProvider,
    connectStarkNet,
    connectEVM,
    activeChain
  } = useWalletStore();

  const [step, setStep] = useState(1);
  const [analyzing, setAnalyzing] = useState(false);
  const [activityData, setActivityData] = useState(null);
  const [zkProof, setZkProof] = useState(null);
  const [ephemeralWallet, setEphemeralWallet] = useState(null);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [identityCID, setIdentityCID] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isConnected = starknetConnected || evmConnected;
  const currentAddress = starknetConnected ? starknetAddress : evmAddress;

  /**
   * Step 1: Connect Wallet
   */
  const handleConnectWallet = async (chainType) => {
    try {
      if (chainType === 'starknet') {
        await connectStarkNet();
        toast.success('Starknet wallet connected!');
      } else {
        await connectEVM();
        toast.success('EVM wallet connected!');
      }
      setStep(2);
    } catch (error) {
      console.error('Connection error:', error);
      toast.error('Failed to connect wallet: ' + error.message);
    }
  };

  /**
   * Step 2: Analyze Wallet Activity from Blockchain
   */
  const handleAnalyzeActivity = async () => {
    try {
      setAnalyzing(true);

      const chainType = starknetConnected ? 'starknet' : 'evm';
      const provider = starknetConnected ? starknetWallet : evmProvider;
      const address = currentAddress;

      const analyzer = new WalletAnalyzer(provider, address, chainType);
      const activity = await analyzer.analyzeWallet();

      setActivityData(activity);
      
      // Generate ephemeral wallet for display
      const ephemeral = generateEphemeralWallet();
      setEphemeralWallet(ephemeral);

      toast.success(`Activity score: ${activity.score}/1000`);
      setStep(3);
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze wallet: ' + error.message);
    } finally {
      setAnalyzing(false);
    }
  };

  /**
   * Step 3: Generate ZK Proof
   */
  const handleGenerateProof = async () => {
    try {
      // In production, this would call actual ZK circuit
      // For now, we create a proof object
      const proof = {
        score: activityData.score,
        threshold: 500,
        verified: activityData.score >= 500,
        timestamp: Date.now(),
        proofHash: ethers.keccak256(
          ethers.toUtf8Bytes(JSON.stringify({
            score: activityData.score,
            address: currentAddress,
            timestamp: Date.now()
          }))
        )
      };

      setZkProof(proof);
      
      if (proof.verified) {
        toast.success('ZK Proof generated - you are eligible!');
        setStep(4);
      } else {
        toast.error('Activity score too low - need minimum 500 points');
      }
    } catch (error) {
      console.error('Proof generation error:', error);
      toast.error('Failed to generate proof');
    }
  };

  /**
   * Step 4: Select Loan from Marketplace
   */
  const handleSelectLoan = (loan) => {
    setSelectedLoan(loan);
    setStep(5);
  };

  /**
   * Step 5: Upload Identity to IPFS and Apply for Loan
   */
  const handleApplyForLoan = async () => {
    try {
      setSubmitting(true);

      // TODO: Upload identity document to IPFS
      // For now, use mock CID
      const mockCID = 'Qm' + Math.random().toString(36).substring(7);
      setIdentityCID(mockCID);

      // Prepare loan request data
      const loanRequest = {
        borrower: currentAddress,
        ephemeralAddress: ephemeralWallet.address,
        amount: selectedLoan.amount,
        proofHash: zkProof.proofHash,
        identityCID: mockCID,
        loanOfferId: selectedLoan.id,
        timestamp: Date.now()
      };

      // TODO: Submit to smart contract
      // const tx = await escrowContract.createLoanRequest(...)
      
      console.log('Loan request submitted:', loanRequest);
      
      toast.success('Loan application submitted successfully!');
      setStep(6);
      
      // Navigate to dashboard after 2 seconds
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (error) {
      console.error('Submission error:', error);
      toast.error('Failed to submit loan application');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: 'Connect', icon: Wallet },
              { num: 2, label: 'Analyze', icon: Activity },
              { num: 3, label: 'Proof', icon: Shield },
              { num: 4, label: 'Select Loan', icon: DollarSign },
              { num: 5, label: 'Apply', icon: Send },
              { num: 6, label: 'Complete', icon: CheckCircle }
            ].map((s, idx) => (
              <div key={s.num} className="flex items-center">
                <div
                  className={`flex flex-col items-center ${
                    step >= s.num ? 'text-blue-600' : 'text-gray-400'
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      step >= s.num
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    <s.icon className="w-6 h-6" />
                  </div>
                  <span className="text-xs mt-2 font-medium">{s.label}</span>
                </div>
                {idx < 5 && (
                  <div
                    className={`h-1 w-12 mx-2 ${
                      step > s.num ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Step 1: Connect Wallet */}
          {step === 1 && (
            <div className="text-center space-y-6">
              <h2 className="text-3xl font-bold text-gray-800">Connect Your Wallet</h2>
              <p className="text-gray-600">
                Connect with Starknet testnet or EVM wallet to get started
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                <button
                  onClick={() => handleConnectWallet('starknet')}
                  className="p-6 border-2 border-purple-300 rounded-xl hover:bg-purple-50 hover:border-purple-500 transition-all"
                >
                  <Shield className="w-16 h-16 mx-auto text-purple-600 mb-4" />
                  <h3 className="font-bold text-lg mb-2">Starknet</h3>
                  <p className="text-sm text-gray-600">Connect Starknet wallet (Recommended)</p>
                </button>
                <button
                  onClick={() => handleConnectWallet('evm')}
                  className="p-6 border-2 border-blue-300 rounded-xl hover:bg-blue-50 hover:border-blue-500 transition-all"
                >
                  <Wallet className="w-16 h-16 mx-auto text-blue-600 mb-4" />
                  <h3 className="font-bold text-lg mb-2">MetaMask</h3>
                  <p className="text-sm text-gray-600">Connect EVM wallet</p>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Analyze Wallet */}
          {step === 2 && (
            <div className="text-center space-y-6">
              <h2 className="text-3xl font-bold text-gray-800">Analyze Wallet Activity</h2>
              <p className="text-gray-600">
                Connected: <span className="font-mono text-sm">{currentAddress}</span>
              </p>
              <div className="bg-blue-50 p-6 rounded-xl">
                <Activity className="w-16 h-16 mx-auto text-blue-600 mb-4" />
                <p className="text-gray-700 mb-4">
                  We'll analyze your on-chain transaction history to calculate your activity score.
                  This is used for ZK proof generation.
                </p>
                <button
                  onClick={handleAnalyzeActivity}
                  disabled={analyzing}
                  className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {analyzing ? (
                    <>
                      <Loader className="w-5 h-5 inline animate-spin mr-2" />
                      Analyzing Transactions...
                    </>
                  ) : (
                    'Start Analysis'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Generate ZK Proof */}
          {step === 3 && activityData && (
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-gray-800 text-center">
                Your Activity Score
              </h2>
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-8 rounded-xl text-white text-center">
                <h3 className="text-6xl font-bold mb-2">{activityData.score}</h3>
                <p className="text-xl">out of 1000 points</p>
                <div className="mt-6 grid grid-cols-3 gap-4 text-sm">
                  <div className="bg-white/20 p-3 rounded-lg">
                    <div className="font-bold">{activityData.metrics.balanceScore}</div>
                    <div className="text-xs">Balance Score</div>
                  </div>
                  <div className="bg-white/20 p-3 rounded-lg">
                    <div className="font-bold">{activityData.metrics.txScore}</div>
                    <div className="text-xs">Transaction Score</div>
                  </div>
                  <div className="bg-white/20 p-3 rounded-lg">
                    <div className="font-bold">{activityData.metrics.consistencyScore}</div>
                    <div className="text-xs">Consistency Score</div>
                  </div>
                </div>
              </div>
              <div className="text-center">
                <p className="text-gray-600 mb-4">
                  Minimum score needed: <span className="font-bold">500</span>
                </p>
                {activityData.score >= 500 ? (
                  <div className="bg-green-50 border border-green-200 p-4 rounded-lg mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                    <p className="text-green-700 font-semibold">
                      You are eligible for a loan!
                    </p>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 p-4 rounded-lg mb-4">
                    <p className="text-red-700 font-semibold">
                      Score too low. Need {500 - activityData.score} more points.
                    </p>
                  </div>
                )}
                <button
                  onClick={handleGenerateProof}
                  className="bg-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-purple-700"
                >
                  Generate ZK Proof
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Select Loan */}
          {step === 4 && zkProof && (
            <div>
              <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">
                Select a Loan
              </h2>
              <LoanMarketplace
                onSelectLoan={handleSelectLoan}
                activityScore={activityData.score}
              />
            </div>
          )}

          {/* Step 5: Apply for Loan */}
          {step === 5 && selectedLoan && (
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-gray-800 text-center">
                Confirm Loan Application
              </h2>
              <div className="bg-blue-50 p-6 rounded-xl space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Loan Amount:</span>
                  <span className="font-bold">{ethers.formatEther(selectedLoan.amount)} ETH</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Interest Rate:</span>
                  <span className="font-bold">{selectedLoan.interestRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Repayment Term:</span>
                  <span className="font-bold">{selectedLoan.termDays} days</span>
                </div>
                <div className="flex justify-between border-t pt-4">
                  <span className="text-gray-600">Your Wallet:</span>
                  <span className="font-mono text-sm">{currentAddress.slice(0, 6)}...{currentAddress.slice(-4)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Ephemeral Address:</span>
                  <span className="font-mono text-sm">{ephemeralWallet.address.slice(0, 6)}...{ephemeralWallet.address.slice(-4)}</span>
                </div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Privacy Note:</strong> Loan funds will be sent to your connected wallet ({currentAddress.slice(0, 6)}...).
                  The ephemeral address is for display only. Your identity remains private unless you default on repayment.
                </p>
              </div>
              <button
                onClick={handleApplyForLoan}
                disabled={submitting}
                className="w-full bg-green-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400"
              >
                {submitting ? (
                  <>
                    <Loader className="w-5 h-5 inline animate-spin mr-2" />
                    Submitting Application...
                  </>
                ) : (
                  'Submit Loan Application'
                )}
              </button>
            </div>
          )}

          {/* Step 6: Success */}
          {step === 6 && (
            <div className="text-center space-y-6">
              <CheckCircle className="w-24 h-24 text-green-600 mx-auto" />
              <h2 className="text-3xl font-bold text-gray-800">Application Submitted!</h2>
              <p className="text-gray-600">
                Your loan application has been submitted. Once approved by the lender,
                funds will be transferred to your wallet.
              </p>
              <button
                onClick={() => navigate('/dashboard')}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700"
              >
                View Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoanRequestPage;
