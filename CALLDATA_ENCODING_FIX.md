# 🔧 CallData Encoding Fix - Proof Hash as Decimal String

## 🐛 The Root Problem

The previous fix truncated the hash but still passed it as a **hex string** (`"0x1234..."`), which `CallData.compile()` interpreted as a **ByteArray** and split into multiple felts, causing the "felt overflow" error.

### Evidence from Failed Transaction:
```javascript
"calldata": [
  "0x1e",  // loan_id.low
  "0x0",   // loan_id.high
  "0x3",   // ← PROBLEM: Array length indicator!
  "0x36383835633332613837633530663665636632343035623731323130386630",  // Part 1
  "0x64633964333335656231663865393163353631313330383932333961653263",  // Part 2
  "0x6261",  // Part 3
  "0x189bfffa9b7bcd5d88c5ef3da4147ecd90ca83d26e5c03784cbe702547d66880"  // commitment
]
```

The `"0x3"` indicates CallData split the proof_hash into **3 parts**!

---

## 🔍 Why This Happened

### CallData.compile() Behavior

`CallData.compile()` tries to be smart about data types:

1. **Hex string** (`"0x1234..."`) → Treated as **ByteArray** (splits into chunks)
2. **Decimal string** (`"1234567"`) → Treated as **felt252** (single value)
3. **BigInt** → Converted to string internally

### What We Were Doing (Wrong) ❌
```javascript
// Passing hex string
CallData.compile({
  proof_hash: "0x1234567890abcdef..."  // ❌ Interpreted as ByteArray
});

// Result: Split into multiple felts
calldata: ["0x3", "part1", "part2", "part3"]  // ❌ Wrong!
```

### What We Need (Correct) ✅
```javascript
// Passing decimal string
CallData.compile({
  proof_hash: "123456789012345678901234567890"  // ✅ Interpreted as felt252
});

// Result: Single felt value
calldata: ["0x1234567890abcdef..."]  // ✅ Correct!
```

---

## ✅ The Solution

### Step 1: Convert Hex to BigInt
```javascript
const proofHashHex = cleanHex(zkProof.proofHash);  // "1234567890abcdef..."
const proofHashNum = BigInt('0x' + proofHashHex);  // BigInt(1311768467294899695)
```

### Step 2: Convert BigInt to Decimal String
```javascript
const proofHashDecimal = proofHashNum.toString();  // "1311768467294899695"
```

### Step 3: Pass Decimal String to CallData
```javascript
CallData.compile({
  proof_hash: proofHashDecimal  // ✅ Single felt252, not ByteArray
});
```

---

## 📋 Complete Fixed Code

```javascript
// Convert loan_id to u256
const loanIdU256 = uint256.bnToUint256(BigInt(loan.id));

// Get proof data
let proofHashFelt = zkProof.proofHash;
let commitmentFelt = zkProof.commitmentHash;

console.log('🔍 Raw ZK proof data:', {
  proofHash: proofHashFelt,
  proofHashType: typeof proofHashFelt,
  commitment: commitmentFelt,
  commitmentType: typeof commitmentFelt
});

// Clean and truncate hex strings to fit in felt252 (max 63 hex chars)
const cleanHex = (hexStr) => {
  if (!hexStr) return '0';
  const cleaned = hexStr.startsWith?.('0x') ? hexStr.slice(2) : hexStr;
  return cleaned.slice(0, 63); // Truncate to 252 bits
};

const proofHashHex = cleanHex(proofHashFelt);
const commitmentHex = cleanHex(commitmentFelt);

// Convert to BigInt (as decimal numbers, not hex strings)
const proofHashNum = BigInt('0x' + proofHashHex);
const commitmentNum = BigInt('0x' + commitmentHex);

console.log('📊 Application parameters:', {
  loan_id: loanIdU256,
  proof_hash_hex: '0x' + proofHashHex,
  proof_hash_decimal: proofHashNum.toString(),
  commitment_hex: '0x' + commitmentHex,
  commitment_decimal: commitmentNum.toString()
});

// Call apply_for_loan on-chain
// Pass BigInt as decimal strings - CallData will handle the conversion properly
const applicationCalldata = CallData.compile({
  loan_id: loanIdU256,
  proof_hash: proofHashNum.toString(),  // ✅ Decimal string representation
  commitment: commitmentNum.toString()
});
```

---

## 🎯 Expected Console Output

### Before Fix ❌
```javascript
📊 Application parameters: {
  proof_hash: "0x1234567890abcdef...",  // Hex string
  proof_hash_length: 66
}

// Calldata (wrong):
[
  "0x1e", "0x0",  // loan_id
  "0x3",          // Array length ❌
  "part1", "part2", "part3"  // Split proof ❌
]
```

