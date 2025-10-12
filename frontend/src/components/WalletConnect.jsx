import React, { useState } from 'react';
import { Wallet, ChevronDown, LogOut } from 'lucide-react';
import { useWalletStore } from '../store/walletStore';
import toast from 'react-hot-toast';

function WalletConnect() {
  const {
    starknetAddress,
    evmAddress,
    starknetConnected,
    evmConnected,
    activeChain,
    connectStarkNet,
    connectEVM,
    disconnectStarkNet,
    disconnectEVM,
    setActiveChain,
  } = useWalletStore();
  
  const [showDropdown, setShowDropdown] = useState(false);
  
  const handleConnectStarkNet = async () => {
    try {
      await connectStarkNet();
      toast.success('StarkNet wallet connected!');
      setShowDropdown(false);
    } catch (error) {
      toast.error(error.message || 'Failed to connect StarkNet wallet');
    }
  };
  
  const handleConnectEVM = async () => {
    try {
      await connectEVM();
      toast.success('MetaMask connected!');
      setShowDropdown(false);
    } catch (error) {
      toast.error(error.message || 'Failed to connect MetaMask');
    }
  };
  
  const handleDisconnect = async () => {
    if (activeChain === 'starknet') {
      await disconnectStarkNet();
      toast.success('StarkNet wallet disconnected');
    } else {
      disconnectEVM();
      toast.success('MetaMask disconnected');
    }
    setShowDropdown(false);
  };
  
  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };
  
  const activeAddress = activeChain === 'starknet' ? starknetAddress : evmAddress;
  const isConnected = starknetConnected || evmConnected;
  
  return (
    <div className="relative">
      {!isConnected ? (
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Wallet className="w-5 h-5" />
            <span>Connect Wallet</span>
            <ChevronDown className="w-4 h-4" />
          </button>
          
          {showDropdown && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
              <button
                onClick={handleConnectStarkNet}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center space-x-3"
              >
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-purple-600 font-bold text-sm">S</span>
                </div>
                <div>
                  <div className="font-medium text-gray-900">StarkNet</div>
                  <div className="text-xs text-gray-500">Argent, Braavos</div>
                </div>
              </button>
              
              <button
                onClick={handleConnectEVM}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center space-x-3"
              >
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                  <span className="text-orange-600 font-bold text-sm">M</span>
                </div>
                <div>
                  <div className="font-medium text-gray-900">MetaMask</div>
                  <div className="text-xs text-gray-500">Ethereum, EVM</div>
                </div>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse" />
            <span>{formatAddress(activeAddress)}</span>
            <ChevronDown className="w-4 h-4" />
          </button>
          
          {showDropdown && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Connected to</div>
                <div className="font-medium text-gray-900">
                  {activeChain === 'starknet' ? 'StarkNet' : 'Ethereum'}
                </div>
                <div className="text-xs text-gray-500 mt-1 font-mono break-all">
                  {activeAddress}
                </div>
              </div>
              
              {starknetConnected && evmConnected && (
                <div className="px-4 py-2">
                  <div className="text-xs text-gray-600 mb-2">Switch Chain</div>
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        setActiveChain('starknet');
                        setShowDropdown(false);
                        toast.success('Switched to StarkNet');
                      }}
                      className={`w-full text-left px-3 py-2 rounded text-sm ${
                        activeChain === 'starknet' ? 'bg-primary-50 text-primary-600' : 'hover:bg-gray-50'
                      }`}
                    >
                      StarkNet
                    </button>
                    <button
                      onClick={() => {
                        setActiveChain('evm');
                        setShowDropdown(false);
                        toast.success('Switched to Ethereum');
                      }}
                      className={`w-full text-left px-3 py-2 rounded text-sm ${
                        activeChain === 'evm' ? 'bg-primary-50 text-primary-600' : 'hover:bg-gray-50'
                      }`}
                    >
                      Ethereum
                    </button>
                  </div>
                </div>
              )}
              
              <button
                onClick={handleDisconnect}
                className="w-full px-4 py-3 text-left hover:bg-red-50 transition-colors flex items-center space-x-2 text-red-600 border-t border-gray-200 mt-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Disconnect</span>
              </button>
            </div>
          )}
        </div>
      )}
      
      {showDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
}

export default WalletConnect;
