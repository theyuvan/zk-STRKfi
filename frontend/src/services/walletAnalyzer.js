import { ethers } from 'ethers';
import { RpcProvider, num } from 'starknet';

export class WalletAnalyzer {
  constructor(provider, address, chainType = 'starknet') {
    this.provider = provider;
    this.address = address;
    this.chainType = chainType;
  }

  async analyzeWallet() {
    if (this.chainType === 'starknet') {
      return await this.analyzeStarknetWallet();
    } else {
      return await this.analyzeEVMWallet();
    }
  }

  async analyzeStarknetWallet() {
    try {
      const rpcUrl = import.meta.env.VITE_STARKNET_RPC || 'https://starknet-sepolia.infura.io/v3/8b1888ab10334c00900e962e9e3d49b2';
      const rpcProvider = new RpcProvider({ 
        nodeUrl: rpcUrl
      });

      let nonce = 0;
      let balance = '0';
      
      try {
        nonce = await rpcProvider.getNonceForAddress(this.address);
      } catch (e) {
        console.warn('Could not fetch nonce:', e);
      }

      const ETH_TOKEN = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';
      try {
        const result = await rpcProvider.callContract({
          contractAddress: ETH_TOKEN,
          entrypoint: 'balanceOf',
          calldata: [this.address]
        });
        balance = num.hexToDecimalString(result[0]);
      } catch (e) {
        console.warn('Could not fetch balance:', e);
      }

      const balanceInEth = parseFloat(balance) / 1e18;
      const balanceScore = Math.min(balanceInEth * 100, 400);
      const txScore = Math.min(nonce * 5, 400);
      const consistencyScore = nonce > 10 ? 200 : (nonce > 5 ? 100 : 50);
      const activityScore = Math.round(balanceScore + txScore + consistencyScore);

      return {
        chainType: 'starknet',
        address: this.address,
        score: activityScore,
        currentBalance: balanceInEth.toFixed(6),
        transactionCount: nonce,
        metrics: {
          balanceScore: Math.round(balanceScore),
          txScore: Math.round(txScore),
          consistencyScore
        },
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error analyzing Starknet wallet:', error);
      throw new Error('Failed to analyze Starknet wallet: ' + error.message);
    }
  }

  async analyzeEVMWallet() {
    try {
      const currentBalance = await this.provider.getBalance(this.address);
      const balanceInEth = parseFloat(ethers.formatEther(currentBalance));
      const txCount = await this.provider.getTransactionCount(this.address);
      const balanceScore = Math.min(balanceInEth * 100, 400);
      const txScore = Math.min(txCount * 3, 400);
      const activityScore = Math.round(balanceScore + txScore + 200);

      return {
        chainType: 'evm',
        address: this.address,
        score: activityScore,
        currentBalance: balanceInEth.toFixed(6),
        transactionCount: txCount,
        metrics: {
          balanceScore: Math.round(balanceScore),
          txScore: Math.round(txScore),
          consistencyScore: 200
        },
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error analyzing EVM wallet:', error);
      throw new Error('Failed to analyze EVM wallet: ' + error.message);
    }
  }

  prepareProofInputs(activityData) {
    return {
      activityScore: activityData.score,
      threshold: 500,
      walletHash: ethers.keccak256(ethers.toUtf8Bytes(activityData.address)),
      timestamp: activityData.timestamp
    };
  }
}

export function generateEphemeralWallet() {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    displayOnly: true,
    note: 'Temporary address for privacy. Funds go to your connected wallet.'
  };
}
