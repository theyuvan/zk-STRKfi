import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp, DollarSign, ArrowUpRight, ArrowDownLeft, Loader } from 'lucide-react';
import { useWalletStore } from '../store/walletStore';
import { WalletAnalyzer } from '../services/walletAnalyzer';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';

function WalletActivityAnalysis({ onAnalysisComplete }) {
  const { evmProvider, evmAddress, starknetAddress, activeChain } = useWalletStore();
  
  const [loading, setLoading] = useState(false);
  const [activityData, setActivityData] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const analyzeWallet = async () => {
    setLoading(true);
    setAnalyzing(true);

    try {
      let analyzer;
      let address;

      if (activeChain === 'evm' && evmProvider) {
        address = evmAddress;
        analyzer = new WalletAnalyzer(evmProvider, address, 'evm');
      } else {
        // For StarkNet
        address = starknetAddress;
        analyzer = new WalletAnalyzer(null, address, 'starknet');
      }

      toast.loading('Analyzing your wallet activity...', { id: 'analysis' });
      
      const data = await analyzer.analyzeWallet();
      
      setActivityData(data);
      toast.success('Analysis complete!', { id: 'analysis' });

      if (onAnalysisComplete) {
        onAnalysisComplete(data);
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Analysis failed: ' + error.message, { id: 'analysis' });
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 700) return 'text-green-600';
    if (score >= 500) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score) => {
    if (score >= 700) return 'Excellent';
    if (score >= 500) return 'Good';
    if (score >= 300) return 'Fair';
    return 'Poor';
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Activity className="w-8 h-8 text-primary-600" />
          <h2 className="text-2xl font-bold text-gray-900">Wallet Activity Analysis</h2>
        </div>
        <button
          onClick={analyzeWallet}
          disabled={loading}
          className="btn-primary"
        >
          {loading ? (
            <span className="flex items-center">
              <Loader className="w-5 h-5 animate-spin mr-2" />
              Analyzing...
            </span>
          ) : (
            'Analyze Wallet'
          )}
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-800">
          <strong>On-Chain Verification:</strong> We analyze your wallet's transaction history 
          to determine your financial activity without accessing any personal information. 
          This is a privacy-preserving alternative to traditional bank statements.
        </p>
      </div>

      {!activityData && !analyzing && (
        <div className="text-center py-12">
          <Activity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">
            Click "Analyze Wallet" to evaluate your on-chain activity
          </p>
        </div>
      )}

      {analyzing && (
        <div className="text-center py-12">
          <Loader className="w-16 h-16 text-primary-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Analyzing your wallet transactions...</p>
        </div>
      )}

      {activityData && !analyzing && (
        <div className="space-y-6">
          {/* Activity Score */}
          <div className="bg-gradient-to-r from-primary-50 to-purple-50 rounded-xl p-6 border border-primary-200">
            <div className="text-center">
              <div className="text-sm text-gray-600 mb-2">Your Activity Score</div>
              <div className={`text-5xl font-bold ${getScoreColor(activityData.score)} mb-2`}>
                {activityData.score}
              </div>
              <div className="text-lg font-medium text-gray-700">
                {getScoreLabel(activityData.score)}
              </div>
              <div className="mt-4 text-xs text-gray-500">
                Score Range: 0 - 1000
              </div>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 text-gray-600 mb-2">
                <DollarSign className="w-4 h-4" />
                <span className="text-xs">Current Balance</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {activityData.currentBalance}
              </div>
              <div className="text-xs text-gray-500">ETH</div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 text-gray-600 mb-2">
                <Activity className="w-4 h-4" />
                <span className="text-xs">Transactions</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {activityData.transactionCount}
              </div>
              <div className="text-xs text-gray-500">Total</div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 text-gray-600 mb-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-xs">Balance Score</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {activityData.metrics?.balanceScore || 0}
              </div>
              <div className="text-xs text-gray-500">/ 400 points</div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 text-gray-600 mb-2">
                <ArrowUpRight className="w-4 h-4 text-blue-600" />
                <span className="text-xs">TX Score</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {activityData.metrics?.txScore || 0}
              </div>
              <div className="text-xs text-gray-500">/ 400 points</div>
            </div>
          </div>

          {/* Score Breakdown */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-bold text-gray-900 mb-4">Score Breakdown</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Balance Score</span>
                  <span className="font-medium">{Math.round(activityData.metrics.balanceScore)} / 400</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full" 
                    style={{ width: `${(activityData.metrics.balanceScore / 400) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Transaction Score</span>
                  <span className="font-medium">{Math.round(activityData.metrics.txScore)} / 400</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full" 
                    style={{ width: `${(activityData.metrics.txScore / 400) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Consistency Score</span>
                  <span className="font-medium">{Math.round(activityData.metrics.consistencyScore)} / 200</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-purple-600 h-2 rounded-full" 
                    style={{ width: `${(activityData.metrics.consistencyScore / 200) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Activity Summary */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-bold text-green-900 mb-2">Activity Summary</h3>
            <ul className="text-sm text-green-800 space-y-1">
              <li>• Total Transactions: {activityData.transactionCount}</li>
              <li>• Chain: {activityData.chainType === 'starknet' ? 'Starknet Sepolia' : 'EVM'}</li>
              <li>• Network Activity: {activityData.transactionCount > 100 ? 'High' : activityData.transactionCount > 10 ? 'Moderate' : 'Low'}</li>
              <li>• Address: {activityData.address?.slice(0, 10)}...{activityData.address?.slice(-8)}</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default WalletActivityAnalysis;
