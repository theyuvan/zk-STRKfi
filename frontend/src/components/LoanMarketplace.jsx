import React, { useState, useEffect } from 'react';
import { DollarSign, Clock, TrendingUp, User, Shield } from 'lucide-react';
import { ethers } from 'ethers';

/**
 * LoanMarketplace - Display available loans from banks and anonymous lenders
 * All data fetched from on-chain registry - NO database
 */
export function LoanMarketplace({ onSelectLoan, activityScore }) {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAvailableLoans();
  }, []);

  /**
   * Fetch available loans from on-chain registry
   * In production, this would query a LoanRegistry contract
   */
  const fetchAvailableLoans = async () => {
    try {
      setLoading(true);
      
      // TODO: Replace with actual contract call
      // const registry = new ethers.Contract(REGISTRY_ADDRESS, ABI, provider);
      // const availableLoans = await registry.getAvailableLoans();
      
      // Mock data for now - in production this comes from blockchain
      const mockLoans = [
        {
          id: 1,
          provider: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
          providerType: 'bank',
          providerName: 'DeFi Bank',
          amount: ethers.parseEther('1.0'),
          minActivityScore: 400,
          interestRate: 5.0, // 5% APR
          termDays: 30,
          maxBorrowers: 10,
          currentBorrowers: 3,
          verified: true
        },
        {
          id: 2,
          provider: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
          providerType: 'anonymous',
          providerName: 'Anonymous Lender',
          amount: ethers.parseEther('0.5'),
          minActivityScore: 300,
          interestRate: 8.0, // 8% APR
          termDays: 15,
          maxBorrowers: 5,
          currentBorrowers: 1,
          verified: false
        },
        {
          id: 3,
          provider: '0xdD2FD4581271e230360230F9337D5c0430Bf44C0',
          providerType: 'bank',
          providerName: 'Crypto Credit Union',
          amount: ethers.parseEther('2.0'),
          minActivityScore: 600,
          interestRate: 4.0, // 4% APR
          termDays: 60,
          maxBorrowers: 20,
          currentBorrowers: 8,
          verified: true
        },
        {
          id: 4,
          provider: '0xbDA5747bFD65F08deb54cb465eB87D40e51B197E',
          providerType: 'anonymous',
          providerName: 'Private Lender #1337',
          amount: ethers.parseEther('0.3'),
          minActivityScore: 250,
          interestRate: 10.0, // 10% APR
          termDays: 7,
          maxBorrowers: 3,
          currentBorrowers: 0,
          verified: false
        }
      ];

      setLoans(mockLoans);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching loans:', error);
      setLoading(false);
    }
  };

  const isEligible = (loan) => {
    return activityScore >= loan.minActivityScore;
  };

  const calculateRepayment = (loan) => {
    const amountEth = parseFloat(ethers.formatEther(loan.amount));
    const interest = (amountEth * loan.interestRate) / 100;
    const total = amountEth + interest;
    return total.toFixed(4);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading available loans...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-xl border border-blue-200">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Available Loans</h2>
        <p className="text-gray-600">
          Your activity score: <span className="font-bold text-blue-600">{activityScore}</span>
          {' '}- Select a loan you're eligible for
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loans.map((loan) => {
          const eligible = isEligible(loan);
          const repaymentAmount = calculateRepayment(loan);
          const availableSlots = loan.maxBorrowers - loan.currentBorrowers;

          return (
            <div
              key={loan.id}
              className={`bg-white rounded-xl shadow-md border-2 transition-all ${
                eligible
                  ? 'border-green-300 hover:shadow-lg hover:scale-105'
                  : 'border-gray-200 opacity-60'
              }`}
            >
              <div className="p-6">
                {/* Provider Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    {loan.providerType === 'bank' ? (
                      <Shield className="w-8 h-8 text-blue-600" />
                    ) : (
                      <User className="w-8 h-8 text-purple-600" />
                    )}
                    <div>
                      <h3 className="font-bold text-lg text-gray-800">
                        {loan.providerName}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {loan.providerType === 'bank' ? 'Verified Bank' : 'Anonymous'}
                      </p>
                    </div>
                  </div>
                  {eligible ? (
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                      ✓ Eligible
                    </span>
                  ) : (
                    <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium">
                      Not Eligible
                    </span>
                  )}
                </div>

                {/* Loan Details */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-gray-600">
                      <DollarSign className="w-5 h-5" />
                      <span>Loan Amount:</span>
                    </div>
                    <span className="font-bold text-xl text-gray-800">
                      {ethers.formatEther(loan.amount)} ETH
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-gray-600">
                      <TrendingUp className="w-5 h-5" />
                      <span>Interest Rate:</span>
                    </div>
                    <span className="font-semibold text-gray-800">
                      {loan.interestRate}% APR
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-gray-600">
                      <Clock className="w-5 h-5" />
                      <span>Repayment Term:</span>
                    </div>
                    <span className="font-semibold text-gray-800">
                      {loan.termDays} days
                    </span>
                  </div>

                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Total Repayment:</span>
                      <span className="font-bold text-lg text-blue-600">
                        {repaymentAmount} ETH
                      </span>
                    </div>
                  </div>
                </div>

                {/* Requirements */}
                <div className="bg-gray-50 p-3 rounded-lg mb-4">
                  <p className="text-sm text-gray-600 mb-1">
                    <span className="font-semibold">Min. Activity Score:</span>{' '}
                    <span className={activityScore >= loan.minActivityScore ? 'text-green-600' : 'text-red-600'}>
                      {loan.minActivityScore}
                    </span>
                    {activityScore < loan.minActivityScore && (
                      <span className="text-red-600 ml-2">
                        (Need {loan.minActivityScore - activityScore} more)
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">Available Slots:</span>{' '}
                    {availableSlots} / {loan.maxBorrowers}
                  </p>
                </div>

                {/* Apply Button */}
                <button
                  onClick={() => onSelectLoan(loan)}
                  disabled={!eligible || availableSlots === 0}
                  className={`w-full py-3 rounded-lg font-semibold transition-all ${
                    eligible && availableSlots > 0
                      ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {!eligible
                    ? 'Increase Activity Score'
                    : availableSlots === 0
                    ? 'No Slots Available'
                    : 'Apply for Loan'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Information Footer */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">How it works:</h4>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Loans are funded by verified banks or anonymous lenders</li>
          <li>Your identity is private - only revealed to lender if you default</li>
          <li>Funds go directly to your connected wallet address</li>
          <li>Repay before deadline to keep your identity private</li>
        </ul>
      </div>
    </div>
  );
}
