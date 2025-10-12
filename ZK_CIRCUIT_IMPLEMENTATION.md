# ZK Circuit Implementation Guide

## Overview

You now have the **original zkService.js** without mock functionality. This guide will help you implement a complete Zero-Knowledge proof system for wallet activity verification.

## Current State

### ✅ What's Ready
- **zkService.js**: Clean implementation with all core methods
- **activityVerifier.circom**: Circuit file (exists in contracts/zk/)
- **Backend API**: Endpoints for proof preparation and generation
- **Frontend**: ZKProofGenerator component ready to use proofs
- **BigInt Fix**: Salt conversion properly handles hex strings

### ❌ What's Missing
- Circuit compiled files (.wasm, .zkey, verification_key.json)
- Build directory: `contracts/zk/build/`

## Step-by-Step Implementation

### Step 1: Install Circuit Compilation Tools

```bash
# Install circom compiler
# Windows: Download from https://github.com/iden3/circom/releases
# Or use WSL:
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
git clone https://github.com/iden3/circom.git
cd circom
cargo build --release
cargo install --path circom

# Install snarkjs globally (already in package.json but install globally for CLI)
npm install -g snarkjs
```

### Step 2: Review the Circuit

The circuit is at `contracts/zk/activityVerifier.circom`:

```circom
// Inputs (private):
- activity_score: Wallet score (0-1000)
- wallet_address: User's wallet address
- salt: Random value for privacy

// Inputs (public):
- threshold: Minimum score required

// Outputs (public):
- commitment: Hash of (score + address + salt)
- isAboveThreshold: 1 if valid, 0 if not

// Constraints:
1. commitment = Poseidon(activity_score, wallet_address, salt)
2. activity_score >= threshold
3. activity_score <= 1000
```

### Step 3: Compile the Circuit

```bash
cd contracts/zk

# Create build directory
mkdir -p build

# Compile circuit (generates .r1cs, .wasm, .sym)
circom activityVerifier.circom --r1cs --wasm --sym -o build

# This creates:
# - build/activityVerifier.r1cs (constraint system)
# - build/activityVerifier_js/activityVerifier.wasm (witness generator)
# - build/activityVerifier.sym (symbols for debugging)
```

### Step 4: Setup Trusted Setup (Powers of Tau)

```bash
cd build

# Download or generate Powers of Tau
# For testing, use a small ceremony (tau=12 supports circuits up to 2^12 constraints)
snarkjs powersoftau new bn128 12 pot12_0000.ptau -v

# Contribute to ceremony (adds randomness)
snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="First contribution" -v

# Prepare phase 2
snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v

# Generate .zkey (proving key) specific to your circuit
snarkjs groth16 setup ../activityVerifier.r1cs pot12_final.ptau activityVerifier_0000.zkey

# Contribute to circuit-specific setup
snarkjs zkey contribute activityVerifier_0000.zkey activityVerifier.zkey --name="Circuit contribution" -v

# Export verification key
snarkjs zkey export verificationkey activityVerifier.zkey verification_key.json
```

### Step 5: Verify Build Files

```bash
# Check that all required files exist:
ls build/

# Expected files:
# ✓ activityVerifier.wasm      (witness generator)
# ✓ activityVerifier.zkey      (proving key)
# ✓ verification_key.json      (verification key)
```

### Step 6: Test the Circuit

Create `contracts/zk/test-circuit.js`:

```javascript
const snarkjs = require('snarkjs');
const path = require('path');

async function testCircuit() {
  // Test inputs
  const input = {
    activity_score: "65",
    wallet_address: "12345678901234567890",  // Simplified for testing
    salt: "999",
    threshold: "50"
  };

  const wasmPath = path.join(__dirname, 'build/activityVerifier.wasm');
  const zkeyPath = path.join(__dirname, 'build/activityVerifier.zkey');

  console.log('Generating proof...');
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    wasmPath,
    zkeyPath
  );

  console.log('Proof generated!');
  console.log('Public signals:', publicSignals);
  console.log('Commitment:', publicSignals[0]);
  console.log('Is valid:', publicSignals[1]);

  // Verify the proof
  const vkeyPath = path.join(__dirname, 'build/verification_key.json');
  const vKey = require(vkeyPath);
  
  const verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);
  console.log('Verification result:', verified);
}

testCircuit().catch(console.error);
```

Run test:
```bash
cd contracts/zk
node test-circuit.js
```

### Step 7: Update Frontend to Use Real Wallet Address

The circuit expects `wallet_address` as an input. Update the proof preparation:

**frontend/src/components/ZKProofGenerator.jsx:**

```javascript
// In handlePrepareProof function, add wallet address:
const proofData = await prepareProofInputs(
  activityScore,
  threshold,
  walletAddress  // Add this - get from wallet connection
);
```

**backend/src/controllers/proofController.js:**

```javascript
// In prepareProofInputs endpoint:
const { activityScore, threshold, walletAddress } = req.body;

// Prepare inputs with wallet address
const inputs = zkService.prepareIncomeProofInputs(
  activityScore,
  threshold,
  salt,
  walletAddress  // Add wallet address
);
```

