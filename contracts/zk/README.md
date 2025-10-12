# ZK Circuits

This directory contains Zero-Knowledge proof circuits for wallet activity verification.

## Circuit: activityVerifier.circom

Proves that a wallet's activity score meets a minimum threshold without revealing:
- The exact score
- The wallet address
- Transaction history

### How It Works

1. **Wallet Analysis** - Frontend analyzes wallet's on-chain activity:
   - Balance (400 points max)
   - Transaction count (400 points max)
   - Activity consistency (200 points max)
   - Total score: 0-1000

2. **ZK Proof Generation** - Proves `activity_score >= threshold` (e.g., 500)

3. **Privacy** - Only reveals: "This wallet meets the requirement" ✅

### Inputs

**Public:**
- `threshold`: Minimum required activity score (e.g., 500)

**Private:**
- `activity_score`: Calculated score 0-1000 (kept secret)
- `wallet_address`: The wallet being analyzed (kept secret)
- `salt`: Random value for commitment privacy

**Output:**
- `commitment`: Hash of (activity_score, wallet_address, salt) using Poseidon
- `isAboveThreshold`: Boolean proof result

### Building the Circuit

#### Prerequisites

```bash
# Install Circom
# Download from https://github.com/iden3/circom/releases
# Or: cargo install circom

# Install SnarkJS
npm install -g snarkjs
```

#### Build Steps

```bash
cd contracts/zk

# Step 1: Compile circuit
circom activityVerifier.circom --r1cs --wasm --sym -o build

# Step 2: Powers of Tau ceremony (only once)
snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="First contribution" -v
snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v

# Step 3: Generate zkey for your circuit
snarkjs groth16 setup build/activityVerifier.r1cs pot12_final.ptau activityVerifier_0000.zkey
snarkjs zkey contribute activityVerifier_0000.zkey activityVerifier_final.zkey --name="Circuit contribution" -v

# Step 4: Export verification key
snarkjs zkey export verificationkey activityVerifier_final.zkey verification_key.json

# Step 5: (Optional) Generate Solidity verifier
snarkjs zkey export solidityverifier activityVerifier_final.zkey Verifier.sol

```

#### Copy Files to Backend

```bash
# Copy built circuit files to backend for proof generation
cp build/activityVerifier_js/activityVerifier.wasm ../../backend/src/zk/
cp activityVerifier_final.zkey ../../backend/src/zk/
cp verification_key.json ../../backend/src/zk/
```

---

## Testing the Circuit

### Generate Test Proof

Create `test_input.json`:

```json
{
  "activity_score": "750",
  "wallet_address": "1234567890",
  "salt": "999999",
  "threshold": "500"
}
```

Generate witness and proof:

```bash
cd build

# Generate witness
node activityVerifier_js/generate_witness.js \
  activityVerifier_js/activityVerifier.wasm \
  ../test_input.json \
  witness.wtns

# Generate proof
snarkjs groth16 prove ../activityVerifier_final.zkey witness.wtns proof.json public.json

# Verify proof
snarkjs groth16 verify ../verification_key.json public.json proof.json
```

Expected output: `✅ Proof is valid`

---

## Integration with Backend

The backend uses SnarkJS to generate proofs programmatically:

```javascript
// backend/src/services/zkService.js

const snarkjs = require('snarkjs');
const fs = require('fs');

async function generateActivityProof(walletData) {
  // Calculate activity score from wallet analysis
  const activityScore = calculateActivityScore(walletData);
  
  // Prepare circuit inputs
  const input = {
    activity_score: activityScore.toString(),
    wallet_address: walletData.address,
    salt: generateRandomSalt(),
    threshold: "500"
  };
  
  // Generate proof
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    'src/zk/activityVerifier.wasm',
    'src/zk/activityVerifier_final.zkey'
  );
  
  return { proof, publicSignals };
}
```

---

## Privacy Guarantees

