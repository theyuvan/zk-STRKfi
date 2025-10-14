'use client'

import { connect, disconnect } from '@starknet-io/get-starknet'
import { AccountInterface } from 'starknet'

export interface WalletState {
  address: string | null
  account: AccountInterface | null
  isConnected: boolean
}

let walletState: WalletState = {
  address: null,
  account: null,
  isConnected: false,
}

export async function connectWallet(): Promise<WalletState> {
  try {
    const starknet = await connect({
      modalMode: 'alwaysAsk',
      modalTheme: 'dark',
    })

    if (!starknet) {
      throw new Error('No StarkNet wallet detected. Please install Ready Wallet or Braavos.')
    }

    // Enable the wallet connection
    await starknet.enable()

    // Check if connection was successful
    if (!starknet.isConnected) {
      throw new Error('Wallet connection was rejected or failed')
    }

    walletState = {
      address: starknet.selectedAddress || null,
      account: starknet.account,
      isConnected: true,
    }

    return walletState
  } catch (error: any) {
    console.error('Wallet connection error:', error)
    // Provide more specific error messages
    if (error.message?.includes('User abort')) {
      throw new Error('Connection cancelled by user')
    }
    throw error
  }
}

export async function disconnectWallet(): Promise<void> {
  try {
    await disconnect()
    walletState = {
      address: null,
      account: null,
      isConnected: false,
    }
  } catch (error) {
    console.error('Wallet disconnection error:', error)
    throw error
  }
}

export function getWalletState(): WalletState {
  return walletState
}
