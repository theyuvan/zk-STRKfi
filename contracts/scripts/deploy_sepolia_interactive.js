const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('\n==============================================');
  console.log('🚀 Sepolia Testnet Deployment Script');
  console.log('==============================================\n');

  // Check if .env exists and has DEPLOYER_PRIVATE_KEY
  const envPath = path.join(__dirname, '..', '..', 'backend', '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  let privateKey = '';
  const pkeyMatch = envContent.match(/DEPLOYER_PRIVATE_KEY=(.+)/);
  
  if (pkeyMatch && pkeyMatch[1] && pkeyMatch[1] !== '') {
    privateKey = pkeyMatch[1].trim();
    console.log('✅ Found DEPLOYER_PRIVATE_KEY in .env\n');
  } else {
    console.log('❌ DEPLOYER_PRIVATE_KEY not found in backend/.env\n');
    console.log('Please add your private key to backend/.env:');
    console.log('DEPLOYER_PRIVATE_KEY=0xYourPrivateKeyHere\n');
    
    const addNow = await question('Do you want to add it now? (y/n): ');
    if (addNow.toLowerCase() === 'y') {
      privateKey = await question('Enter your private key (starts with 0x): ');
      
      // Add to .env
      const newEnvContent = envContent.includes('DEPLOYER_PRIVATE_KEY=')
        ? envContent.replace(/DEPLOYER_PRIVATE_KEY=.*/, `DEPLOYER_PRIVATE_KEY=${privateKey}`)
        : envContent + `\n\n# Deployer wallet private key (KEEP SECRET!)\nDEPLOYER_PRIVATE_KEY=${privateKey}\n`;
      
      fs.writeFileSync(envPath, newEnvContent);
      console.log('✅ Private key added to .env\n');
    } else {
      console.log('Deployment cancelled. Please add DEPLOYER_PRIVATE_KEY and try again.');
      rl.close();
      return;
    }
  }

  // Validate private key format
  if (!privateKey.startsWith('0x') || privateKey.length !== 66) {
    console.log('❌ Invalid private key format. Should be 66 characters starting with 0x');
    rl.close();
    return;
  }

  // Connect to Sepolia
  const rpcUrl = process.env.EVM_RPC || 'https://sepolia.infura.io/v3/8b1888ab10334c00900e962e9e3d49b2';
  console.log(`📡 Connecting to Sepolia: ${rpcUrl}\n`);
  
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  
  console.log(`👛 Deployer address: ${wallet.address}`);
  
  // Check balance
  const balance = await provider.getBalance(wallet.address);
  const balanceEth = ethers.formatEther(balance);
  console.log(`💰 Balance: ${balanceEth} ETH\n`);
  
  if (parseFloat(balanceEth) < 0.01) {
    console.log('⚠️  WARNING: Low balance! You may not have enough ETH for deployment.');
    console.log('Get testnet ETH from: https://sepoliafaucet.com/\n');
    
    const continueAnyway = await question('Continue anyway? (y/n): ');
    if (continueAnyway.toLowerCase() !== 'y') {
      console.log('Deployment cancelled.');
      rl.close();
      return;
    }
  }

  // Ask which contracts to deploy
  console.log('\n📋 Which contracts do you want to deploy?\n');
  console.log('1. EscrowV2 only (Enhanced escrow with time-based identity reveal)');
  console.log('2. Original contracts (Escrow + IdentityReveal)');
  console.log('3. All contracts (EscrowV2 + Escrow + IdentityReveal)\n');
  
  const choice = await question('Enter your choice (1-3): ');
  console.log('');

  const deployments = [];

  // Deploy based on choice
  if (choice === '1' || choice === '3') {
    console.log('📦 Deploying EscrowV2...');
    const escrowV2 = await deployContract(wallet, 'EscrowV2');
    if (escrowV2) {
      deployments.push({ name: 'EscrowV2', address: escrowV2.address });
    }
  }

  if (choice === '2' || choice === '3') {
    console.log('📦 Deploying Escrow...');
    const escrow = await deployContract(wallet, 'Escrow');
    if (escrow) {
      deployments.push({ name: 'Escrow', address: escrow.address });
    }

    console.log('📦 Deploying IdentityReveal...');
    const identity = await deployContract(wallet, 'IdentityReveal');
    if (identity) {
      deployments.push({ name: 'IdentityReveal', address: identity.address });
    }
  }

  if (deployments.length === 0) {
    console.log('❌ No contracts deployed.');
    rl.close();
    return;
  }

  // Save deployment info
  console.log('\n📝 Saving deployment info...');
  const deploymentInfo = {
    network: 'sepolia',
    chainId: 11155111,
    timestamp: new Date().toISOString(),
    deployer: wallet.address,
    contracts: {}
  };

  deployments.forEach(d => {
    deploymentInfo.contracts[d.name] = {
      address: d.address,
      verified: false
    };
  });

  const deployDir = path.join(__dirname, '..', 'deploy');
  if (!fs.existsSync(deployDir)) {
    fs.mkdirSync(deployDir, { recursive: true });
  }

  const deploymentFile = path.join(deployDir, 'sepolia-deployment.json');
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`✅ Deployment info saved to: ${deploymentFile}\n`);

  // Update .env files
  console.log('📋 Updating .env files...');
  await updateEnvFiles(deployments);

  // Print summary
  console.log('\n==============================================');
  console.log('✅ DEPLOYMENT COMPLETE!');
  console.log('==============================================\n');
  
  console.log('📍 Deployed Contracts:\n');
  deployments.forEach(d => {
    console.log(`   ${d.name}: ${d.address}`);
    console.log(`   View on Etherscan: https://sepolia.etherscan.io/address/${d.address}\n`);
  });

  console.log('📝 Next Steps:\n');
  console.log('1. Verify .env files have been updated');
  console.log('2. Start frontend: cd frontend && npm run dev');
  console.log('3. Connect MetaMask to Sepolia network');
  console.log('4. Test wallet connection and transaction analysis\n');

  rl.close();
}

