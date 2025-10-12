import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Lock, Zap, CheckCircle, ArrowRight } from 'lucide-react';

function HomePage() {
  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="text-center py-16">
        <div className="inline-block p-3 bg-primary-100 rounded-full mb-6">
          <Shield className="w-16 h-16 text-primary-600" />
        </div>
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Privacy-Preserving Lending
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
          Prove your income eligibility without revealing sensitive financial data.
          Built with Zero-Knowledge proofs on StarkNet for maximum privacy.
        </p>
        <div className="flex justify-center space-x-4">
          <Link to="/request" className="btn-primary inline-flex items-center">
            Request a Loan
            <ArrowRight className="w-5 h-5 ml-2" />
          </Link>
          <Link to="/dashboard" className="btn-secondary">
            View Dashboard
          </Link>
        </div>
      </section>
      
      {/* Features */}
      <section className="grid md:grid-cols-3 gap-8">
        <div className="card text-center">
          <div className="inline-block p-3 bg-purple-100 rounded-full mb-4">
            <Lock className="w-8 h-8 text-purple-600" />
          </div>
          <h3 className="text-xl font-bold mb-3">Zero-Knowledge Proofs</h3>
          <p className="text-gray-600">
            Prove your income meets the threshold without revealing your exact salary
            using advanced cryptographic techniques.
          </p>
        </div>
        
        <div className="card text-center">
          <div className="inline-block p-3 bg-blue-100 rounded-full mb-4">
            <Shield className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-xl font-bold mb-3">Encrypted Identity</h3>
          <p className="text-gray-600">
            Your identity is encrypted and stored on IPFS with Shamir Secret Sharing
            for secure recovery only when needed.
          </p>
        </div>
        
        <div className="card text-center">
          <div className="inline-block p-3 bg-green-100 rounded-full mb-4">
            <Zap className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-xl font-bold mb-3">Smart Contract Escrow</h3>
          <p className="text-gray-600">
            Loans managed on-chain with automatic escrow, payment tracking,
            and default handling via StarkNet.
          </p>
        </div>
      </section>
      
      {/* How it Works */}
      <section className="card">
        <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
        
        <div className="space-y-8">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 w-12 h-12 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
              1
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2">Connect Your Wallet</h3>
              <p className="text-gray-600">
                Connect your StarkNet wallet (Argent, Braavos) or MetaMask to get started.
                All transactions are signed client-side for maximum security.
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 w-12 h-12 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
              2
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2">Verify Your Income</h3>
              <p className="text-gray-600">
                Upload your bank statement or connect to payroll providers (Plaid, ADP).
                Generate a Zero-Knowledge proof that you meet the income threshold.
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 w-12 h-12 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
              3
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2">Submit Loan Request</h3>
              <p className="text-gray-600">
                Your ZK proof and encrypted identity are submitted on-chain.
                Lenders can verify your eligibility without seeing your private data.
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 w-12 h-12 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
              4
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2">Get Funded</h3>
              <p className="text-gray-600">
                Once approved, receive your loan directly to your wallet.
                Make payments on-chain with automatic tracking.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Security Notice */}
      <section className="card bg-yellow-50 border-2 border-yellow-200">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center">
              <Shield className="w-6 h-6 text-yellow-900" />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-bold text-yellow-900 mb-2">
              Demo Application - Security Notice
            </h3>
            <p className="text-yellow-800 mb-4">
              This is a demonstration of privacy-preserving lending technology.
              <strong> Do not use with real funds or sensitive personal information.</strong>
            </p>
            <ul className="space-y-2 text-sm text-yellow-700">
              <li className="flex items-start">
                <CheckCircle className="w-4 h-4 mr-2 mt-0.5" />
                <span>All wallet signing happens client-side</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="w-4 h-4 mr-2 mt-0.5" />
                <span>No private keys are stored or transmitted</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="w-4 h-4 mr-2 mt-0.5" />
                <span>Smart contracts are deployed on testnets only</span>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

export default HomePage;