### What's Hidden (Private Inputs)
- ✅ Exact activity score (only proves ≥ threshold)
- ✅ Wallet address (commitment hides it)
- ✅ Transaction history details
- ✅ Balance amounts

### What's Revealed (Public Inputs)
- ✅ Threshold requirement (e.g., 500)
- ✅ Commitment hash (binds proof to specific wallet without revealing it)
- ✅ Boolean: "Meets requirement" or "Doesn't meet requirement"

### Why This Matters
```
Traditional loan: "Show me your bank statement" ❌
  - Reveals all transactions
  - Reveals exact balance
  - Privacy invasion

ZK loan: "Prove your score ≥ 500" ✅
  - No transaction details shared
  - No exact balance revealed
  - Privacy preserved
```

---

## Circuit Constraints

The `activityVerifier.circom` circuit has these constraints:

1. **Commitment Verification**
   ```
   commitment = Poseidon(activity_score, wallet_address, salt)
   ```

2. **Threshold Check**
   ```
   activity_score >= threshold
   ```

3. **Max Score Validation**
   ```
   activity_score <= 1000
   ```

Total constraints: ~1000 (efficient for in-browser proof generation)

---

## Trusted Setup

The Powers of Tau ceremony creates cryptographic parameters for the ZK proofs.

**Security Notes:**
- ✅ Powers of Tau is reusable across circuits
- ✅ Phase 2 (circuit-specific) must be done per circuit
- ✅ Contributions add randomness (the more, the better)
- ✅ Only ONE honest participant needed for security

**For Production:**
- Run multi-party ceremony
- Document all contributors
- Publish parameters publicly
- Consider using existing ceremonies (Hermez, Tornado Cash)

---

## File Outputs

After building, you'll have:

```
contracts/zk/
├── activityVerifier.circom          # Source circuit
├── build/
│   ├── activityVerifier.r1cs        # Constraint system
│   ├── activityVerifier.sym         # Symbols
│   ├── activityVerifier_js/
│   │   ├── activityVerifier.wasm    # ⭐ Copy to backend
│   │   └── generate_witness.js
│   └── ...
├── activityVerifier_final.zkey      # ⭐ Copy to backend
├── verification_key.json            # ⭐ Copy to backend
├── pot12_final.ptau                 # Powers of Tau (keep for other circuits)
└── README.md
```

---

## Troubleshooting

### "Circuit too large" error
- Reduce field sizes in comparators
- Use smaller Poseidon hash (currently using 3 inputs)

### "Witness generation failed"
- Check input values are numeric strings
- Verify all required inputs provided
- Check values are within field size (< 2^254)

### "Proof verification failed"
- Ensure using same zkey for prove and verify
- Check public inputs match
- Verify witness generated correctly

---

## Resources

- **Circom Documentation:** https://docs.circom.io/
- **SnarkJS Guide:** https://github.com/iden3/snarkjs
- **ZK Protocols:** https://zkp.science/
- **Poseidon Hash:** https://eprint.iacr.org/2019/458.pdf

---

## Next Steps

1. ✅ Build circuit: `circom activityVerifier.circom ...`
2. ✅ Generate trusted setup
3. ✅ Copy files to backend
4. ✅ Test proof generation with sample data
5. ✅ Integrate with frontend wallet analyzer
6. ✅ Deploy and test end-to-end

Ready to build your ZK circuit! 🔐


```json
{
  "salary": "50000",
  "threshold": "30000",
  "salt": "123456789"
}
```

## Security Considerations

1. **Client-Side Proof Generation**: For maximum privacy, proofs should be generated client-side
2. **Salt**: Always use a cryptographically secure random salt
3. **Commitment**: The commitment binds the salary value and prevents tampering
4. **Trusted Setup**: In production, use a multi-party computation ceremony for the trusted setup

## Dependencies

- circom ^2.0.0
- snarkjs ^0.7.0
- circomlib
