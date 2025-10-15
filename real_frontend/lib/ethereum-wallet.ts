'use client'

declare global {
  interface Window {
    ethereum?: any
  }
}

export interface EthereumWalletState {
  address: string | null
  chainId: number | null
  isConnected: boolean
}

export async function connectMetaMask(): Promise<EthereumWalletState> {
  if (typeof window === 'undefined') {
    throw new Error('Window is not defined')
  }

  if (!window.ethereum) {
    throw new Error('MetaMask is not installed. Please install MetaMask extension.')
  }

  try {
    // Request account access
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts',
    })

    // Get chain ID
    const chainId = await window.ethereum.request({
      method: 'eth_chainId',
    })

    return {
      address: accounts[0],
      chainId: parseInt(chainId, 16),
      isConnected: true,
    }
  } catch (error: any) {
    if (error.code === 4001) {
      throw new Error('User rejected the connection request')
    }
    throw error
  }
}

export async function disconnectMetaMask(): Promise<void> {
  // MetaMask doesn't have a disconnect method
  // User needs to disconnect from the extension
  console.log('Please disconnect from MetaMask extension')
}

export async function switchToEthereumMainnet(): Promise<void> {
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed')
  }

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x1' }], // Ethereum Mainnet
    })
  } catch (error: any) {
    if (error.code === 4902) {
      throw new Error('Ethereum Mainnet is not available in your MetaMask')
    }
    throw error
  }
}

export async function getBalance(address: string): Promise<string> {
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed')
  }

  try {
    const balance = await window.ethereum.request({
      method: 'eth_getBalance',
      params: [address, 'latest'],
    })

    // Convert from Wei to ETH
    const balanceInEth = parseInt(balance, 16) / 1e18
    return balanceInEth.toFixed(4)
  } catch (error) {
    console.error('Failed to get balance:', error)
    throw error
  }
}

// Listen for account changes
export function onAccountsChanged(callback: (accounts: string[]) => void): void {
  if (window.ethereum) {
    window.ethereum.on('accountsChanged', callback)
  }
}

// Listen for chain changes
export function onChainChanged(callback: (chainId: string) => void): void {
  if (window.ethereum) {
    window.ethereum.on('chainChanged', callback)
  }
}

// Remove listeners
export function removeListeners(): void {
  if (window.ethereum) {
    window.ethereum.removeAllListeners('accountsChanged')
    window.ethereum.removeAllListeners('chainChanged')
  }
}
