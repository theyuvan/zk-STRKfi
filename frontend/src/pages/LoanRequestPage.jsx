import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Shield, Send, Loader, Activity } from 'lucide-react';
import { ethers } from 'ethers';
import { useWalletStore } from '../store/walletStore';
import { useLoanStore } from '../store/loanStore';
import WalletActivityAnalysis from '../components/WalletActivityAnalysis';
import ZKProofGenerator from '../components/ZKProofGenerator';
import FileUploader from '../components/FileUploader';
import { loanApi, identityApi } from '../services/api';
import StarkNetService from '../services/starknet';
import EVMService from '../services/evm';
import toast from 'react-hot-toast';

function LoanRequestPage() {
  const navigate = useNavigate();
  const { 
    starknetWallet, 
    evmSigner, 
    activeChain, 
    getActiveAddress,
    isConnected 
  } = useWalletStore();
  
  const { setLoanAmount, setIncomeThreshold } = useLoanStore();
  
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState('');
  const [activityData, setActivityData] = useState(null);
  const [proofData, setProofData] = useState(null);
  const [identityFile, setIdentityFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  const handleActivityAnalysisComplete = (data) => {
    setActivityData(data);
    toast.success('Wallet activity analyzed successfully!');
  };
  
  const handleProofGenerated = (proof) => {
    setProofData(proof);
    setStep(3); // Move to loan details step
  };
  
  const handleFileProcessed = (file) => {
    setIdentityFile(file);
  };
  
  const handleSubmitLoan = async () => {
    if (!isConnected()) {
      toast.error('Please connect your wallet first');
      return;
    }
    
    if (!amount || !proofData || !identityFile) {
      toast.error('Please complete all steps');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const borrowerAddress = getActiveAddress();
      
      // Step 1: Encrypt and upload identity
      toast.loading('Encrypting your identity...', { id: 'identity' });
      const identityResponse = await identityApi.encryptAndUpload(
        identityFile,
        borrowerAddress
      );
      toast.success('Identity encrypted and stored securely', { id: 'identity' });
      
      // Step 2: Distribute encryption key shares to trustees
      toast.loading('Distributing encryption keys...', { id: 'shares' });
      await identityApi.distributeShares(
        identityResponse.encryptionKey,
        borrowerAddress
      );
      toast.success('Keys distributed to trustees', { id: 'shares' });
      
      // Step 3: Submit loan request on-chain
      toast.loading('Submitting loan request...', { id: 'loan' });
      
      // Generate proof hash
      const proofHash = ethers.id(JSON.stringify(proofData.proof));
      
      let result;
      if (activeChain === 'starknet') {
        const starknetService = new StarkNetService(starknetWallet);
        result = await starknetService.createLoanRequest(
          parseFloat(amount),
          parseFloat(proofData.threshold),
          proofHash,
          proofData.commitment
        );
      } else {
        const evmService = new EVMService(evmSigner);
        result = await evmService.createLoanRequest(
          parseFloat(amount),
          parseFloat(proofData.threshold),
          proofHash,
          proofData.commitment
        );
      }
      
      toast.success('Loan request submitted successfully!', { id: 'loan' });
      
      // Save to store
      setLoanAmount(amount);
      setIncomeThreshold(proofData.threshold);
      
      // Redirect to dashboard
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
      
    } catch (error) {
      console.error('Loan submission error:', error);
      toast.error('Failed to submit loan: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };
  
  if (!isConnected()) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card text-center py-12">
          <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Wallet Connection Required
          </h2>
          <p className="text-gray-600 mb-6">
            Please connect your wallet to request a loan
          </p>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="btn-primary"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Request a Loan</h1>
        <p className="text-gray-600">
          Complete the steps below to submit your privacy-preserving loan request
        </p>
      </div>
      
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className={`flex-1 ${step >= 1 ? 'text-primary-600' : 'text-gray-400'}`}>
            <div className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                step >= 1 ? 'bg-primary-600 text-white' : 'bg-gray-200'
              }`}>
                1
              </div>
              <span className="ml-2 font-medium">Analyze & Prove</span>
            </div>
          </div>
          <div className={`flex-1 h-1 mx-4 ${step >= 2 ? 'bg-primary-600' : 'bg-gray-200'}`} />
          <div className={`flex-1 ${step >= 2 ? 'text-primary-600' : 'text-gray-400'}`}>
            <div className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                step >= 2 ? 'bg-primary-600 text-white' : 'bg-gray-200'
              }`}>
                2
              </div>
              <span className="ml-2 font-medium">Identity & Amount</span>
            </div>
          </div>
          <div className={`flex-1 h-1 mx-4 ${step >= 3 ? 'bg-primary-600' : 'bg-gray-200'}`} />
          <div className={`flex-1 ${step >= 3 ? 'text-primary-600' : 'text-gray-400'}`}>
            <div className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                step >= 3 ? 'bg-primary-600 text-white' : 'bg-gray-200'
              }`}>
                3
              </div>
              <span className="ml-2 font-medium">Submit</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Step 1: Wallet Activity & ZK Proof */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Wallet Activity Analysis */}
          <WalletActivityAnalysis onAnalysisComplete={handleActivityAnalysisComplete} />
          
          {/* ZK Proof Generator - Only shown after activity analysis */}
          {activityData && (
            <ZKProofGenerator 
              onProofGenerated={handleProofGenerated} 
              activityData={activityData}
            />
          )}
        </div>
      )}
      
      {/* Step 2: Identity & Amount */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
              <FileText className="w-6 h-6 mr-2 text-primary-600" />
              Upload Identity Document
            </h2>
            
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-4">
                Upload a document for identity verification (bank statement, ID, etc.).
                This will be encrypted and stored securely on IPFS.
              </p>
              <FileUploader
                onFileProcessed={handleFileProcessed}
                label="Upload Bank Statement or ID"
                accept=".pdf,.jpg,.jpeg,.png"
              />
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Privacy Protection:</strong> Your document will be encrypted with AES-256-GCM
                before upload. The encryption key is split using Shamir Secret Sharing and distributed
                to trustees. Only in case of default can the key be reconstructed.
              </p>
            </div>
          </div>
          
          <div className="card">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Loan Amount</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Requested Amount ($)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10000"
                className="input-field"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter the amount you wish to borrow
              </p>
            </div>
          </div>
          
          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="btn-secondary"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!amount || !identityFile}
              className="btn-primary"
            >
              Continue to Review
            </button>
          </div>
        </div>
      )}
      
      {/* Step 3: Review & Submit */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Review Your Request</h2>
            
            <div className="space-y-4">
              <div className="flex justify-between py-3 border-b border-gray-200">
                <span className="text-gray-600">Loan Amount</span>
                <span className="font-bold text-gray-900">${amount}</span>
              </div>
              
              <div className="flex justify-between py-3 border-b border-gray-200">
                <span className="text-gray-600">Income Threshold</span>
                <span className="font-bold text-gray-900">${proofData.threshold}</span>
              </div>
              
              <div className="flex justify-between py-3 border-b border-gray-200">
                <span className="text-gray-600">Identity Document</span>
                <span className="font-medium text-gray-900">{identityFile?.name}</span>
              </div>
              
              <div className="flex justify-between py-3 border-b border-gray-200">
                <span className="text-gray-600">ZK Proof Status</span>
                <span className="text-green-600 font-medium">✓ Generated</span>
              </div>
              
              <div className="flex justify-between py-3">
                <span className="text-gray-600">Blockchain</span>
                <span className="font-medium text-gray-900">
                  {activeChain === 'starknet' ? 'StarkNet' : 'Ethereum'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="card bg-green-50 border-2 border-green-200">
            <h3 className="font-bold text-green-900 mb-3">What happens next?</h3>
            <ul className="space-y-2 text-sm text-green-800">
              <li>• Your identity document will be encrypted and uploaded to IPFS</li>
              <li>• Encryption keys will be distributed to trusted nodes</li>
              <li>• Your loan request will be submitted on-chain with the ZK proof</li>
              <li>• Lenders can verify your eligibility without accessing your private data</li>
            </ul>
          </div>
          
          <div className="flex justify-between">
            <button
              onClick={() => setStep(2)}
              className="btn-secondary"
              disabled={submitting}
            >
              Back
            </button>
            <button
              onClick={handleSubmitLoan}
              disabled={submitting}
              className="btn-primary inline-flex items-center"
            >
              {submitting ? (
                <>
                  <Loader className="w-5 h-5 animate-spin mr-2" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  Submit Loan Request
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default LoanRequestPage;
