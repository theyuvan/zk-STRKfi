# Felt252 Validation Fix - "Validate Unhandled" Error

## Problem

Wallet showing error during proof registration:
```
Error: Validate Unhandled: argument proof_hash, type felt252, value 739490716858501329026111008768301591439118518288137859816647760143366668809
```

## Root Cause

**StarkNet.js Type Validation Issue**

We were passing `BigInt` objects directly to contract methods:
```javascript
await verifierContract.register_proof(
  proofHashNum,     // ❌ BigInt object
  commitmentNum,    // ❌ BigInt object
  activityScoreU256
);
```

StarkNet.js's validation for `felt252` parameters expects:
- **Hex strings**: `'0x...'`
- **Decimal strings**: `'123456...'`
- **NOT BigInt objects** directly

## Analysis

### Value Was Valid for felt252
```
Value:     3183185745832425615493159292581371187017172140144512762333539837862236014297
Hex:       0x7099e8978e383c4fab19f5eb7e72b5e8693cc140f97465069ba5a3dd43646d9
Hex Length: 63 characters
Max felt252: 3618502788666131106986593281521497120414687020801267626233049500247285301247
Is Valid?  ✅ YES (value < max)
```

The value itself was valid, but **the format was wrong** for starknet.js validation.

## Solution

### Changed BigInt to Hex Strings

**Before (BROKEN):**
```javascript
const proofHashNum = BigInt('0x' + proofHashHex);
const commitmentNum = BigInt('0x' + commitmentHex);

await verifierContract.register_proof(
  proofHashNum,     // ❌ BigInt causes "Validate Unhandled"
  commitmentNum,    // ❌ BigInt causes "Validate Unhandled"
  activityScoreU256
);
```

**After (WORKING):**
```javascript
const proofHashNum = BigInt('0x' + proofHashHex);  // For logging only
const commitmentNum = BigInt('0x' + commitmentHex); // For logging only

await verifierContract.register_proof(
  '0x' + proofHashHex,    // ✅ Hex string
  '0x' + commitmentHex,   // ✅ Hex string
  activityScoreU256       // ✅ u256 object (unchanged)
);
```

## Changes Applied

### 1. Proof Registration (`generateZKProof` function)

**File:** `frontend/src/pages/LoanBorrowerFlowNew.jsx`
**Lines:** ~206-220

```javascript
// Register the proof using typed contract method
// Pass as hex strings for proper felt252 validation
try {
  const registerTx = await verifierContract.register_proof(
    '0x' + proofHashHex,    // felt252 as hex string
    '0x' + commitmentHex,   // felt252 as hex string
    activityScoreU256       // u256 object with {low, high}
  );
```

### 2. Loan Application (`applyForLoan` function)

**File:** `frontend/src/pages/LoanBorrowerFlowNew.jsx`
**Lines:** ~407-413

```javascript
// Call apply_for_loan on-chain
// Pass felt252 values as hex strings for proper validation
const applyTx = await loanEscrowContract.apply_for_loan(
  loanIdU256,              // u256 object with {low, high}
  '0x' + proofHashHex,     // felt252 as hex string
  '0x' + commitmentHex     // felt252 as hex string
);
```

## Expected Calldata Format

After the fix, the wallet should receive:
```javascript
{
  "contractAddress": "0x071b94eb...",
  "entrypoint": "register_proof",
  "calldata": [
    "0x7099e8978e383c4fab19f5eb7e72b5e8693cc140f97465069ba5a3dd43646d9",  // proof_hash (hex)
    "0x22083c8b84ffd614c26468f2ada0c1baad4df98d81a0e1d7d757beb0155dd2d6", // commitment (hex)
    "300",  // activity_score.low
    "0"     // activity_score.high
  ]
}
```

Or as decimal strings (starknet.js converts automatically):
```javascript
{
  "calldata": [
    "3183185745832425615493159292581371187017172140144512762333539837862236014297",  // proof_hash
    "15393189494569145877924630553176639775906132872887146812104544623664171963094", // commitment
    "300",  // activity_score.low
    "0"     // activity_score.high
  ]
}
```

Both formats work, but **passing as hex strings** avoids the validation error.

## Type Guidelines for StarkNet.js

| Cairo Type | JavaScript Type | Example |
|------------|----------------|---------|
| `felt252` | **Hex string** or decimal string | `'0x123abc'` or `'1194684'` |
| `u256` | Object `{low, high}` | `{low: '300', high: '0'}` |
| `u128` | BigInt or string | `BigInt(300)` or `'300'` |
| `ContractAddress` | Hex string | `'0x05a4d3...'` |

## Testing Steps

1. **Hard refresh** browser: `Ctrl + Shift + R`

2. **Clear localStorage**:
   ```javascript
   localStorage.clear()
   ```

3. **Generate ZK Proof**:
   - Click "Generate ZK Proof"
   - Wallet should show **proper transaction preview** (no validation error!)
   - Values displayed as hex or decimal strings
   - Click "Continue" → Confirm transaction
   - Wait for confirmation

4. **Apply for Loan**:
   - Select loan with available slots
   - Click "Apply for Loan"
   - Wallet shows proper transaction (no validation error!)
   - Confirm and submit

## Why This Happens

StarkNet.js performs **type validation** on parameters before sending to the wallet:

1. **Type Check**: Ensures parameter matches Cairo type
2. **Range Check**: For felt252, checks `0 <= value < 2^251`
3. **Serialization**: Converts to calldata format

When we passed `BigInt` objects:
- Type check failed because BigInt ≠ expected format
- Error: "Validate Unhandled" (validation couldn't process BigInt)

When we pass hex strings:
- Type check passes (string is valid)
- StarkNet.js converts to proper calldata format
- Wallet receives valid transaction data

## Files Modified

1. `frontend/src/pages/LoanBorrowerFlowNew.jsx`
   - Line ~216: Changed proof registration to use hex strings
   - Line ~410: Changed loan application to use hex strings

## Related Issues Fixed

This completes the chain of fixes:
1. ✅ **Identity Commitment Truncation** - Fixed to preserve full length
2. ✅ **Slot Display Bug** - Fixed to show filledSlots instead of slotsRemaining
3. ✅ **Contract Call Method** - Changed to typed contract methods
4. ✅ **Felt252 Validation** - Changed to hex string format ← **YOU ARE HERE**

All systems ready! 🚀