async function deployContract(wallet, contractName) {
  try {
    const artifactPath = path.join(
      __dirname,
      '..',
      'artifacts',
      'contracts',
      'solidity',
      `${contractName}.sol`,
      `${contractName}.json`
    );

    if (!fs.existsSync(artifactPath)) {
      console.log(`❌ Contract artifact not found: ${contractName}`);
      console.log('   Run: npm run compile');
      return null;
    }

    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

    console.log(`   Deploying ${contractName}...`);
    const contract = await factory.deploy();
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    console.log(`   ✅ ${contractName} deployed to: ${address}\n`);

    return { contract, address };
  } catch (error) {
    console.log(`   ❌ Failed to deploy ${contractName}:`, error.message);
    return null;
  }
}

async function updateEnvFiles(deployments) {
  // Update backend/.env
  const backendEnvPath = path.join(__dirname, '..', '..', 'backend', '.env');
  let backendEnv = fs.readFileSync(backendEnvPath, 'utf8');

  deployments.forEach(d => {
    if (d.name === 'EscrowV2') {
      backendEnv = backendEnv.replace(/ESCROW_V2_CONTRACT=.*/, `ESCROW_V2_CONTRACT=${d.address}`);
    } else if (d.name === 'Escrow') {
      backendEnv = backendEnv.replace(/EVM_ESCROW_CONTRACT=.*/, `EVM_ESCROW_CONTRACT=${d.address}`);
    } else if (d.name === 'IdentityReveal') {
      backendEnv = backendEnv.replace(/EVM_IDENTITY_REVEAL_CONTRACT=.*/, `EVM_IDENTITY_REVEAL_CONTRACT=${d.address}`);
    }
  });

  fs.writeFileSync(backendEnvPath, backendEnv);
  console.log('   ✅ Updated backend/.env');

  // Update frontend/.env
  const frontendEnvPath = path.join(__dirname, '..', '..', 'frontend', '.env');
  let frontendEnv = fs.readFileSync(frontendEnvPath, 'utf8');

  deployments.forEach(d => {
    if (d.name === 'EscrowV2') {
      frontendEnv = frontendEnv.replace(/VITE_ESCROW_V2_CONTRACT=.*/, `VITE_ESCROW_V2_CONTRACT=${d.address}`);
    } else if (d.name === 'Escrow') {
      frontendEnv = frontendEnv.replace(/VITE_EVM_ESCROW_CONTRACT=.*/, `VITE_EVM_ESCROW_CONTRACT=${d.address}`);
    } else if (d.name === 'IdentityReveal') {
      frontendEnv = frontendEnv.replace(/VITE_EVM_IDENTITY_REVEAL_CONTRACT=.*/, `VITE_EVM_IDENTITY_REVEAL_CONTRACT=${d.address}`);
    }
  });

  fs.writeFileSync(frontendEnvPath, frontendEnv);
  console.log('   ✅ Updated frontend/.env\n');
}

// Run deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Deployment failed:', error);
    rl.close();
    process.exit(1);
  });
