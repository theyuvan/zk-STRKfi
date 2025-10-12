import React from 'react';
import { Link } from 'react-router-dom';

function PayrollConnectPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Connect Payroll</h1>
        <p className="text-gray-600">
          Connect to your payroll provider for automated income verification
        </p>
      </div>
      
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Available Providers</h2>
        
        <div className="space-y-4">
          <div className="border border-gray-200 rounded-lg p-6 hover:border-primary-500 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Plaid</h3>
                <p className="text-sm text-gray-600">Connect to your bank account via Plaid</p>
              </div>
              <button className="btn-primary">Connect</button>
            </div>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6 hover:border-primary-500 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">ADP</h3>
                <p className="text-sm text-gray-600">Connect via ADP payroll system</p>
              </div>
              <button className="btn-primary">Connect</button>
            </div>
          </div>
        </div>
        
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            Or you can <Link to="/request" className="font-bold underline">upload your bank statement manually</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default PayrollConnectPage;
