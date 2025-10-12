/**
 * Deploy StarkNet Smart Contracts to Sepolia Testnet (Using WSL)
 * 
 * Prerequisites:
 * 1. Starkli installed in WSL
 * 2. Scarb installed in WSL
 * 3. StarkNet account setup
 * 4. Testnet STRK tokens for gas
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

// Configuration
const RPC_URL = process.env.STARKNET_RPC_URL || 'https://starknet-sepolia.public.blastapi.io';
const STRK_TOKEN_ADDRESS = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';

// WSL paths
const WSL_PROJECT_PATH = '/mnt/c/zk-affordability-loan/contracts/starknet';
const WSL_STARKLI_ENV = 'source /home/thame/.starkli/env';

// Contract paths (relative to starknet directory)
const VERIFIER_SIERRA = 'target/dev/loan_escrow_ActivityVerifier.contract_class.json';
const LOAN_ESCROW_V2_SIERRA = 'target/dev/loan_escrow_loan_escrow_loan_escrow_v2_LoanEscrow.contract_class.json';

// Output file
const OUTPUT_FILE = path.join(__dirname, 'deployed_contracts.json');

async function runWSLCommand(command, description) {
  const fullCommand = `wsl bash -c "${WSL_STARKLI_ENV} ; cd ${WSL_PROJECT_PATH} ; ${command}"`;
  
  console.log(`\n🔄 ${description}...`);
  console.log(`   Command: ${command}\n`);
  
  try {
    const { stdout, stderr } = await execAsync(fullCommand, { maxBuffer: 10 * 1024 * 1024 });
    if (stderr && !stderr.includes('warning')) {
      console.error('⚠️  Stderr:', stderr);
    }
    console.log('✅ Output:', stdout.trim());
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
  
  // Check starkli
  try {
    const version = await runWSLCommand('starkli --version', 'Checking Starkli version');
    console.log(`   ✅ Starkli installed: ${version}`);
  } catch (error) {
    console.error('\n❌ Starkli is not installed in WSL.');
    console.error('   Install with: wsl bash -c "source /home/thame/.starkli/env ; starkliup"');
    throw error;
  }
  
  // Check scarb
  try {
    const version = await runWSLCommand('/home/thame/.local/bin/scarb --version', 'Checking Scarb version');
    console.log(`   ✅ Scarb installed: ${version}`);
  } catch (error) {
    console.error('\n❌ Scarb is not installed in WSL.');
    throw error;
  }
  
  // Check compiled contracts exist
  const contractsExist = await runWSLCommand(
    `test -f ${VERIFIER_SIERRA} && test -f ${LOAN_ESCROW_V2_SIERRA} && echo "OK" || echo "MISSING"`,
    'Checking compiled contracts'
  );
  
  if (!contractsExist.includes('OK')) {
    console.error('\n❌ Compiled contracts not found. Run: scarb build');
    throw new Error('Contracts not compiled');
  }
  console.log('   ✅ Compiled contracts found');
  
  console.log('\n✅ All prerequisites met!\n');
}

async function declareContract(sierraPath, contractName) {
  console.log(`\n📜 Declaring ${contractName}...`);
  
  const output = await runWSLCommand(
    `starkli declare ${sierraPath} --account ~/.starkli-wallets/account.json --keystore ~/.starkli-wallets/deployer.json --rpc ${RPC_URL}`,
    `Declaring ${contractName}`
  );
  
  // Extract class hash from output
  const classHashMatch = output.match(/Class hash declared:\s*(0x[0-9a-fA-F]+)/);
  if (!classHashMatch) {
    // Try alternative format
    const altMatch = output.match(/(0x[0-9a-fA-F]{64})/);
    if (altMatch) {
      console.log(`   ✅ Class hash: ${altMatch[1]}`);
      return altMatch[1];
    }
    throw new Error('Could not extract class hash from output');
  }
  
  const classHash = classHashMatch[1];
  console.log(`   ✅ Class hash: ${classHash}`);
  return classHash;
}

async function deployContract(classHash, constructorArgs, contractName) {
  console.log(`\n🚀 Deploying ${contractName}...`);
  
  const argsString = constructorArgs.join(' ');
  const output = await runWSLCommand(
    `starkli deploy ${classHash} ${argsString} --account ~/.starkli-wallets/account.json --keystore ~/.starkli-wallets/deployer.json --rpc ${RPC_URL}`,
    `Deploying ${contractName}`
  );
  
  // Extract contract address from output
  const addressMatch = output.match(/Contract deployed:\s*(0x[0-9a-fA-F]+)/);
  if (!addressMatch) {
    // Try alternative format
    const altMatch = output.match(/(0x[0-9a-fA-F]{64})/);
    if (altMatch) {
      console.log(`   ✅ Contract address: ${altMatch[1]}`);
      return altMatch[1];
    }
    throw new Error('Could not extract contract address from output');
  }
  
  const address = addressMatch[1];
  console.log(`   ✅ Contract address: ${address}`);
  return address;
}

async function saveDeployedAddresses(addresses) {
  console.log('\n💾 Saving deployed addresses...');
  
  const data = {
    network: 'starknet-sepolia',
    deployed_at: new Date().toISOString(),
    contracts: addresses,
    strk_token_address: STRK_TOKEN_ADDRESS
  };
  
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(data, null, 2));
  console.log(`   ✅ Saved to: ${OUTPUT_FILE}`);
  
  return data;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   StarkNet Contract Deployment - Sepolia (WSL)       ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  try {
    // Step 1: Check prerequisites
    await checkPrerequisites();
    
    // Step 2: Declare ActivityVerifier
    console.log('\n' + '═'.repeat(60));
    console.log('STEP 1: Declare ActivityVerifier Contract');
    console.log('═'.repeat(60));
    
    const verifierClassHash = await declareContract(VERIFIER_SIERRA, 'ActivityVerifier');
    
    // Step 3: Deploy ActivityVerifier
    console.log('\n' + '═'.repeat(60));
    console.log('STEP 2: Deploy ActivityVerifier Contract');
    console.log('═'.repeat(60));
    
    const verifierAddress = await deployContract(verifierClassHash, [], 'ActivityVerifier');
    
    // Step 4: Declare LoanEscrow V2
    console.log('\n' + '═'.repeat(60));
    console.log('STEP 3: Declare LoanEscrow V2 Contract');
    console.log('═'.repeat(60));
    
    const loanEscrowClassHash = await declareContract(LOAN_ESCROW_V2_SIERRA, 'LoanEscrow V2');
    
    // Step 5: Deploy LoanEscrow V2 (with STRK token address as constructor arg)
    console.log('\n' + '═'.repeat(60));
    console.log('STEP 4: Deploy LoanEscrow V2 Contract');
    console.log('═'.repeat(60));
    console.log(`   Constructor arg: STRK Token = ${STRK_TOKEN_ADDRESS}`);
    
    const loanEscrowAddress = await deployContract(
      loanEscrowClassHash,
      [STRK_TOKEN_ADDRESS],
      'LoanEscrow V2'
    );
    
    // Step 6: Save addresses
    const deployedAddresses = {
      activity_verifier: {
        class_hash: verifierClassHash,
        address: verifierAddress
      },
      loan_escrow_v2: {
        class_hash: loanEscrowClassHash,
        address: loanEscrowAddress
      }
    };
    
    const result = await saveDeployedAddresses(deployedAddresses);
    
    // Print summary
    console.log('\n' + '═'.repeat(60));
    console.log('✅ DEPLOYMENT SUCCESSFUL!');
    console.log('═'.repeat(60));
    console.log('\n📋 Deployed Contracts:\n');
    console.log(`   ActivityVerifier:`);
    console.log(`      Address: ${verifierAddress}`);
    console.log(`      Class Hash: ${verifierClassHash}`);
    console.log(`\n   LoanEscrow V2 (STRK Integration):`);
    console.log(`      Address: ${loanEscrowAddress}`);
    console.log(`      Class Hash: ${loanEscrowClassHash}`);
    console.log(`\n   STRK Token: ${STRK_TOKEN_ADDRESS}`);
    
    console.log('\n🔍 Verify on Voyager:');
    console.log(`   ActivityVerifier: https://sepolia.voyager.online/contract/${verifierAddress}`);
    console.log(`   LoanEscrow V2: https://sepolia.voyager.online/contract/${loanEscrowAddress}`);
    
    console.log('\n📝 Next Steps:');
    console.log('   1. Update frontend/.env:');
    console.log(`      VITE_LOAN_ESCROW_CONTRACT=${loanEscrowAddress}`);
    console.log(`      VITE_VERIFIER_CONTRACT=${verifierAddress}`);
    console.log('\n   2. Update backend/.env:');
    console.log(`      STARKNET_LOAN_ESCROW_CONTRACT=${loanEscrowAddress}`);
    console.log(`      STARKNET_VERIFIER_CONTRACT=${verifierAddress}`);
    
    console.log('\n' + '═'.repeat(60));
    
  } catch (error) {
    console.error('\n' + '═'.repeat(60));
    console.error('❌ DEPLOYMENT FAILED');
    console.error('═'.repeat(60));
    console.error(`\nError: ${error.message}`);
    console.error('\nPlease check:');
    console.error('   1. You have a StarkNet account setup in WSL');
    console.error('   2. You have testnet STRK tokens for gas fees');
    console.error('   3. The RPC URL is accessible');
    console.error('   4. Starkli is properly configured\n');
    process.exit(1);
  }
}

// Run deployment
main();
