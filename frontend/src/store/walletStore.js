import { create } from 'zustand';
import { connect, disconnect } from 'get-starknet';
import { ethers } from 'ethers';

export const useWalletStore = create((set, get) => ({
  // StarkNet wallet
  starknetAddress: null,
  starknetConnected: false,
  starknetWallet: null,
  
  // EVM wallet
  evmAddress: null,
  evmConnected: false,
  evmProvider: null,
  evmSigner: null,
  
  // Chain selection
  activeChain: 'starknet', // 'starknet' or 'evm'
  
  // Connect StarkNet wallet
  connectStarkNet: async () => {
    try {
      const starknet = await connect({ modalMode: 'alwaysAsk' });
      
      if (!starknet) {
        throw new Error('No StarkNet wallet found');
      }
      
      await starknet.enable();
      
      if (starknet.isConnected) {
        set({
          starknetWallet: starknet,
          starknetAddress: starknet.selectedAddress,
          starknetConnected: true,
          activeChain: 'starknet',
        });
        
        return starknet;
      }
    } catch (error) {
      console.error('StarkNet connection error:', error);
      throw error;
    }
  },
  
  // Disconnect StarkNet wallet
  disconnectStarkNet: async () => {
    try {
      await disconnect();
      set({
        starknetWallet: null,
        starknetAddress: null,
        starknetConnected: false,
      });
    } catch (error) {
      console.error('StarkNet disconnect error:', error);
    }
  },
  
  // Connect EVM wallet (MetaMask)
  connectEVM: async () => {
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask not found. Please install MetaMask.');
      }
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      
      set({
        evmProvider: provider,
        evmSigner: signer,
        evmAddress: accounts[0],
        evmConnected: true,
        activeChain: 'evm',
      });
      
      // Listen for account changes
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
          get().disconnectEVM();
        } else {
          set({ evmAddress: accounts[0] });
        }
      });
      
      return { provider, signer, address: accounts[0] };
    } catch (error) {
      console.error('EVM connection error:', error);
      throw error;
    }
  },
  
  // Disconnect EVM wallet
  disconnectEVM: () => {
    set({
      evmProvider: null,
      evmSigner: null,
      evmAddress: null,
      evmConnected: false,
    });
  },
  
  // Switch active chain
  setActiveChain: (chain) => {
    set({ activeChain: chain });
  },
  
  // Get active wallet address
  getActiveAddress: () => {
    const state = get();
    return state.activeChain === 'starknet' ? state.starknetAddress : state.evmAddress;
  },
  
  // Check if any wallet is connected
  isConnected: () => {
    const state = get();
    return state.starknetConnected || state.evmConnected;
  },
}));
