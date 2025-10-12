require('dotenv').config({ path: '../backend/.env' });
const { Account, Contract, RpcProvider, stark } = require('starknet');
const fs = require('fs');
const path = require('path');

/**
 * Deploy StarkNet contracts
 * Requires a funded StarkNet account
 */
async function deployStarkNetContracts() {
    console.log('\n' + '='.repeat(70));
    console.log('StarkNet Contract Deployment');
    console.log('='.repeat(70) + '\n');

    // Initialize provider
    const provider = new RpcProvider({
        nodeUrl: process.env.STARKNET_RPC || 'https://starknet-goerli.infura.io/v3/YOUR_KEY'
    });

    console.log('Connected to:', process.env.STARKNET_RPC || 'Default RPC');
    console.log('Network:', process.env.STARKNET_NETWORK || 'goerli-alpha\n');

    // Check if account details are provided
    if (!process.env.STARKNET_ACCOUNT_ADDRESS || !process.env.STARKNET_PRIVATE_KEY) {
        console.log('⚠️  Account credentials not found in .env');
        console.log('\nTo deploy StarkNet contracts, you need:');
        console.log('1. A funded StarkNet wallet (Argent or Braavos)');
        console.log('2. Export your account details:');
        console.log('   STARKNET_ACCOUNT_ADDRESS=0x...');
        console.log('   STARKNET_PRIVATE_KEY=0x...');
        console.log('\n📖 For detailed instructions, see:');
        console.log('   https://docs.starknet.io/documentation/getting_started/account_setup/\n');
        
        // Generate placeholder addresses for development
        console.log('Generating placeholder StarkNet addresses for development...\n');
        const placeholders = {
            STARKNET_PAYROLL_CONTRACT: '0x' + '0'.repeat(63) + '1',
            STARKNET_LOAN_ESCROW_CONTRACT: '0x' + '0'.repeat(63) + '2',
            STARKNET_VERIFIER_CONTRACT: '0x' + '0'.repeat(63) + '3',
        };
        
        console.log('Placeholder addresses:');
        console.log(JSON.stringify(placeholders, null, 2));
        console.log('\n⚠️  These are NOT real deployed contracts!');
        console.log('To deploy real contracts, configure your StarkNet account in .env\n');
        
        return placeholders;
    }

    // Initialize account
    const account = new Account(
        provider,
        process.env.STARKNET_ACCOUNT_ADDRESS,
        process.env.STARKNET_PRIVATE_KEY
    );

    console.log('Deployer account:', process.env.STARKNET_ACCOUNT_ADDRESS);

    const deployedAddresses = {};

    // Check if compiled contracts exist
    const contracts = [
        { name: 'Payroll', file: 'payroll_compiled.json', key: 'STARKNET_PAYROLL_CONTRACT' },
        { name: 'Loan Escrow', file: 'loan_escrow_compiled.json', key: 'STARKNET_LOAN_ESCROW_CONTRACT' },
        { name: 'Verifier Stub', file: 'verifier_stub_compiled.json', key: 'STARKNET_VERIFIER_CONTRACT' }
    ];

    for (const contract of contracts) {
        const compiledPath = path.join(__dirname, '../starknet', contract.file);
        
        if (!fs.existsSync(compiledPath)) {
            console.log(`⚠️  ${contract.name} not compiled. Run: npm run compile:starknet`);
            continue;
        }

        try {
            console.log(`\n📝 Deploying ${contract.name}...`);
            
            const compiledContract = JSON.parse(fs.readFileSync(compiledPath, 'utf-8'));
            
            // Declare the contract class
            const declareResponse = await account.declare({
                contract: compiledContract,
            });
            
            console.log(`   Class declared: ${declareResponse.class_hash}`);
            
            // Deploy the contract
            const deployResponse = await account.deploy({
                classHash: declareResponse.class_hash,
            });
            
            deployedAddresses[contract.key] = deployResponse.contract_address;
            
            console.log(`✅ ${contract.name} deployed to:`, deployResponse.contract_address);
            console.log(`   Transaction hash:`, deployResponse.transaction_hash);

        } catch (error) {
            console.error(`❌ Failed to deploy ${contract.name}:`, error.message);
        }
    }

    // Save addresses
    const outputPath = path.join(__dirname, 'starknet-addresses.json');
    fs.writeFileSync(outputPath, JSON.stringify(deployedAddresses, null, 2));

    console.log('\n' + '='.repeat(70));
    console.log('Deployment Summary');
    console.log('='.repeat(70));
    console.log(JSON.stringify(deployedAddresses, null, 2));
    console.log('\n✅ Addresses saved to:', outputPath);

    console.log('\n📋 Add these to backend/.env:\n');
    Object.entries(deployedAddresses).forEach(([key, value]) => {
        console.log(`${key}=${value}`);
    });

    console.log('\n' + '='.repeat(70));
    console.log('✅ StarkNet Deployment Completed!');
    console.log('='.repeat(70) + '\n');

    return deployedAddresses;
}

// Run deployment
if (require.main === module) {
    deployStarkNetContracts()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('\n❌ Deployment failed:', error);
            process.exit(1);
        });
}

module.exports = { deployStarkNetContracts };
