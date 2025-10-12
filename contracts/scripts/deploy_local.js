const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('\n' + '='.repeat(70));
    console.log('Starting EVM Contract Deployment (Hardhat Local Network)');
    console.log('='.repeat(70) + '\n');

    // Get signers
    const [deployer] = await hre.ethers.getSigners();
    
    console.log('Deploying contracts with account:', deployer.address);
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log('Account balance:', hre.ethers.formatEther(balance), 'ETH\n');

    const deployedAddresses = {};

    try {
        // Deploy Escrow Contract
        console.log('📝 Deploying Escrow Contract...');
        const Escrow = await hre.ethers.getContractFactory('Escrow');
        const escrow = await Escrow.deploy();
        await escrow.waitForDeployment();
        
        const escrowAddress = await escrow.getAddress();
        deployedAddresses.EVM_ESCROW_CONTRACT = escrowAddress;
        
        console.log('✅ Escrow deployed to:', escrowAddress);
        console.log('   Transaction hash:', escrow.deploymentTransaction().hash);

    } catch (error) {
        console.error('❌ Failed to deploy Escrow:', error.message);
    }

    try {
        // Deploy IdentityReveal Contract
        console.log('\n📝 Deploying IdentityReveal Contract...');
        const threshold = 2;
        const total = 3;
        
        const IdentityReveal = await hre.ethers.getContractFactory('IdentityReveal');
        const identityReveal = await IdentityReveal.deploy(threshold, total);
        await identityReveal.waitForDeployment();
        
        const identityRevealAddress = await identityReveal.getAddress();
        deployedAddresses.EVM_IDENTITY_REVEAL_CONTRACT = identityRevealAddress;
        
        console.log('✅ IdentityReveal deployed to:', identityRevealAddress);
        console.log('   Transaction hash:', identityReveal.deploymentTransaction().hash);
        console.log('   Threshold:', threshold, '/', total);

    } catch (error) {
        console.error('❌ Failed to deploy IdentityReveal:', error.message);
    }

    // Save addresses to file
    console.log('\n' + '='.repeat(70));
    console.log('Deployment Summary');
    console.log('='.repeat(70));
    console.log(JSON.stringify(deployedAddresses, null, 2));

    const outputPath = path.join(__dirname, '../deploy/evm-addresses.json');
    fs.writeFileSync(outputPath, JSON.stringify(deployedAddresses, null, 2));
    console.log('\n✅ Addresses saved to:', outputPath);

    // Generate .env content
    console.log('\n' + '='.repeat(70));
    console.log('Configuration Instructions');
    console.log('='.repeat(70));
    
    console.log('\n📋 Add these to backend/.env:\n');
    Object.entries(deployedAddresses).forEach(([key, value]) => {
        console.log(`${key}=${value}`);
    });

    console.log('\n📋 Add these to frontend/.env:\n');
    Object.entries(deployedAddresses).forEach(([key, value]) => {
        console.log(`VITE_${key}=${value}`);
    });

    console.log('\n' + '='.repeat(70));
    console.log('✅ EVM Deployment Completed Successfully!');
    console.log('='.repeat(70) + '\n');

    return deployedAddresses;
}

// Execute deployment
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('\n❌ Deployment failed:', error);
        process.exit(1);
    });