**backend/src/services/zkService.js:**

```javascript
// Update prepareIncomeProofInputs method:
prepareIncomeProofInputs(salary, threshold, salt, walletAddress) {
  // Convert wallet address to BigInt for circuit
  // Remove 0x prefix and convert hex to decimal
  const addressBigInt = BigInt(walletAddress.startsWith('0x') 
    ? walletAddress 
    : '0x' + walletAddress
  ).toString();

  return {
    activity_score: salary.toString(),
    threshold: threshold.toString(),
    salt: salt,
    wallet_address: addressBigInt
  };
}
```

### Step 8: Test Full Integration

1. **Start backend:**
   ```bash
   cd backend
   npm start
   ```

2. **Start frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Test workflow:**
   - Connect wallet
   - Analyze wallet activity (score: 65)
   - Prepare proof (threshold: 50)
   - Generate proof (should use real circuit now)
   - Submit loan request

## Troubleshooting

### Error: "ENOENT: no such file or directory, open '...activityVerifier.wasm'"

**Solution:** Circuit files not compiled. Run Step 3-4 above.

### Error: "Witness calculation failed"

**Solution:** Check input format. All inputs must be strings of decimal numbers:
```javascript
{
  activity_score: "65",      // ✓ String
  threshold: "50",           // ✓ String
  wallet_address: "12345",   // ✓ String (BigInt as decimal)
  salt: "646270f2..."        // ✓ String (hex or decimal)
}
```

### Error: "Proof verification failed"

**Possible causes:**
1. Wrong verification key (re-export from .zkey)
2. Public signals mismatch (check circuit outputs)
3. Corrupted proof (regenerate)

### Performance Issues

For faster proof generation:
1. Use smaller tau in Powers of Tau (tau=12 for < 4096 constraints)
2. Optimize circuit (reduce constraints)
3. Use WASM with threading (`--wasm --c` flags)

## Production Considerations

### Security

1. **Trusted Setup:**
   - For production, use a multi-party ceremony
   - Or use PLONK/STARK (no trusted setup required)
   - Current setup is only for testing

2. **Powers of Tau:**
   - For production, use a larger tau (14-20)
   - Download from trusted ceremony: https://github.com/iden3/snarkjs#7-prepare-phase-2

3. **Circuit Audit:**
   - Have the circuit audited by experts
   - Test with edge cases (max score, min score, boundary values)

### Performance

1. **Proof Generation Time:**
   - Current circuit: ~2-5 seconds on modern CPU
   - Consider server-side generation for mobile users

2. **Constraint Optimization:**
   - Current circuit: ~200-500 constraints
   - Each constraint adds ~1ms to proof time

### Scaling

1. **Batch Verification:**
   - Use Groth16 batch verification for multiple proofs
   - Reduces verification cost on-chain

2. **Recursive Proofs:**
   - For advanced use cases, use recursive SNARKs
   - Combine multiple proofs into one

## Alternative: Simplified Circuit (No Wallet Address)

If you want to test quickly without wallet address:

**contracts/zk/simpleActivityVerifier.circom:**

```circom
pragma circom 2.0.0;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/comparators.circom";

template SimpleActivityVerifier() {
    signal input salary;
    signal input threshold;
    signal input salt;
    
    signal output commitment;
    signal output isValid;
    
    // Commitment
    component hasher = Poseidon(2);
    hasher.inputs[0] <== salary;
    hasher.inputs[1] <== salt;
    commitment <== hasher.out;
    
    // Threshold check
    component gte = GreaterEqThan(64);
    gte.in[0] <== salary;
    gte.in[1] <== threshold;
    isValid <== gte.out;
}

component main {public [threshold]} = SimpleActivityVerifier();
```

This matches your original zkService inputs perfectly.

## Next Steps

1. **Compile circuit** (Steps 3-4)
2. **Test circuit** (Step 6)
3. **Update backend** (Step 7)
4. **Test full flow** (Step 8)
5. **Deploy to testnet**
6. **Audit and optimize**

## Resources

- **Circom Documentation:** https://docs.circom.io/
- **SnarkJS Guide:** https://github.com/iden3/snarkjs
- **Circomlib (Poseidon, etc.):** https://github.com/iden3/circomlib
- **ZK Learning:** https://zk-learning.org/
- **Groth16 Paper:** https://eprint.iacr.org/2016/260.pdf

## Summary

You now have:
1. ✅ Clean zkService.js (no mocks)
2. ✅ Circuit file (activityVerifier.circom)
3. ✅ BigInt fix for salt handling
4. ✅ Backend API ready
5. ✅ Frontend components ready

You need to:
1. ⏳ Install circom compiler
2. ⏳ Compile circuit files
3. ⏳ Run trusted setup
4. ⏳ Test circuit locally
5. ⏳ Test full integration

Estimated time: 30-60 minutes for first-time setup.

Good luck! 🚀
