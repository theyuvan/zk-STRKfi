import React, { useState, useEffect } from 'react';
import { Wallet, TrendingUp, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useWalletStore } from '../store/walletStore';
import { loanApi } from '../services/api';
import toast from 'react-hot-toast';

function LoanDashboard() {
  const { getActiveAddress, isConnected } = useWalletStore();
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (isConnected()) {
      loadUserLoans();
    }
  }, [isConnected()]);
  
  const loadUserLoans = async () => {
    try {
      const address = getActiveAddress();
      const userLoans = await loanApi.getUserLoans(address);
      setLoans(userLoans);
    } catch (error) {
      console.error('Failed to load loans:', error);
      toast.error('Failed to load your loans');
    } finally {
      setLoading(false);
    }
  };
  
  const getStatusColor = (state) => {
    switch (state) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'defaulted': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  const getStatusIcon = (state) => {
    switch (state) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'active': return <TrendingUp className="w-4 h-4" />;
      case 'paid': return <CheckCircle className="w-4 h-4" />;
      case 'defaulted': return <AlertCircle className="w-4 h-4" />;
      default: return null;
    }
  };
  
  if (!isConnected()) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card text-center py-12">
          <Wallet className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Wallet Connection Required
          </h2>
          <p className="text-gray-600">
            Please connect your wallet to view your loan dashboard
          </p>
        </div>
      </div>
    );
  }
  
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your loans...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Loan Dashboard</h1>
        <p className="text-gray-600">
          View and manage your loan requests and active loans
        </p>
      </div>
      
      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="text-sm text-gray-600 mb-1">Total Loans</div>
          <div className="text-2xl font-bold text-gray-900">{loans.length}</div>
        </div>
        
        <div className="card">
          <div className="text-sm text-gray-600 mb-1">Pending</div>
          <div className="text-2xl font-bold text-yellow-600">
            {loans.filter(l => l.state === 'pending').length}
          </div>
        </div>
        
        <div className="card">
          <div className="text-sm text-gray-600 mb-1">Active</div>
          <div className="text-2xl font-bold text-blue-600">
            {loans.filter(l => l.state === 'active').length}
          </div>
        </div>
        
        <div className="card">
          <div className="text-sm text-gray-600 mb-1">Completed</div>
          <div className="text-2xl font-bold text-green-600">
            {loans.filter(l => l.state === 'paid').length}
          </div>
        </div>
      </div>
      
      {/* Loans List */}
      {loans.length === 0 ? (
        <div className="card text-center py-12">
          <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Loans Yet</h3>
          <p className="text-gray-600 mb-6">
            You haven't requested any loans yet
          </p>
          <a href="/request" className="btn-primary inline-block">
            Request Your First Loan
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Your Loans</h2>
          
          {loans.map((loan) => (
            <div key={loan.id} className="card hover:shadow-xl transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <span className="text-lg font-bold text-gray-900">
                      Loan #{loan.id}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${getStatusColor(loan.state)}`}>
                      {getStatusIcon(loan.state)}
                      <span className="capitalize">{loan.state}</span>
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-gray-600">Amount</div>
                      <div className="font-bold text-gray-900">${loan.amount}</div>
                    </div>
                    
                    <div>
                      <div className="text-gray-600">Threshold</div>
                      <div className="font-medium text-gray-900">${loan.threshold}</div>
                    </div>
                    
                    <div>
                      <div className="text-gray-600">Created</div>
                      <div className="font-medium text-gray-900">
                        {new Date(loan.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    
                    {loan.state === 'active' && (
                      <div>
                        <div className="text-gray-600">Total Paid</div>
                        <div className="font-medium text-gray-900">${loan.totalPaid || 0}</div>
                      </div>
                    )}
                  </div>
                  
                  {loan.lender && (
                    <div className="mt-3 text-xs text-gray-500">
                      <span className="font-medium">Lender:</span> {loan.lender.slice(0, 10)}...{loan.lender.slice(-8)}
                    </div>
                  )}
                </div>
                
                <div className="ml-4">
                  <button className="btn-secondary text-sm px-4 py-2">
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default LoanDashboard;
