require('dotenv').config({ path: '../../backend/.env' });
const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function deployEVMContracts() {
    console.log('Starting EVM contract deployment...\n');

    const [deployer] = await hre.ethers.getSigners();
    console.log('Deploying contracts with account:', deployer.address);
    console.log('Account balance:', hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), 'ETH\n');

    const deployedAddresses = {};

    // Deploy Escrow Contract
    try {
        console.log('Deploying Escrow Contract...');
        const Escrow = await hre.ethers.getContractFactory('Escrow');
        const escrow = await Escrow.deploy();
        await escrow.waitForDeployment();
        
        const escrowAddress = await escrow.getAddress();
        console.log('✓ Escrow deployed to:', escrowAddress);
        
        deployedAddresses.EVM_ESCROW_CONTRACT = escrowAddress;
    } catch (error) {
        console.error('Failed to deploy Escrow:', error.message);
    }

    // Deploy IdentityReveal Contract
    try {
        console.log('\nDeploying IdentityReveal Contract...');
        const threshold = parseInt(process.env.TRUSTEE_THRESHOLD) || 2;
        const total = parseInt(process.env.TRUSTEE_TOTAL) || 3;
        
        const IdentityReveal = await hre.ethers.getContractFactory('IdentityReveal');
        const identityReveal = await IdentityReveal.deploy(threshold, total);
        await identityReveal.waitForDeployment();
        
        const identityRevealAddress = await identityReveal.getAddress();
        console.log('✓ IdentityReveal deployed to:', identityRevealAddress);
        console.log(`  Threshold: ${threshold}/${total}`);
        
        deployedAddresses.EVM_IDENTITY_REVEAL_CONTRACT = identityRevealAddress;
    } catch (error) {
        console.error('Failed to deploy IdentityReveal:', error.message);
    }

    // Save addresses
    const outputPath = path.join(__dirname, 'evm-addresses.json');
    fs.writeFileSync(outputPath, JSON.stringify(deployedAddresses, null, 2));

    console.log('\n' + '='.repeat(60));
    console.log('Deployment Summary');
    console.log('='.repeat(60));
    console.log(JSON.stringify(deployedAddresses, null, 2));
    console.log('\nAddresses saved to:', outputPath);
    console.log('\n⚠️  Update your .env file with these addresses');

    return deployedAddresses;
}

// Run deployment
if (require.main === module) {
    deployEVMContracts()
        .then(() => {
            console.log('\n✓ EVM deployment completed');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n✗ Deployment failed:', error);
            process.exit(1);
        });
}

module.exports = { deployEVMContracts };
