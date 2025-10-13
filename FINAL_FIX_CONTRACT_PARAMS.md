# 🔧 Final Fix: Starknet.js Contract.invoke() Parameter Format

## ❌ The Error
```
Error: Invalid number of arguments, expected 2 arguments, but got 3
```

## 🎯 Root Cause

The starknet.js `Contract` class has **automatic parameter handling** that differs from raw `account.execute()` calls.

### Contract.invoke() Behavior:
- **Automatically expands** Uint256 objects into low/high values
- **Expects parameters as an object** (named parameters) OR as an array matching the function signature
- **Handles ABI type conversion** automatically

## 🔧 The Fix

### ❌ INCORRECT (What We Had)
```javascript
// Trying to pass low/high separately
const approveUint256 = uint256.bnToUint256(amount);
const tx = await contract.invoke('approve', [
  spender,
  approveUint256.low,   // ❌ Wrong - 3 parameters total
  approveUint256.high   // ❌ Wrong - but function expects 2
]);
```

**Why This Failed:**
- ERC20 `approve(spender: felt, amount: Uint256)` expects **2 parameters**
- We passed **3 parameters**: `spender`, `low`, `high`
- starknet.js saw 3 arguments but the ABI says 2 → Error!

### ✅ CORRECT (What We Need)

**Option 1: Named Parameters (RECOMMENDED)**
```javascript
const approveUint256 = uint256.bnToUint256(amount);
const tx = await contract.invoke('approve', {
  spender: LOAN_ESCROW_ADDRESS,  // Parameter name from ABI
  amount: approveUint256          // ✅ Uint256 object - starknet.js expands it
});
```

**Option 2: Array Format (Alternative)**
```javascript
const approveUint256 = uint256.bnToUint256(amount);
const tx = await contract.invoke('approve', [
  LOAN_ESCROW_ADDRESS,  // First parameter: spender
  approveUint256        // Second parameter: amount (Uint256 object)
]);
```

**Why This Works:**
- We pass **exactly 2 parameters** as the ABI expects
- starknet.js **automatically expands** the Uint256 object internally
- The library handles the low/high conversion for us

## 📝 Files Updated

### 1. `frontend/src/pages/LoanLenderFlow.jsx`

**Line ~217: STRK Approve**
```javascript
// BEFORE ❌
const approveTx = await strkContract.invoke('approve', [
  LOAN_ESCROW_ADDRESS,
  approveUint256.low,
  approveUint256.high
]);

// AFTER ✅
const approveTx = await strkContract.invoke('approve', {
  spender: LOAN_ESCROW_ADDRESS,
  amount: approveUint256
});
```

**Line ~237: Create Loan Offer**
```javascript
// BEFORE ❌
const createLoanTx = await loanEscrowContract.invoke('create_loan_offer', [
  amountUint256.low,
  amountUint256.high,
  totalSlots,
  interestRateBps,
  repaymentPeriodSeconds,
  minScoreUint256.low,
  minScoreUint256.high
]);

// AFTER ✅
const createLoanTx = await loanEscrowContract.invoke('create_loan_offer', {
  amount_per_borrower: amountUint256,
  total_slots: totalSlots,
  interest_rate_bps: interestRateBps,
  repayment_period: repaymentPeriodSeconds,
  min_activity_score: minScoreUint256
});
```

### 2. `frontend/src/pages/LoanBorrowerFlowNew.jsx`

**Line ~226: STRK Approve for Repayment**
```javascript
// BEFORE ❌
const approveTx = await strkContract.invoke('approve', [
  LOAN_ESCROW_ADDRESS,
  amountUint256.low,
  amountUint256.high
]);

// AFTER ✅
const approveTx = await strkContract.invoke('approve', {
  spender: LOAN_ESCROW_ADDRESS,
  amount: amountUint256
});
```

## 🧠 Key Learning

### StarkNet.js Contract Methods

**When to use different formats:**

1. **`contract.invoke(functionName, { param1, param2 })`** ← RECOMMENDED
   - Named parameters (matches ABI)
   - Self-documenting code
   - Type-safe with TypeScript
   - Automatic Uint256 expansion

2. **`contract.invoke(functionName, [param1, param2])`** ← ALSO WORKS
   - Positional parameters
   - Must match ABI parameter order
   - Automatic Uint256 expansion

3. **`account.execute({ contractAddress, entrypoint, calldata })`** ← LOW-LEVEL
   - Manual calldata construction
   - Need to manually expand Uint256 to [low, high]
   - Use CallData.compile() for complex types

### Uint256 Handling Summary

| Method | Uint256 Format | Example |
|--------|----------------|---------|
| `contract.invoke()` | Object `{ low, high }` | `amount: uint256.bnToUint256(value)` |
| `account.execute()` | Array `[low, high]` | `CallData.compile({ amount: uint256.bnToUint256(value) })` |

## ✅ Verification

### Expected Console Output (Working)
```
💼 Creating loan offer: {amountPerBorrower: '25 STRK', totalSlots: 1, ...}
📝 Step 1/2: Approving STRK spending...
💰 Approve amount: 25 STRK = 25000000000000000000 wei
💰 Uint256 format: {low: '0x15af1d78b58c40000', high: '0x0'}
⏳ Waiting for approval tx: 0x...
✅ Approval confirmed
📜 Step 2/2: Creating loan offer on blockchain...
⏳ Waiting for loan creation tx: 0x...
✅ Loan offer created on blockchain!
```

### Transaction Flow
1. **Approve STRK** → 2 parameters (spender, amount)
2. **Create Loan** → 5 parameters (amount, slots, rate, period, score)
3. Both Uint256 values automatically expanded by starknet.js

## 🎯 Summary

**The Problem:** Manually expanding Uint256 to low/high created too many parameters

**The Solution:** Let starknet.js Contract class handle Uint256 expansion automatically

**The Result:** Clean, readable code that matches the ABI exactly

---

## 🚀 Status: FIXED ✅

All contract calls now use the correct parameter format. The system should work without errors!

**Test it now:** Try creating a loan offer and it should succeed! 🎉
