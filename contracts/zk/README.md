# ZK Circuits

This directory contains Zero-Knowledge proof circuits for income verification.

## Circuit: incomeVerifier.circom

Proves that a borrower's salary meets a minimum threshold without revealing the exact amount.

### Inputs

**Public:**
- `threshold`: Minimum required salary

**Private:**
- `salary`: Borrower's actual salary
- `salt`: Random value for privacy

**Output:**
- `commitment`: Hash of salary and salt (Poseidon hash)

### Building the Circuit

```bash
# From project root
npm run build:circuits
```

Or manually:

```bash
cd contracts/zk

# Compile circuit
circom incomeVerifier.circom --r1cs --wasm --sym -o build

# Generate witness (with example inputs)
cd build
node incomeVerifier_js/generate_witness.js incomeVerifier_js/incomeVerifier.wasm ../input.json witness.wtns

# Setup (Powers of Tau ceremony)
snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="First contribution" -v
snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v

# Generate zkey
snarkjs groth16 setup ../incomeVerifier.r1cs pot12_final.ptau incomeVerifier_0000.zkey
snarkjs zkey contribute incomeVerifier_0000.zkey incomeVerifier.zkey --name="Contribution" -v

# Export verification key
snarkjs zkey export verificationkey incomeVerifier.zkey verification_key.json

# Export Solidity verifier (optional)
snarkjs zkey export solidityverifier incomeVerifier.zkey verifier.sol
```

### Generating Proofs

```bash
cd build

# Generate proof
snarkjs groth16 prove incomeVerifier.zkey witness.wtns proof.json public.json

# Verify proof
snarkjs groth16 verify verification_key.json public.json proof.json
```

### Example Input

Create `input.json`:

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
