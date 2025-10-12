#!/usr/bin/env node

/**
 * Quick Deploy Script - No Setup Required
 * 
 * Usage:
 *   node deploy_now.js <network> <private_key>
 * 
 * Example:
 *   node deploy_now.js sepolia 0xYourPrivateKeyHere
 */

require('dotenv').config({ path: '../backend/.env' });
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Get command line arguments
const args = process.argv.slice(2);
const network = args[0] || 'sepolia';
const privateKey = args[1] || process.env.DEPLOYER_PRIVATE_KEY;

// Import compiled contracts
function getContract(name) {
    const artifactPath = path.join(__dirname, 'artifacts/solidity', `${name}.sol`, `${name}.json`);
    return JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
}

async function deploy() {
    console.log('\n🚀 Quick Deploy - ZK Affordability Loan\n');
    console.log('Network:', network);
    console.log('='.repeat(70) + '\n');

    // Setup provider and wallet
    let provider, rpcUrl;
    
    if (network === 'sepolia') {
        rpcUrl = process.env.EVM_RPC || 'https://sepolia.infura.io/v3/8b1888ab10334c00900e962e9e3d49b2';
    } else if (network === 'goerli') {
        rpcUrl = process.env.EVM_RPC || 'https://goerli.infura.io/v3/8b1888ab10334c00900e962e9e3d49b2';
    } else {
        console.error('❌ Invalid network. Use: sepolia or goerli');
        process.exit(1);
    }

    if (!privateKey || privateKey.length !== 66) {
        console.error('❌ Invalid private key!');
        console.error('\nUsage:');
        console.error('  node deploy_now.js sepolia 0xYourPrivateKeyHere');
        console.error('\nOr set in backend/.env:');
        console.error('  DEPLOYER_PRIVATE_KEY=0x...');
        process.exit(1);
    }

    provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log('Deployer Address:', wallet.address);
    
    try {
        const balance = await provider.getBalance(wallet.address);
        console.log('Balance:', ethers.formatEther(balance), 'ETH\n');
        
        if (balance === 0n) {
            console.error('❌ No funds! Get testnet ETH from: https://sepoliafaucet.com/');
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Could not connect to network:', error.message);
        process.exit(1);
    }

    const deployed = {};

    // Deploy Escrow
    try {
        console.log('📝 Deploying Escrow...');
        const Escrow = getContract('Escrow');
        const factory = new ethers.ContractFactory(Escrow.abi, Escrow.bytecode, wallet);
        const contract = await factory.deploy();
        await contract.waitForDeployment();
        
        const address = await contract.getAddress();
        deployed.ESCROW_CONTRACT = address;
        console.log('✅ Escrow:', address);
    } catch (error) {
        console.error('❌ Escrow deployment failed:', error.message);
    }

    // Deploy EscrowV2
    try {
        console.log('\n📝 Deploying EscrowV2...');
        const EscrowV2 = getContract('EscrowV2');
        const factory = new ethers.ContractFactory(EscrowV2.abi, EscrowV2.bytecode, wallet);
        const contract = await factory.deploy();
        await contract.waitForDeployment();
        
        const address = await contract.getAddress();
        deployed.ESCROW_V2_CONTRACT = address;
        console.log('✅ EscrowV2:', address);
    } catch (error) {
        console.error('❌ EscrowV2 deployment failed:', error.message);
    }

    // Deploy IdentityReveal
    try {
        console.log('\n📝 Deploying IdentityReveal...');
        const threshold = 2;
        const total = 3;
        
        const IdentityReveal = getContract('IdentityReveal');
        const factory = new ethers.ContractFactory(IdentityReveal.abi, IdentityReveal.bytecode, wallet);
        const contract = await factory.deploy(threshold, total);
        await contract.waitForDeployment();
        
        const address = await contract.getAddress();
        deployed.IDENTITY_REVEAL_CONTRACT = address;
        console.log('✅ IdentityReveal:', address);
        console.log('   Threshold:', threshold, '/', total);
    } catch (error) {
        console.error('❌ IdentityReveal deployment failed:', error.message);
    }

    // Save addresses
    const outputPath = path.join(__dirname, 'deploy', 'deployed-addresses.json');
    const existing = fs.existsSync(outputPath) ? JSON.parse(fs.readFileSync(outputPath, 'utf8')) : {};
    const updated = { ...existing, ...deployed, network, deployedAt: new Date().toISOString() };
    fs.writeFileSync(outputPath, JSON.stringify(updated, null, 2));

    console.log('\n' + '='.repeat(70));
    console.log('✅ DEPLOYMENT COMPLETE');
    console.log('='.repeat(70));
    console.log(JSON.stringify(deployed, null, 2));
    console.log('\nSaved to:', outputPath);
    console.log('\n📝 Update your .env files:');
    console.log('\nBackend .env:');
    if (deployed.ESCROW_V2_CONTRACT) {
        console.log(`ESCROW_V2_CONTRACT=${deployed.ESCROW_V2_CONTRACT}`);
    }
    console.log('\nFrontend .env:');
    if (deployed.ESCROW_V2_CONTRACT) {
        console.log(`VITE_ESCROW_ADDRESS=${deployed.ESCROW_V2_CONTRACT}`);
    }
    if (deployed.IDENTITY_REVEAL_CONTRACT) {
        console.log(`VITE_IDENTITY_REVEAL_ADDRESS=${deployed.IDENTITY_REVEAL_CONTRACT}`);
    }
    console.log('\n🎉 Done!\n');
}

deploy().catch(error => {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
});
