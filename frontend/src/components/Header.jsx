import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Shield, Wallet } from 'lucide-react';
import WalletConnect from './WalletConnect';

function Header() {
  const location = useLocation();
  
  const isActive = (path) => {
    return location.pathname === path;
  };
  
  return (
    <header className="bg-white shadow-md">
      <nav className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2">
            <Shield className="w-8 h-8 text-primary-600" />
            <span className="text-xl font-bold text-gray-800">
              ZK Affordability Loan
            </span>
          </Link>
          
          <div className="flex items-center space-x-6">
            <Link
              to="/"
              className={`font-medium transition-colors ${
                isActive('/') ? 'text-primary-600' : 'text-gray-600 hover:text-primary-600'
              }`}
            >
              Home
            </Link>
            <Link
              to="/request"
              className={`font-medium transition-colors ${
                isActive('/request') ? 'text-primary-600' : 'text-gray-600 hover:text-primary-600'
              }`}
            >
              Request Loan
            </Link>
            <Link
              to="/dashboard"
              className={`font-medium transition-colors ${
                isActive('/dashboard') ? 'text-primary-600' : 'text-gray-600 hover:text-primary-600'
              }`}
            >
              Dashboard
            </Link>
            
            <WalletConnect />
          </div>
        </div>
      </nav>
    </header>
  );
}

export default Header;
