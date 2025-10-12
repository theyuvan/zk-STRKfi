/**
 * Deploy StarkNet Smart Contracts to Sepolia Testnet
 * 
 * Prerequisites:
 * 1. Install Starkli: https://book.starkli.rs/installation
 * 2. Create account: starkli account fetch <address> --output ~/.starkli-wallets/deployer/account.json
 * 3. Set environment variables (see below)
 * 
 * Required Environment Variables:
 * - STARKNET_RPC_URL: RPC endpoint (e.g., https://starknet-sepolia.public.blastapi.io)
 * - STARKNET_ACCOUNT: Path to account JSON file
 * - STARKNET_KEYSTORE: Path to keystore file
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

// Configuration
const RPC_URL = process.env.STARKNET_RPC_URL || 'https://starknet-sepolia.public.blastapi.io';
const STRK_TOKEN_ADDRESS = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';
const ACCOUNT_FILE = process.env.STARKNET_ACCOUNT;
const KEYSTORE_FILE = process.env.STARKNET_KEYSTORE;

// Contract paths (Sierra JSON files after compilation)
const CONTRACTS_DIR = path.join(__dirname, '..', 'target', 'dev');
const VERIFIER_SIERRA = path.join(CONTRACTS_DIR, 'loan_escrow_ActivityVerifier.contract_class.json');
const LOAN_ESCROW_SIERRA = path.join(CONTRACTS_DIR, 'loan_escrow_LoanEscrow.contract_class.json');

// Output file for deployed addresses
const OUTPUT_FILE = path.join(__dirname, 'deployed_contracts.json');

async function runCommand(command, description) {
  console.log(`\n🔄 ${description}...`);
  console.log(`   Command: ${command}\n`);
  
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stderr && !stderr.includes('warning')) {
      console.error('⚠️  Stderr:', stderr);
    }
    console.log('✅ Success:', stdout.trim());
    return stdout.trim();
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    if (error.stdout) console.error('Stdout:', error.stdout);
    if (error.stderr) console.error('Stderr:', error.stderr);
    throw error;
  }
}

async function checkPrerequisites() {
  console.log('🔍 Checking prerequisites...\n');
  
  // Check starkli installed
  try {
    await execAsync('starkli --version');
    console.log('✅ Starkli is installed');
  } catch (error) {
    console.error('❌ Starkli is not installed. Install from: https://book.starkli.rs/installation');
    process.exit(1);
  }
  
  // Check scarb installed
  try {
    await execAsync('scarb --version');
    console.log('✅ Scarb is installed');
  } catch (error) {
    console.error('❌ Scarb is not installed. Install from: https://docs.swmansion.com/scarb/download.html');
    process.exit(1);
  }
  
  // Check account and keystore
  if (!ACCOUNT_FILE) {
    console.error('❌ STARKNET_ACCOUNT environment variable not set');
    console.log('   Create account with: starkli account fetch <address> --output account.json');
    process.exit(1);
  }
  
  if (!KEYSTORE_FILE) {
    console.error('❌ STARKNET_KEYSTORE environment variable not set');
    console.log('   Create keystore with: starkli signer keystore from-key keystore.json');
    process.exit(1);
  }
  
  console.log('✅ Account file:', ACCOUNT_FILE);
  console.log('✅ Keystore file:', KEYSTORE_FILE);
  console.log('✅ RPC URL:', RPC_URL);
  console.log('✅ STRK Token:', STRK_TOKEN_ADDRESS);
}

async function compileContracts() {
  console.log('\n📦 Compiling contracts...\n');
  
  const scarbDir = path.join(__dirname, '..');
  await runCommand(
    `cd ${scarbDir} && scarb build`,
    'Compiling Cairo contracts with Scarb'
  );
  
  // Check compiled files exist
  try {
    await fs.access(VERIFIER_SIERRA);
    console.log('✅ ActivityVerifier compiled:', VERIFIER_SIERRA);
  } catch {
    console.warn('⚠️  ActivityVerifier not found (might be in loan_escrow_v2)');
  }
  
  try {
    await fs.access(LOAN_ESCROW_SIERRA);
    console.log('✅ LoanEscrow compiled:', LOAN_ESCROW_SIERRA);
  } catch {
    console.error('❌ LoanEscrow compilation not found');
    throw new Error('Contract compilation failed');
  }
}

async function declareContract(sierraPath, contractName) {
  console.log(`\n📝 Declaring ${contractName}...`);
  
  const command = `starkli declare ${sierraPath} --rpc ${RPC_URL} --account ${ACCOUNT_FILE} --keystore ${KEYSTORE_FILE}`;
  
  const output = await runCommand(command, `Declaring ${contractName}`);
  
  // Extract class hash from output
  const classHashMatch = output.match(/Class hash declared:\s*(0x[a-fA-F0-9]+)/);
  if (!classHashMatch) {
    throw new Error(`Could not extract class hash from output: ${output}`);
  }
  
  const classHash = classHashMatch[1];
  console.log(`✅ ${contractName} class hash: ${classHash}`);
  
  return classHash;
}

async function deployContract(classHash, constructorArgs, contractName) {
  console.log(`\n🚀 Deploying ${contractName}...`);
  
  const argsString = constructorArgs.join(' ');
  const command = `starkli deploy ${classHash} ${argsString} --rpc ${RPC_URL} --account ${ACCOUNT_FILE} --keystore ${KEYSTORE_FILE}`;
  
  const output = await runCommand(command, `Deploying ${contractName}`);
  
  // Extract contract address from output
  const addressMatch = output.match(/Contract deployed:\s*(0x[a-fA-F0-9]+)/);
  if (!addressMatch) {
    throw new Error(`Could not extract contract address from output: ${output}`);
  }
  
  const contractAddress = addressMatch[1];
  console.log(`✅ ${contractName} deployed at: ${contractAddress}`);
  
  return contractAddress;
}

async function saveDeployedAddresses(addresses) {
  console.log('\n💾 Saving deployed addresses...');
  
  const data = {
    network: 'starknet-sepolia',
    deployedAt: new Date().toISOString(),
    rpcUrl: RPC_URL,
    contracts: addresses,
    strkToken: STRK_TOKEN_ADDRESS,
  };
  
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(data, null, 2));
  console.log(`✅ Addresses saved to: ${OUTPUT_FILE}`);
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   StarkNet Smart Contract Deployment - Sepolia        ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  try {
    // Step 1: Check prerequisites
    await checkPrerequisites();
    
    // Step 2: Compile contracts
    await compileContracts();
    
    // Step 3: Declare ActivityVerifier
    let verifierClassHash;
    try {
      verifierClassHash = await declareContract(
        path.join(CONTRACTS_DIR, 'loan_escrow_ActivityVerifier.contract_class.json'),
        'ActivityVerifier'
      );
    } catch (error) {
      console.log('⚠️  Trying alternative path for ActivityVerifier...');
      const altPath = path.join(CONTRACTS_DIR, 'loan_escrow_activity_verifier_ActivityVerifier.contract_class.json');
      verifierClassHash = await declareContract(altPath, 'ActivityVerifier');
    }
    
    // Step 4: Deploy ActivityVerifier (no constructor args)
    const verifierAddress = await deployContract(
      verifierClassHash,
      [], // No constructor args
      'ActivityVerifier'
    );
    
    // Step 5: Declare LoanEscrow
    let loanEscrowClassHash;
    try {
      loanEscrowClassHash = await declareContract(
        path.join(CONTRACTS_DIR, 'loan_escrow_LoanEscrow.contract_class.json'),
        'LoanEscrow'
      );
    } catch (error) {
      console.log('⚠️  Trying loan_escrow_v2...');
      const altPath = path.join(CONTRACTS_DIR, 'loan_escrow_loan_escrow_v2_LoanEscrow.contract_class.json');
      loanEscrowClassHash = await declareContract(altPath, 'LoanEscrow');
    }
    
    // Step 6: Deploy LoanEscrow with STRK token address
    const loanEscrowAddress = await deployContract(
      loanEscrowClassHash,
      [STRK_TOKEN_ADDRESS], // Constructor arg: STRK token address
      'LoanEscrow'
    );
    
    // Step 7: Save deployed addresses
    const deployedAddresses = {
      activityVerifier: {
        classHash: verifierClassHash,
        address: verifierAddress,
      },
      loanEscrow: {
        classHash: loanEscrowClassHash,
        address: loanEscrowAddress,
      },
    };
    
    await saveDeployedAddresses(deployedAddresses);
    
    // Success summary
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║            🎉 DEPLOYMENT SUCCESSFUL 🎉                 ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
    console.log('📋 Deployed Contracts:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`ActivityVerifier: ${verifierAddress}`);
    console.log(`LoanEscrow:       ${loanEscrowAddress}`);
    console.log(`STRK Token:       ${STRK_TOKEN_ADDRESS}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('📝 Next Steps:');
    console.log('1. Update frontend .env:');
    console.log(`   VITE_LOAN_ESCROW_CONTRACT=${loanEscrowAddress}`);
    console.log(`   VITE_VERIFIER_CONTRACT=${verifierAddress}`);
    console.log('');
    console.log('2. Update backend .env:');
    console.log(`   STARKNET_LOAN_ESCROW_CONTRACT=${loanEscrowAddress}`);
    console.log(`   STARKNET_VERIFIER_CONTRACT=${verifierAddress}`);
    console.log('');
    console.log('3. Verify contracts on Voyager:');
    console.log(`   https://sepolia.voyager.online/contract/${loanEscrowAddress}`);
    console.log(`   https://sepolia.voyager.online/contract/${verifierAddress}`);
    
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

// Run deployment
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { main };
