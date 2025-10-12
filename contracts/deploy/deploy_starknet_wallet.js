/**
 * Starknet Contract Deployment via Connected Wallet
 * 
 * This script guides you to deploy contracts using your connected Starknet wallet
 * (Argent X or Braavos) instead of storing private keys.
 * 
 * Prerequisites:
 * 1. Starknet wallet extension installed (Argent X or Braavos)
 * 2. Wallet connected to Starknet Sepolia testnet
 * 3. Some testnet ETH in your wallet (get from faucet)
 * 4. Cairo contracts compiled
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../backend/.env') });

// Import Starknet.js
const { Account, Contract, RpcProvider, cairo } = require('starknet');

// Configuration
const STARKNET_RPC = process.env.STARKNET_SEPOLIA_RPC;
const NETWORK = 'sepolia-testnet';

console.log('\n========================================');
console.log('🚀 Starknet Contract Deployment Guide');
console.log('========================================\n');

async function deployWithWallet() {
    try {
        console.log('📋 Step 1: Compile Cairo Contract');
        console.log('----------------------------------');
        console.log('Before deploying, you need to compile the Cairo contract:');
        console.log('');
        console.log('Option A - Using Scarb (Recommended):');
        console.log('  cd contracts/starknet');
        console.log('  scarb build');
        console.log('');
        console.log('Option B - Using Cairo CLI:');
        console.log('  cairo-compile contracts/starknet/loan_escrow.cairo \\');
        console.log('    --output contracts/starknet/loan_escrow.json \\');
        console.log('    --abi contracts/starknet/loan_escrow_abi.json');
        console.log('');
        
        console.log('📱 Step 2: Connect Your Wallet');
        console.log('-------------------------------');
        console.log('This deployment method uses starknet.js with wallet connection.');
        console.log('');
        console.log('For Browser-Based Deployment (Recommended):');
        console.log('  1. Use a dApp frontend with wallet connection');
        console.log('  2. Call wallet.deploy() method');
        console.log('  3. User approves transaction in wallet popup');
        console.log('');
        console.log('For Command-Line Deployment:');
        console.log('  starkli declare --account ~/.starkli-wallets/deployer/account.json \\');
        console.log('    --keystore ~/.starkli-wallets/deployer/keystore.json \\');
        console.log('    contracts/starknet/loan_escrow.json');
        console.log('');
        
        console.log('🔑 Step 3: Deployment Options');
        console.log('------------------------------');
        console.log('');
        console.log('A) Using Starkli (CLI tool):');
        console.log('   Install: curl https://get.starkli.sh | sh');
        console.log('   Setup wallet: starkli signer keystore from-key ~/.starkli-wallets/deployer/keystore.json');
        console.log('   Deploy: starkli deploy <CLASS_HASH>');
        console.log('');
        console.log('B) Using Frontend (Recommended for users):');
        console.log('   - See deploy_via_frontend.md for React integration');
        console.log('   - User connects Argent X or Braavos');
        console.log('   - Smart contract deployment via wallet popup');
        console.log('');
        console.log('C) Using Starknet Remix Plugin:');
        console.log('   - Upload .cairo file to Remix');
        console.log('   - Connect wallet in Remix plugin');
        console.log('   - Click "Deploy" button');
        console.log('');
        
        console.log('📝 Step 4: After Deployment');
        console.log('----------------------------');
        console.log('Once deployed, save the contract address:');
        console.log('');
        console.log('1. Copy the contract address from wallet/CLI output');
        console.log('2. Update backend/.env:');
        console.log('   LOAN_ESCROW_CONTRACT_ADDRESS=0x...');
        console.log('');
        console.log('3. Update frontend/.env:');
        console.log('   VITE_LOAN_ESCROW_ADDRESS=0x...');
        console.log('');
        
        console.log('✅ Security Benefits');
        console.log('--------------------');
        console.log('✓ No private keys stored in code or .env files');
        console.log('✓ User approves each transaction via wallet');
        console.log('✓ Hardware wallet support (Ledger with Argent)');
        console.log('✓ Transaction simulation before signing');
        console.log('');
        
        console.log('📚 Additional Resources');
        console.log('-----------------------');
        console.log('Starknet Docs: https://docs.starknet.io/documentation/');
        console.log('Starkli: https://github.com/xJonathanLEI/starkli');
        console.log('Argent X: https://www.argent.xyz/argent-x/');
        console.log('Braavos: https://braavos.app/');
        console.log('Sepolia Faucet: https://starknet-faucet.vercel.app/');
        console.log('');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Create helper for programmatic deployment (optional - for backend services)
async function deployProgrammatically(compiledContract, walletAddress, privateKey) {
    console.log('\n⚠️  WARNING: Programmatic Deployment');
    console.log('This method requires a private key and should ONLY be used for:');
    console.log('- Backend services with secure key management');
    console.log('- CI/CD pipelines with encrypted secrets');
    console.log('- NOT for user-facing applications\n');
    
    const provider = new RpcProvider({ nodeUrl: STARKNET_RPC });
    
    // For programmatic deployment, you'd use:
    // const account = new Account(provider, walletAddress, privateKey);
    // const deployResponse = await account.deploy(...);
    
    console.log('For user deployments, use the wallet-based approach above.');
}

// Run the guide
deployWithWallet();

module.exports = {
    deployWithWallet,
    deployProgrammatically
};
