const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

/**
 * Deploy EscrowV2 contract to Starknet or EVM networks
 * This script deploys the enhanced escrow with time-based identity reveal
 */

async function getCompiledContract(contractName) {
  const artifactsPath = path.join(
    __dirname,
    '..',
    'artifacts',
    'contracts',
    'solidity',
    `${contractName}.sol`,
    `${contractName}.json`
  );

  if (!fs.existsSync(artifactsPath)) {
    throw new Error(`Contract artifact not found: ${artifactsPath}`);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactsPath, 'utf8'));
  return artifact;
}

async function deployEscrowV2(network = 'localhost') {
  console.log(`\n🚀 Deploying EscrowV2 to ${network}...\n`);

  let provider, deployer;

  if (network === 'localhost') {
    // Connect to local Hardhat node
    provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    
    // Use first account
    const accounts = await provider.listAccounts();
    if (accounts.length === 0) {
      throw new Error('No accounts found. Is Hardhat node running?');
    }
    deployer = accounts[0];
    console.log('Deploying from account:', deployer.address);
  } else if (network === 'sepolia') {
    // Connect to Sepolia testnet
    const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org';
    const PRIVATE_KEY = process.env.PRIVATE_KEY;
    
    if (!PRIVATE_KEY) {
      throw new Error('PRIVATE_KEY not set in environment');
    }

    provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
    deployer = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log('Deploying from account:', deployer.address);
  } else {
    throw new Error(`Unsupported network: ${network}`);
  }

  // Get compiled contract
  const EscrowV2 = await getCompiledContract('EscrowV2');

  // Create contract factory
  const factory = new ethers.ContractFactory(
    EscrowV2.abi,
    EscrowV2.bytecode,
    deployer
  );

  // Deploy contract
  console.log('Deploying EscrowV2 contract...');
  const escrow = await factory.deploy();
  await escrow.waitForDeployment();

  const escrowAddress = await escrow.getAddress();
  console.log('✅ EscrowV2 deployed to:', escrowAddress);

  // Save deployment info
  const deploymentInfo = {
    network,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      EscrowV2: {
        address: escrowAddress,
        transactionHash: escrow.deploymentTransaction().hash
      }
    }
  };

  const deployDir = path.join(__dirname, '..', 'deploy');
  if (!fs.existsSync(deployDir)) {
    fs.mkdirSync(deployDir, { recursive: true });
  }

  const deploymentFile = path.join(deployDir, `escrow-v2-${network}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n📝 Deployment info saved to: ${deploymentFile}`);

  // Update .env files
  const envUpdates = `
# EscrowV2 Contract Address (${network})
ESCROW_V2_CONTRACT=${escrowAddress}
VITE_ESCROW_V2_CONTRACT=${escrowAddress}
`;

  console.log('\n📋 Add these to your .env files:');
  console.log(envUpdates);

  return {
    escrow,
    address: escrowAddress,
    deploymentInfo
  };
}

// Run deployment
if (require.main === module) {
  const network = process.argv[2] || 'localhost';
  
  deployEscrowV2(network)
    .then(() => {
      console.log('\n✅ Deployment complete!\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Deployment failed:', error);
      process.exit(1);
    });
}

module.exports = { deployEscrowV2 };