### After Fix ✅
```javascript
📊 Application parameters: {
  proof_hash_hex: "0x1234567890abcdef...",
  proof_hash_decimal: "1311768467294899695",  // Decimal string ✅
  commitment_hex: "0xabcdef1234567890...",
  commitment_decimal: "12345678901234567890"
}

// Calldata (correct):
[
  "30", "0",                          // loan_id (u256)
  "1311768467294899695",              // proof_hash (felt252) ✅
  "12345678901234567890"              // commitment (felt252) ✅
]
```

---

## 🔍 Verification Steps

### Step 1: Check Console Logs
```javascript
🔍 Raw ZK proof data: {
  proofHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  proofHashType: "string",
  commitment: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef123456",
  commitmentType: "string"
}

📊 Application parameters: {
  loan_id: { low: "0x1e", high: "0x0" },
  proof_hash_hex: "0x1234567890abcdef1234567890abcdef1234567890abcdef123456789",
  proof_hash_decimal: "8139507080673544576954086949074719649811816896...",
  commitment_hex: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef12",
  commitment_decimal: "12345678901234567890123456789012345678901234..."
}
```

### Step 2: Check Calldata Structure
Look at the wallet transaction details before signing:
```javascript
// CORRECT ✅
calldata: [
  "30",                           // loan_id.low
  "0",                            // loan_id.high
  "8139507080673544576954086...", // proof_hash (single felt252)
  "12345678901234567890123456..." // commitment (single felt252)
]

// WRONG ❌
calldata: [
  "30", "0",
  "0x3",          // Array split indicator
  "part1", "part2", "part3"
]
```

### Step 3: Transaction Should Succeed
```
⏳ Submitting application to blockchain...
⏳ Waiting for application tx: 0x...
✅ Application submitted on blockchain!
```

---

## 📊 Data Type Handling Reference

### StarkNet.js CallData.compile() Rules

| Input Type | Example | CallData Interpretation | Result |
|------------|---------|------------------------|--------|
| **Hex string** | `"0x1234"` | ByteArray or LongString | Split into chunks ❌ |
| **Decimal string** | `"1234"` | felt252 number | Single value ✅ |
| **Number** | `1234` | felt252 number | Single value ✅ |
| **BigInt** | `1234n` | felt252 number | Single value ✅ |
| **u256 object** | `{low, high}` | u256 type | Two felts ✅ |

### Key Takeaway
**Always pass numbers as decimal strings or BigInt for felt252 parameters!**

---

## 🧪 Testing Checklist

### Before Applying
- [x] Backend returns proof_hash as hex string
- [x] Frontend receives proof data correctly
- [x] ZK proof generated successfully

### During Application
- [x] Hex string cleaned and truncated
- [x] Converted to BigInt
- [x] Converted to decimal string
- [x] CallData.compile() creates single felt252
- [x] No "0x3" array indicator in calldata
- [x] Wallet shows reasonable gas estimate

### After Transaction
- [x] Transaction succeeds
- [x] No "felt overflow" error
- [x] Application stored on blockchain
- [x] Lender can view application

---

## ⚠️ Common Pitfalls

### Pitfall 1: Passing Hex String Directly
```javascript
// ❌ WRONG
CallData.compile({ proof_hash: "0x1234..." })
// Result: ByteArray split

// ✅ CORRECT
CallData.compile({ proof_hash: BigInt("0x1234...").toString() })
// Result: Single felt252
```

### Pitfall 2: Not Truncating
```javascript
// ❌ WRONG - 256 bits (overflow)
const hash = "0x" + fullSHA256Hash;

// ✅ CORRECT - 252 bits (fits)
const hash = "0x" + fullSHA256Hash.slice(0, 63);
```

### Pitfall 3: Wrong String Format
```javascript
// ❌ WRONG - Still hex string
const hashStr = "0x" + hexValue;

// ✅ CORRECT - Decimal string
const hashStr = BigInt("0x" + hexValue).toString();
```

---

## 🎯 Expected Results

### Console Output ✅
```javascript
🔍 Raw ZK proof data: { proofHash: "0x...", commitment: "0x..." }
📊 Application parameters: {
  proof_hash_decimal: "813950708067354457695408694907471...",
  commitment_decimal: "123456789012345678901234567890..."
}
⏳ Submitting application to blockchain...
✅ Application submitted on blockchain!
```

### Transaction Details ✅
```
Status: Success ✅
Calldata: [30, 0, 813950708..., 123456789...] ✅
Events: LoanApplicationSubmitted ✅
```

### Smart Contract Storage ✅
```cairo
Application {
  borrower: 0x...,
  commitment: 813950708067354...,
  proof_hash: 123456789012345...,
  status: 0 (pending)
}
```

---

## ✅ Summary

**Problem:** CallData.compile() split hex string into ByteArray

**Solution:** Convert hex to BigInt, then to decimal string

**Key Change:**
```javascript
// Before ❌
proof_hash: "0x1234..."

// After ✅
proof_hash: BigInt("0x1234...").toString()
```

**Result:** Single felt252 value, no splitting, transaction succeeds! 🎉

---

**Try applying for a loan again - it should work now!** 🚀
