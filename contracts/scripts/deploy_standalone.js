require('dotenv').config({ path: '../backend/.env' });
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Import compiled contract ABIs
function getCompiledContract(name) {
    const artifactPath = path.join(__dirname, '../artifacts/solidity', `${name}.sol`, `${name}.json`);
    if (!fs.existsSync(artifactPath)) {
        throw new Error(`Contract ${name} not found. Run 'npx hardhat compile' first.`);
    }
    return JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
}

async function deployContracts(network = 'local') {
    console.log('\n' + '='.repeat(70));
    console.log(`Deploying EVM Contracts to ${network}`);
    console.log('='.repeat(70) + '\n');

    let provider, wallet;

    if (network === 'local' || network === 'localhost') {
        // Connect to local Hardhat network
        provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
        
        try {
            // Use first Hardhat account
            const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
            wallet = new ethers.Wallet(privateKey, provider);
        } catch (error) {
            console.error('❌ Could not connect to local network.');
            console.error('   Make sure Hardhat node is running:');
            console.error('   Run: npx hardhat node');
            process.exit(1);
        }
    } else if (network === 'sepolia') {
        // Connect to Sepolia testnet
        const rpcUrl = process.env.EVM_RPC;
        const privateKey = process.env.DEPLOYER_PRIVATE_KEY;

        if (!rpcUrl || !privateKey) {
            console.error('❌ Missing configuration for Sepolia deployment');
            console.error('   Add to backend/.env:');
            console.error('   EVM_RPC=https://sepolia.infura.io/v3/YOUR_PROJECT_ID');
            console.error('   DEPLOYER_PRIVATE_KEY=0x...');
            process.exit(1);
        }

        provider = new ethers.JsonRpcProvider(rpcUrl);
        wallet = new ethers.Wallet(privateKey, provider);
    } else {
        console.error('❌ Invalid network. Use: local or sepolia');
        process.exit(1);
    }

    console.log('Deployer address:', wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log('Balance:', ethers.formatEther(balance), 'ETH\n');

    if (balance === 0n) {
        console.error('❌ Deployer has no funds!');
        if (network === 'sepolia') {
            console.error('   Get test ETH from: https://sepoliafaucet.com/');
        }
        process.exit(1);
    }

    const deployedAddresses = {};

    // Deploy Escrow
    try {
        console.log('📝 Deploying Escrow Contract...');
        const Escrow = getCompiledContract('Escrow');
        const factory = new ethers.ContractFactory(Escrow.abi, Escrow.bytecode, wallet);
        const contract = await factory.deploy();
        await contract.waitForDeployment();
        
        const address = await contract.getAddress();
        deployedAddresses.EVM_ESCROW_CONTRACT = address;
        
        console.log('✅ Escrow deployed to:', address);
        const receipt = await contract.deploymentTransaction().wait();
        console.log('   Gas used:', receipt.gasUsed.toString());
    } catch (error) {
        console.error('❌ Escrow deployment failed:', error.message);
    }

    // Deploy IdentityReveal
    try {
        console.log('\n📝 Deploying IdentityReveal Contract...');
        const IdentityReveal = getCompiledContract('IdentityReveal');
        const factory = new ethers.ContractFactory(IdentityReveal.abi, IdentityReveal.bytecode, wallet);
        const contract = await factory.deploy(2, 3); // threshold=2, total=3
        await contract.waitForDeployment();
        
        const address = await contract.getAddress();
        deployedAddresses.EVM_IDENTITY_REVEAL_CONTRACT = address;
        
        console.log('✅ IdentityReveal deployed to:', address);
        console.log('   Threshold: 2/3');
        const receipt = await contract.deploymentTransaction().wait();
        console.log('   Gas used:', receipt.gasUsed.toString());
    } catch (error) {
        console.error('❌ IdentityReveal deployment failed:', error.message);
    }

    // Save results
    console.log('\n' + '='.repeat(70));
    console.log('Deployment Complete!');
    console.log('='.repeat(70));
    console.log(JSON.stringify(deployedAddresses, null, 2));

    const outputFile = path.join(__dirname, '../deploy/deployed-addresses.json');
    fs.writeFileSync(outputFile, JSON.stringify(deployedAddresses, null, 2));
    console.log('\n✅ Addresses saved to:', outputFile);

    // Print configuration instructions
    console.log('\n' + '='.repeat(70));
    console.log('Configuration Instructions');
    console.log('='.repeat(70));
    
    console.log('\n📋 Add to backend/.env:\n');
    Object.entries(deployedAddresses).forEach(([key, value]) => {
        console.log(`${key}=${value}`);
    });

    console.log('\n📋 Add to frontend/.env:\n');
    Object.entries(deployedAddresses).forEach(([key, value]) => {
        console.log(`VITE_${key}=${value}`);
    });

    console.log('\n' + '='.repeat(70) + '\n');

    return deployedAddresses;
}

// Run if executed directly
if (require.main === module) {
    const network = process.argv[2] || 'local';
    
    deployContracts(network)
        .then(() => {
            console.log('✅ Deployment successful!\n');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Deployment failed:', error.message);
            console.error(error);
            process.exit(1);
        });
}

module.exports = { deployContracts };
