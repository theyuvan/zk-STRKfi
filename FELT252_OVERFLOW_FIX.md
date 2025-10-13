# 🔧 Felt252 Overflow Fix - ZK Proof Application

## 🐛 The Problem

When borrower tried to apply for a loan, the transaction failed with:
```
-32602: Invalid params: {"reason":"felt overflow"}
```

### Root Cause
The **proof_hash** returned by the backend is a SHA256 hash (256 bits / 64 hex characters), but StarkNet's `felt252` type can only hold **252 bits** (maximum 63 hex characters).

**SHA256 Hash:** 256 bits = 64 hex chars
**felt252 Max:** 252 bits = 63 hex chars

---

## 🔍 Understanding the Error

### What is felt252?
- **felt** = Field Element
- **252** = Number of bits
- StarkNet's basic data type for storing numbers
- Maximum value: `2^252 - 1` (approximately `10^76`)

### Why SHA256 Doesn't Fit
```
SHA256 output: 256 bits
felt252 capacity: 252 bits
Overflow: 256 - 252 = 4 bits too large ❌
```

### Error in Calldata
Looking at the failed transaction calldata:
```javascript
"calldata": [
  "0x1",
  "0x5a4d3ed7d102ab91715c2b36c70b5e9795a3e917214dbd9af40503d2c29f83d",
  "0x2f6f4b5086faab89e39c154432d7e3d9afd526a7ded69c70bac1a3175ea19e",
  "0x7",
  "0x1e",  // ← loan_id.low
  "0x0",   // ← loan_id.high
  "0x3",   // ← array length? (unexpected)
  "0x36383835633332613837633530663665636632343035623731323130386630",  // ← proof_hash (TOO LONG!)
  "0x64633964333335656231663865393163353631313330383932333961653263",
  "0x6261",
  "0x189bfffa9b7bcd5d88c5ef3da4147ecd90ca83d26e5c03784cbe702547d66880"  // ← commitment
]
```

The proof_hash appears to be split into 3 parts (indicated by "0x3"), and each part is too long for felt252!

---

## ✅ The Solution

### Step 1: Truncate to 252 Bits

**File Changed:** `frontend/src/pages/LoanBorrowerFlowNew.jsx`

```javascript
// OLD (Broken) ❌
const applicationCalldata = CallData.compile({
  loan_id: loanIdU256,
  proof_hash: zkProof.proofHash,  // ❌ 64 hex chars (256 bits) - TOO LONG!
  commitment: zkProof.commitmentHash
});
```

```javascript
// NEW (Fixed) ✅
// Truncate proof_hash to fit in felt252 (max 63 hex chars)
let proofHashFelt = zkProof.proofHash;
let commitmentFelt = zkProof.commitmentHash;

if (typeof proofHashFelt === 'string') {
  // Remove '0x' prefix if present
  let hexStr = proofHashFelt.startsWith('0x') ? proofHashFelt.slice(2) : proofHashFelt;
  
  // Truncate to 63 hex characters (252 bits) to fit in felt252
  if (hexStr.length > 63) {
    hexStr = hexStr.slice(0, 63);  // ✅ Take first 252 bits
  }
  proofHashFelt = '0x' + hexStr;
}

// Same for commitment
if (typeof commitmentFelt === 'string') {
  let hexStr = commitmentFelt.startsWith('0x') ? commitmentFelt.slice(2) : commitmentFelt;
  if (hexStr.length > 63) {
    hexStr = hexStr.slice(0, 63);
  }
  commitmentFelt = '0x' + hexStr;
}

const applicationCalldata = CallData.compile({
  loan_id: loanIdU256,
  proof_hash: proofHashFelt,  // ✅ Max 63 hex chars (252 bits)
  commitment: commitmentFelt   // ✅ Max 63 hex chars (252 bits)
});
```

### Step 2: Add Validation Logging

```javascript
console.log('📊 Application parameters:', {
  loan_id: loanIdU256,
  proof_hash: proofHashFelt,
  proof_hash_length: proofHashFelt.length,  // Should be ≤ 65 (0x + 63 chars)
  commitment: commitmentFelt,
  commitment_length: commitmentFelt.length
});
```

---

## 📊 Bit Size Reference

### Data Type Limits

| Type | Bits | Max Hex Chars | Max Decimal | Example |
|------|------|---------------|-------------|---------|
| **felt252** | 252 | 63 | ~10^76 | StarkNet field element |
| **SHA256** | 256 | 64 | ~10^77 | Hash output |
| **u256** | 256 | 64 | 2^256-1 | Two felt252 (low, high) |
| **u128** | 128 | 32 | 2^128-1 | Half of u256 |

### Conversion Examples

```javascript
// Hex string to bits
"0x1234" → 16 bits (4 hex chars × 4 bits/char)
"0x" + "f".repeat(63) → 252 bits ✅ Fits in felt252
"0x" + "f".repeat(64) → 256 bits ❌ Overflows felt252

// Truncation
SHA256: "0x1234567890abcdef..." (64 chars)
Truncated: "0x1234567890abcdef..." (63 chars) ✅
```

---

## 🔐 Security Implications

### Q: Does truncating the hash reduce security?

**A: Minimal impact for this use case.**

