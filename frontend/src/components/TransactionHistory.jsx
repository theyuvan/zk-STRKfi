import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './TransactionHistory.css';

/**
 * Transaction History Component
 * Displays real wallet transactions with sent/received breakdown
 */
const TransactionHistory = ({ walletAddress, onScoreCalculated }) => {
  const [loading, setLoading] = useState(false);
  const [activityData, setActivityData] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'sent', 'received'

  useEffect(() => {
    if (walletAddress) {
      fetchActivityData();
    }
  }, [walletAddress]);

  const fetchActivityData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('📊 Fetching real activity data for:', walletAddress);
      
      const response = await axios.get(`http://localhost:3000/api/activity/${walletAddress}`);
      
      if (response.data.success) {
        setActivityData(response.data.data);
        
        // Notify parent component of calculated score
        if (onScoreCalculated) {
          onScoreCalculated(response.data.data.score);
        }
        
        console.log('✅ Activity data loaded:', response.data.data);
      } else {
        setError('Failed to load activity data');
      }
    } catch (err) {
      console.error('❌ Error fetching activity:', err);
      setError(err.response?.data?.error || err.message || 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="transaction-history loading">
        <div className="loader"></div>
        <p>🔍 Scanning blockchain for your transactions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="transaction-history error">
        <p>❌ {error}</p>
        <button onClick={fetchActivityData}>🔄 Retry</button>
      </div>
    );
  }

  if (!activityData) {
    return (
      <div className="transaction-history empty">
        <p>Connect wallet to see your transaction history</p>
      </div>
    );
  }

  const allTransactions = [
    ...activityData.sentTransactions.transactions.map(tx => ({ ...tx, type: 'sent' })),
    ...activityData.receivedTransactions.transactions.map(tx => ({ ...tx, type: 'received' }))
  ].sort((a, b) => b.blockNumber - a.blockNumber); // Sort by block number descending

  const displayTransactions = 
    activeTab === 'all' ? allTransactions :
    activeTab === 'sent' ? activityData.sentTransactions.transactions :
    activityData.receivedTransactions.transactions;

  return (
    <div className="transaction-history">
      {/* Activity Score Card */}
      <div className="activity-score-card">
        <div className="score-section">
          <div className="score-big">{activityData.score}</div>
          <div className="score-label">Activity Score</div>
          <div className="score-max">out of 1000</div>
        </div>
        
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-value">{activityData.totalTransactions}</span>
            <span className="stat-label">Total Transactions</span>
          </div>
          <div className="stat-item sent">
            <span className="stat-value">{activityData.sentTransactions.count}</span>
            <span className="stat-label">📤 Sent</span>
          </div>
          <div className="stat-item received">
            <span className="stat-value">{activityData.receivedTransactions.count}</span>
            <span className="stat-label">📥 Received</span>
          </div>
          <div className="stat-item volume">
            <span className="stat-value">{activityData.totalVolumeFormatted}</span>
            <span className="stat-label">Total Volume</span>
          </div>
        </div>
      </div>

      {/* Transaction Breakdown */}
      <div className="transaction-breakdown">
        <div className="breakdown-item sent">
          <div className="breakdown-header">
            <span className="breakdown-icon">📤</span>
            <span className="breakdown-title">Sent</span>
          </div>
          <div className="breakdown-amount">{activityData.sentTransactions.totalAmountFormatted}</div>
          <div className="breakdown-count">{activityData.sentTransactions.count} transactions</div>
        </div>
        
        <div className="breakdown-item received">
          <div className="breakdown-header">
            <span className="breakdown-icon">📥</span>
            <span className="breakdown-title">Received</span>
          </div>
          <div className="breakdown-amount">{activityData.receivedTransactions.totalAmountFormatted}</div>
          <div className="breakdown-count">{activityData.receivedTransactions.count} transactions</div>
        </div>
      </div>

      {/* Transaction Tabs */}
      <div className="transaction-tabs">
        <button
          className={`tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          📋 All ({allTransactions.length})
        </button>
        <button
          className={`tab ${activeTab === 'sent' ? 'active' : ''}`}
          onClick={() => setActiveTab('sent')}
        >
          📤 Sent ({activityData.sentTransactions.count})
        </button>
        <button
          className={`tab ${activeTab === 'received' ? 'active' : ''}`}
          onClick={() => setActiveTab('received')}
        >
          📥 Received ({activityData.receivedTransactions.count})
        </button>
        
        <button
          className="refresh-btn"
          onClick={fetchActivityData}
          title="Refresh from blockchain"
        >
          🔄
        </button>
      </div>

      {/* Transaction List */}
      <div className="transaction-list">
        {displayTransactions.length === 0 ? (
          <div className="empty-transactions">
            <p>No {activeTab !== 'all' ? activeTab : ''} transactions found</p>
            <small>Transactions from the last ~1000 blocks</small>
          </div>
        ) : (
          displayTransactions.map((tx, idx) => (
            <div key={idx} className={`transaction-item ${tx.type}`}>
              <div className="tx-icon">
                {tx.type === 'sent' ? '📤' : '📥'}
              </div>
              
              <div className="tx-details">
                <div className="tx-hash">
                  <a 
                    href={`https://sepolia.voyager.online/tx/${tx.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-8)}
                  </a>
                </div>
                <div className="tx-addresses">
                  <span className="address-label">
                    {tx.type === 'sent' ? 'To:' : 'From:'}
                  </span>
                  <span className="address-value">
                    {(tx.type === 'sent' ? tx.to : tx.from).slice(0, 8)}...
                  </span>
                </div>
              </div>
              
              <div className="tx-amount">
                <span className={`amount-value ${tx.type}`}>
                  {tx.type === 'sent' ? '-' : '+'}{tx.amountFormatted}
                </span>
                <span className="block-number">Block #{tx.blockNumber}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Data Source Indicator */}
      <div className="data-source">
        <span className="source-badge">
          ✅ Real Data from {activityData.dataSource}
        </span>
        <span className="timestamp">
          Updated: {new Date(activityData.timestamp).toLocaleString()}
        </span>
      </div>
    </div>
  );
};

export default TransactionHistory;
