'use client'

import { connect, disconnect } from 'get-starknet-core'
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

    if (!starknet || !starknet.isConnected) {
      throw new Error('Failed to connect wallet')
    }

    await starknet.enable()

    walletState = {
      address: starknet.selectedAddress || null,
      account: starknet.account,
      isConnected: true,
    }

    return walletState
  } catch (error) {
    console.error('Wallet connection error:', error)
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