**Original Security:**
- SHA256: 256 bits = 2^256 possible values
- Collision resistance: ~2^128 operations

**After Truncation:**
- Truncated: 252 bits = 2^252 possible values  
- Collision resistance: ~2^126 operations

**Difference:** 4 bits = 16x easier to find collisions

**But:**
- 2^126 is still astronomically large (~10^38)
- Finding a collision is computationally infeasible
- This is used for **identification**, not cryptographic security
- The actual ZK proof verification happens in the ActivityVerifier contract

### Alternative Approaches

#### Option 1: Use Pedersen Hash (StarkNet Native) ✅ BEST
```javascript
import { hash } from 'starknet';

// Instead of SHA256, use Pedersen hash (outputs felt252 directly)
const proofHash = hash.pedersen([
  proof.pi_a[0],
  proof.pi_a[1],
  proof.pi_b[0][0],
  // ...
]);
// Result is already felt252 compatible! ✅
```

#### Option 2: Split into Multiple felt252 (Current Smart Contract Issue)
```cairo
// Would need to change contract to accept two felt252
struct ProofHash {
  high: felt252,  // First 252 bits
  low: felt252    // Remaining 4 bits
}
```

#### Option 3: Use Keccak256 and Truncate (Current Solution) ✅ SIMPLE
```javascript
// Take first 252 bits of hash
const truncated = hashHex.slice(0, 63);
```

---

## 🧪 Testing the Fix

### Step 1: Check Proof Hash Length
```javascript
console.log('Original proof hash:', zkProof.proofHash);
// Expected: "0x1234...abcd" (66 chars = 0x + 64 hex)

console.log('After truncation:', proofHashFelt);
// Expected: "0x1234...abc" (65 chars = 0x + 63 hex)
```

### Step 2: Verify Transaction Succeeds
```
Before: ❌ felt overflow
After: ✅ Transaction succeeds
```

### Step 3: Check Smart Contract Storage
```cairo
// Contract should store truncated hash successfully
let app = self.applications.read((loan_id, commitment));
assert(app.proof_hash == truncated_hash, 'Hash mismatch');
```

---

## 📝 Backend Changes (Optional Improvement)

To avoid truncation in frontend, backend could return already-truncated hash:

**File:** `backend/src/controllers/proofController.js`

```javascript
// OLD
const proofHash = crypto.createHash('sha256')
  .update(JSON.stringify(proof))
  .digest('hex');  // Returns 64 hex chars

// NEW (Improved)
const fullHash = crypto.createHash('sha256')
  .update(JSON.stringify(proof))
  .digest('hex');

// Truncate to 252 bits (63 hex chars) for StarkNet compatibility
const proofHash = '0x' + fullHash.slice(0, 63);

res.json({
  // ...
  proofHash,  // Already truncated, ready for StarkNet ✅
  fullProofHash: '0x' + fullHash  // Keep full hash for reference
});
```

---

## ⚠️ Important Notes

### 1. Consistency is Critical
If you truncate the hash in the frontend, **always truncate the same way** when verifying:
```javascript
// Application (frontend)
const appHash = proofHash.slice(0, 63);

// Verification (contract)
let stored_hash = app.proof_hash;
assert(stored_hash == appHash, 'Mismatch');
```

### 2. Document the Truncation
Add comments in smart contract:
```cairo
// Note: proof_hash is truncated to 252 bits (first 63 hex chars of SHA256)
// Full SHA256 is 256 bits but felt252 can only hold 252 bits
proof_hash: felt252,
```

### 3. Consider Migration to Pedersen
For production, consider using StarkNet's native Pedersen hash:
```javascript
import { hash } from 'starknet';

// Native StarkNet hash - no truncation needed!
const proofHash = hash.pedersen(proofDataArray);
```

---

## 🎯 Expected Results

### Before Fix ❌
```
Error: felt overflow
Status: Transaction failed
Calldata: proof_hash too large (64+ hex chars)
```

### After Fix ✅
```
Transaction: 0x...
Status: Success ✅
Calldata: proof_hash fits perfectly (≤63 hex chars)
Console: 
  proof_hash_length: 65 (0x + 63 chars) ✅
  commitment_length: 65 (0x + 63 chars) ✅
```

---

## 📚 Resources

### StarkNet Data Types
- **felt252**: 252-bit field element (most common type)
- **u256**: 256-bit unsigned integer (stored as two felt252)
- **u128**: 128-bit unsigned integer (one felt252)

### Hash Functions
- **SHA256**: 256 bits output (not native to StarkNet)
- **Pedersen**: felt252 output (native to StarkNet) ✅
- **Poseidon**: felt252 output (newer, more efficient) ✅

### Best Practices
1. Use StarkNet-native hash functions when possible
2. Always validate bit sizes before passing to contract
3. Document any truncations clearly
4. Test with maximum-length inputs

---

## ✅ Summary

**Problem:** SHA256 hash (256 bits) doesn't fit in felt252 (252 bits)

**Solution:** Truncate to first 252 bits (63 hex characters)

**Impact:** Minimal security reduction (2^126 still astronomically secure)

**Status:** Fixed and ready to test! ✅

**Try applying for a loan again - it should work now!** 🚀
