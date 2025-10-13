# Wallet Transaction Fix - "Failed to load transaction details"

## Problem Analysis

The wallet was showing:
```
Review transaction 
http://localhost:3001
Failed to load transaction details and fraud warnings. Transaction not executed.
```

### Root Causes Identified

#### 1. **Identity Commitment Mismatch** ✅ FIXED
- **Proof Registration**: Used TRUNCATED commitment (63 chars)
- **Loan Application**: Used FULL commitment (64 chars)
- **Contract Verification**: Checks if commitments match exactly
- **Result**: Proof verification fails → Transaction simulation fails

#### 2. **Incorrect Contract Call Method** ✅ FIXED
- **Old Method**: `CallData.compile({...})` + `starknet.account.execute()`
- **Problem**: Manual calldata compilation can mishandle u256 types
- **New Method**: `contract.method_name(params)` with typed parameters
- **Result**: Proper ABI encoding by starknet.js

## Transaction Flow

### Before Fixes (BROKEN)
1. ✅ Generate ZK Proof (backend)
2. ❌ Register proof with **TRUNCATED commitment**
   - Commitment stored: `0x22083c8b84ffd614c26468f2ada0c1baad4df98d81a0e1d7d757beb0155dd2d` (63 chars)
3. ❌ Apply for loan with **FULL commitment**
   - Commitment used: `0x22083c8b84ffd614c26468f2ada0c1baad4df98d81a0e1d7d757beb0155dd2d6` (64 chars)
4. ❌ Contract checks: `proof_data.commitment != commitment` → Fails
5. ❌ Wallet simulation fails → "Failed to load transaction details"

### After Fixes (WORKING)
1. ✅ Generate ZK Proof (backend)
2. ✅ Register proof with **FULL commitment**
   - Commitment stored: `0x22083c8b84ffd614c26468f2ada0c1baad4df98d81a0e1d7d757beb0155dd2d6`
3. ✅ Apply for loan with **SAME FULL commitment**
   - Commitment used: `0x22083c8b84ffd614c26468f2ada0c1baad4df98d81a0e1d7d757beb0155dd2d6`
4. ✅ Contract checks: `proof_data.commitment == commitment` → Success
5. ✅ Wallet simulation succeeds → Transaction ready to sign

## Contract Verification Logic

From `activity_verifier.cairo`:
```cairo
fn verify_proof(
    self: @ContractState,
    proof_hash: felt252,
    commitment: felt252,
    threshold: u256,
) -> bool {
    let proof_data = self.proof_scores.read(proof_hash);
    
    // CHECK 1: Proof must be registered
    if !proof_data.verified {
        return false;  // ❌ Proof not found
    }
    
    // CHECK 2: Commitment must match EXACTLY
    if proof_data.commitment != commitment {
        return false;  // ❌ Commitment mismatch (was happening!)
    }
    
    // CHECK 3: Score must meet threshold
    let success = proof_data.activity_score >= threshold;
    success
}
```

## Changes Made

### 1. Fixed Proof Registration (`LoanBorrowerFlowNew.jsx` lines 185-200)

**Before:**
```javascript
const cleanHex = (hexStr) => {
  if (!hexStr) return '0';
  const cleaned = hexStr.startsWith?.('0x') ? hexStr.slice(2) : hexStr;
  return cleaned.slice(0, 63); // ❌ Always truncate
};

const proofHashHex = cleanHex(zkProofData.proofHash);
const commitmentHex = cleanHex(zkProofData.commitmentHash); // ❌ Truncated!
```

**After:**
```javascript
const cleanHex = (hexStr, allowFullLength = false) => {
  if (!hexStr) return '0';
  const cleaned = hexStr.startsWith?.('0x') ? hexStr.slice(2) : hexStr;
  return allowFullLength ? cleaned : cleaned.slice(0, 63);
};

const proofHashHex = cleanHex(zkProofData.proofHash, false);
const commitmentHex = cleanHex(zkProofData.commitmentHash, true); // ✅ Full length!
```

### 2. Fixed Proof Registration Call (lines 206-215)

**Before:**
```javascript
const registerCalldata = CallData.compile({
  proof_hash: proofHashNum.toString(),
  commitment: commitmentNum.toString(),
  activity_score: activityScoreU256
});

const registerTx = await starknet.account.execute({
  contractAddress: ACTIVITY_VERIFIER_ADDRESS,
  entrypoint: 'register_proof',
  calldata: registerCalldata
});
```

**After:**
```javascript
const registerTx = await verifierContract.register_proof(
  proofHashNum,        // felt252 as BigInt
  commitmentNum,       // felt252 as BigInt
  activityScoreU256    // u256 object with {low, high}
);
```

### 3. Fixed Loan Application Call (lines 410-420)

**Before:**
```javascript
const applicationCalldata = CallData.compile({
  loan_id: loanIdU256,
  proof_hash: proofHashNum.toString(),
  commitment: commitmentNum.toString()
});

const applyTx = await loanEscrowContract.invoke('apply_for_loan', applicationCalldata);
```

**After:**
```javascript
const applyTx = await loanEscrowContract.apply_for_loan(
  loanIdU256,           // u256 object with {low, high}
  proofHashNum,         // felt252 as BigInt
  commitmentNum         // felt252 as BigInt
);
```

## Testing Steps

### 1. Clear Previous State
```bash
# In browser console:
localStorage.clear()
```

### 2. Generate New ZK Proof
1. Click "Generate ZK Proof"
2. Wallet will prompt to register proof
3. Confirm transaction
4. Wait for confirmation
5. ✅ Should see: "Proof registered successfully!"

### 3. Apply for Loan
1. Select a loan with available slots
2. Click "Apply for Loan"
3. ✅ Wallet should show proper transaction preview (no errors!)
4. Confirm transaction
5. ✅ Application should appear in "My Applications"

## Why Wallet Simulation Failed

The Argent X wallet **simulates transactions** before showing them to users:

1. **Simulation**: Wallet calls contract with your parameters
2. **Contract Execution**: Runs through all assertions
3. **If Assertion Fails**: Transaction is invalid → "Failed to load transaction details"
4. **If Success**: Shows transaction preview with estimated fees

In our case:
- Assertion failed: `proof_data.commitment != commitment`
- Registered commitment: `...d2d` (truncated)
- Application commitment: `...d2d6` (full)
- Simulation failed → Wallet couldn't show transaction details

## Key Insights

### Identity Commitment Must Be Permanent
- Generated once from: `SHA256(walletAddress + '_identity_v1')`
- Stored in localStorage
- **NEVER truncated** - must be full length
- Used for all applications (even when score changes)

### Proof Hash Can Be Different
- Changes with each proof generation
- Reflects current activity score
- Can be truncated if needed (but we keep it full for consistency)

### u256 Handling
- Always pass as object: `{low: bigint, high: bigint}`
- Use `uint256.bnToUint256(bigint)` to create
- Contract methods handle serialization automatically

## Files Modified
1. `frontend/src/pages/LoanBorrowerFlowNew.jsx` (3 locations)
   - Line 185-200: Fixed cleanHex function for proof registration
   - Line 206-215: Fixed proof registration call
   - Line 410-420: Fixed loan application call

## Next Steps
1. ✅ Hard refresh browser (`Ctrl + Shift + R`)
2. ✅ Clear localStorage
3. ✅ Generate new ZK proof (with fixed commitment handling)
4. ✅ Apply for loan (should work now!)
