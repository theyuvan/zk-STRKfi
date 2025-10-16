/**
 * ZK Proof Service for Real Frontend
 * Handles ZK proof generation with commitment hash
 * Matches test frontend implementation
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

export interface ZKProofData {
  proof: any;
  publicSignals: string[];
  commitment: string;
  commitmentHash: string;
  identityCommitment: string;
  salt: string;
  activityScore: number;
  threshold: number;
  walletAddress: string;
}

export class ZKProofService {
  private apiUrl: string;

  constructor(apiUrl: string = 'http://localhost:3000') {
    this.apiUrl = apiUrl;
  }

  /**
   * Generate ZK proof for lender
   * @param activityScore - Current activity score
   * @param threshold - Minimum threshold (100 for lenders)
   * @param walletAddress - Wallet address
   * @returns ZK proof data with commitment hash
   */
  async generateLenderProof(
    activityScore: number,
    threshold: number,
    walletAddress: string
  ): Promise<ZKProofData> {
    try {
      console.log('🔐 Generating ZK proof for lender...', {
        activityScore,
        threshold,
        walletAddress: walletAddress.slice(0, 10) + '...'
      });

      // Get or retrieve identity commitment from localStorage
      let identityCommitment = localStorage.getItem('identityCommitment');
      
      if (identityCommitment) {
        console.log('✅ Found existing identity commitment:', identityCommitment.slice(0, 20) + '...');
      } else {
        console.log('⚠️ No identity commitment found - will be generated');
      }

      // Call backend to generate proof
      const response = await fetch(`${this.apiUrl}/api/proof/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salary: activityScore,
          threshold,
          walletAddress,
          identityCommitment // Pass existing or null
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate proof');
      }

      const data = await response.json();
      console.log('✅ Backend proof response:', data);

      // Save identity commitment on FIRST proof generation
      if (!identityCommitment && data.identityCommitment) {
        identityCommitment = data.identityCommitment;
        if (identityCommitment) {
          localStorage.setItem('identityCommitment', identityCommitment);
          console.log('💾 Saved NEW identity commitment:', identityCommitment.slice(0, 20) + '...');
        }
      }

      // Truncate commitments to 65 chars (felt252 limit)
      const truncatedIdentityCommitment = data.identityCommitment.slice(0, 65);
      const truncatedCommitment = data.commitment.slice(0, 65);

      // Generate commitment hash for on-chain registration
      const commitmentHash = this.generateCommitmentHash(data.commitment);
      console.log('🔐 Generated commitment hash:', commitmentHash.slice(0, 20) + '...');

      const zkProofData: ZKProofData = {
        proof: data.proof,
        publicSignals: data.publicSignals,
        commitment: truncatedCommitment, // Activity proof commitment (changes with score)
        commitmentHash, // Hash of commitment for on-chain
        identityCommitment: truncatedIdentityCommitment, // Permanent identity
        salt: data.salt,
        activityScore,
        threshold,
        walletAddress
      };

      console.log('✅ ZK Proof generated successfully:', {
        commitment: zkProofData.commitment.slice(0, 20) + '...',
        commitmentHash: zkProofData.commitmentHash.slice(0, 20) + '...',
        identityCommitment: zkProofData.identityCommitment.slice(0, 20) + '...',
        activityScore: zkProofData.activityScore
      });

      return zkProofData;
    } catch (error) {
      console.error('❌ ZK proof generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate commitment hash using SHA256
   * Truncates to 63 hex chars (felt252 limit)
   */
  private generateCommitmentHash(commitment: string): string {
    // Remove '0x' prefix if present
    const cleanCommitment = commitment.startsWith('0x') ? commitment.slice(2) : commitment;
    
    // Hash using SHA256
    const hash = sha256(new TextEncoder().encode(cleanCommitment));
    let hashHex = '0x' + bytesToHex(hash);
    
    // Truncate to 63 hex chars (252 bits) for felt252
    hashHex = hashHex.slice(0, 65); // 0x + 63 chars = 65 total
    
    return hashHex;
  }

  /**
   * Register proof on-chain (ActivityVerifier contract)
   * @param proofData - ZK proof data
   * @param starknetAccount - Connected StarkNet account
   */
  async registerProofOnChain(proofData: ZKProofData, starknetAccount: any): Promise<string> {
    try {
      console.log('📝 Registering proof on-chain...');

      const { Contract } = await import('starknet');
      
      const ACTIVITY_VERIFIER_ADDRESS = process.env.NEXT_PUBLIC_ACTIVITY_VERIFIER_ADDRESS || 
        '0x071b94eb84b81868b61fb0ec1bbb59df47bb508583bc79325e5fa997ee3eb4be';

      const verifierAbi = [
        {
          name: 'register_proof',
          type: 'function',
          inputs: [
            { name: 'proof_hash', type: 'felt252' },
            { name: 'commitment', type: 'felt252' },
            { name: 'activity_score', type: 'u256' }
          ],
          outputs: [],
          stateMutability: 'external'
        }
      ];

      const verifierContract = new Contract(
        verifierAbi,
        ACTIVITY_VERIFIER_ADDRESS,
        starknetAccount
      );

      // Clean hex strings for felt252
      const cleanProofHash = proofData.commitmentHash.slice(0, 65);
      const cleanCommitment = proofData.commitment.slice(0, 65);

      console.log('📊 Registering proof:', {
        proofHash: cleanProofHash.slice(0, 20) + '...',
        commitment: cleanCommitment.slice(0, 20) + '...',
        activityScore: proofData.activityScore
      });

      const tx = await verifierContract.register_proof(
        cleanProofHash,
        cleanCommitment,
        BigInt(proofData.activityScore)
      );

      console.log('⏳ Waiting for transaction:', tx.transaction_hash);

      // Wait for confirmation
      const { RpcProvider } = await import('starknet');
      const provider = new RpcProvider({
        nodeUrl: process.env.NEXT_PUBLIC_STARKNET_RPC || 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7'
      });

      await provider.waitForTransaction(tx.transaction_hash);
      console.log('✅ Proof registered on-chain');

      return tx.transaction_hash;
    } catch (error) {
      console.error('❌ Failed to register proof on-chain:', error);
      throw error;
    }
  }

  /**
   * Generate mock ZK proof (for testing when backend is unavailable)
   */
  generateMockProof(activityScore: number, threshold: number, walletAddress: string): ZKProofData {
    console.log('🧪 Generating test proof (development mode)');

    // Generate mock commitment
    const mockCommitment = '0x' + Array.from({ length: 63 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');

    // Generate mock identity commitment
    let identityCommitment = localStorage.getItem('identityCommitment');
    if (!identityCommitment) {
      identityCommitment = '0x' + Array.from({ length: 63 }, () => 
        Math.floor(Math.random() * 16).toString(16)
      ).join('');
      localStorage.setItem('identityCommitment', identityCommitment);
    }

    // Generate commitment hash
    const commitmentHash = this.generateCommitmentHash(mockCommitment);

    const mockProof: ZKProofData = {
      proof: {
        pi_a: ['0x0', '0x0', '0x1'],
        pi_b: [['0x0', '0x0'], ['0x0', '0x0'], ['0x1', '0x0']],
        pi_c: ['0x0', '0x0', '0x1'],
        protocol: 'groth16',
        curve: 'bn128'
      },
      publicSignals: [threshold.toString(), activityScore.toString()],
      commitment: mockCommitment,
      commitmentHash,
      identityCommitment,
      salt: Math.floor(Math.random() * 1000000).toString(),
      activityScore,
      threshold,
      walletAddress
    };

    console.log('✅ Test proof ready:', {
      commitment: mockProof.commitment.slice(0, 20) + '...',
      commitmentHash: mockProof.commitmentHash.slice(0, 20) + '...',
      score: activityScore
    });

    return mockProof;
  }
}

// Export singleton instance
export const zkProofService = new ZKProofService();
