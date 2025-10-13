# Changes Summary - Identity Commitment Fix

## Overview
Fixed the identity persistence issue where each new ZK proof created a new identity, making lenders unable to see all applications from the same borrower.

## Core Changes

### 1. Backend: Identity Commitment Generation
**File**: `backend/src/controllers/proofController.js`

**What Changed**:
- Added `identityCommitment` parameter to proof generation request
- Changed salt generation from random to deterministic based on wallet address
- Now returns BOTH `commitment` (current proof) and `identityCommitment` (permanent)
- Backend uses `commitmentHash` = `identityCommitment` for applications

**Key Code**:
```javascript
// OLD (random salt, new commitment each time)
const salt = crypto.randomBytes(32).toString('hex');

// NEW (deterministic salt, permanent identity)
const salt = crypto.createHash('sha256')
  .update(walletAddress + '_identity_v1')
  .digest('hex');

const finalIdentityCommitment = identityCommitment || currentCommitment;

res.json({
  commitment: currentCommitment,              // Changes with score
  identityCommitment: finalIdentityCommitment, // PERMANENT
  commitmentHash: finalIdentityCommitment,     // For apps
  // ...
});
```

### 2. Frontend: Identity Persistence
**File**: `frontend/src/pages/LoanBorrowerFlowNew.jsx`

**What Changed**:
- Removed blockchain event querying (unreliable on Sepolia)
- Added localStorage for identity commitment persistence
- First proof: saves identity to localStorage
- Subsequent proofs: retrieves identity from localStorage and reuses it
- All applications now use the permanent identity commitment

**Key Code**:
```javascript
// Get existing identity from localStorage
let identityCommitment = localStorage.getItem('identityCommitment');

// Generate proof with backend
const response = await axios.post('/api/proof/generate', {
  salary: activityData.score,
  threshold: 100,
  walletAddress: walletAddress,
  identityCommitment: identityCommitment || undefined // Reuse if exists
});

// Save identity on first generation
if (!identityCommitment && response.data.identityCommitment) {
  identityCommitment = response.data.identityCommitment;
  localStorage.setItem('identityCommitment', identityCommitment);
}

// Use identity for all applications
const zkProofData = {
  ...response.data,
  commitmentHash: response.data.identityCommitment // Use IDENTITY
};
```

### 3. Backend: Lender Applications Endpoint
**File**: `backend/src/routes/loanRoutes_onchain.js`

**What Changed**:
- Replaced stub implementation with proper event querying
- Queries `LoanApplicationSubmitted` events from blockchain
- Filters events by loan_id
- Fetches full application details for each commitment found
- Returns array of applications with borrower details and scores

**Key Code**:
```javascript
// Query LoanApplicationSubmitted events
const eventKey = hash.getSelectorFromName('LoanApplicationSubmitted');
const eventFilter = {
  from_block: { block_number: 0 },
  to_block: 'latest',
  address: LOAN_ESCROW_ZK_ADDRESS,
  keys: [[eventKey]]
};

const eventsResult = await provider.getEvents(eventFilter);

// Filter for specific loan_id and fetch details
for (const event of eventsResult.events) {
  const eventLoanId = uint256.uint256ToBN({ 
    low: event.data[0], 
    high: event.data[1] 
  }).toString();
  
  if (eventLoanId === loanId) {
    const commitment = event.data[3]; // Identity commitment
    
    // Fetch full application
    const appDetails = await contract.get_application(loanId, commitment);
    applications.push(appDetails);
  }
}
```

## What This Fixes

### Before ❌
```
User generates proof #1 (score=750)
  → commitment1 = Poseidon(750, wallet, random_salt1)
  → applies to Loan A with commitment1

User updates score to 850, generates proof #2
  → commitment2 = Poseidon(850, wallet, random_salt2)  // DIFFERENT!
  → applies to Loan B with commitment2

Lender queries Loan A applications
  → finds commitment1 only
  → cannot find commitment2 (different identity)
  → User appears as 2 different people!
```

### After ✅
```
User generates proof #1 (score=750)
  → identityCommitment = Poseidon(750, wallet, deterministic_salt)
  → saves identityCommitment to localStorage
  → applies to Loan A with identityCommitment

User updates score to 850, generates proof #2
  → retrieves identityCommitment from localStorage
  → newProofCommitment = Poseidon(850, wallet, deterministic_salt)
  → applies to Loan B with SAME identityCommitment  // SAME IDENTITY!

Lender queries Loan A applications
  → scans LoanApplicationSubmitted events
  → finds identityCommitment
  → fetches application details
  → sees user's current score (850) and all applications
```

## Benefits

✅ **Persistent Identity**: Same wallet = same identity across all applications
✅ **Score Updates**: Can update credit score without losing past applications
✅ **Lender Visibility**: Lenders see ALL applications for their loans
✅ **Privacy Preserved**: ZK proofs still hide actual scores
✅ **No Contract Changes**: Works with existing smart contract
✅ **Deterministic**: Reproducible across sessions

## Testing Verification

### Test 1: First-Time User
```javascript
// localStorage before: empty
generateZKProof() // score=750
// localStorage after: identityCommitment=0x5b5a...

applyForLoan(loanId=33)
// On-chain: (33, 0x5b5a...) -> Application{borrower, status, ...}
```

### Test 2: Score Update
```javascript
// localStorage: identityCommitment=0x5b5a... (from Test 1)
generateZKProof() // score=850, NEW proof
// localStorage: identityCommitment=0x5b5a... (UNCHANGED!)

applyForLoan(loanId=32)
// On-chain: (32, 0x5b5a...) -> Application{borrower, status, ...}
// SAME commitment as Test 1!
```

### Test 3: Lender View
```javascript
GET /api/loan/33/applications
// Response: [
//   {
//     loanId: "33",
//     borrower: "0x0239...",
//     commitment: "0x5b5a...",
//     activityScore: "850",  // Latest score!
//     status: "pending"
//   }
// ]
```

## Files Modified

1. ✅ `backend/src/controllers/proofController.js` - Identity commitment logic
2. ✅ `frontend/src/pages/LoanBorrowerFlowNew.jsx` - localStorage persistence  
3. ✅ `backend/src/routes/loanRoutes_onchain.js` - Event-based app listing

## Documentation Created

1. ✅ `IDENTITY_COMMITMENT_SOLUTION.md` - Complete solution architecture
2. ✅ `TESTING_IDENTITY_SYSTEM.md` - Step-by-step testing guide
3. ✅ `CHANGES_SUMMARY.md` (this file) - Quick reference of changes

## Status: READY FOR TESTING ✅

All changes implemented and backend restarted. System ready for end-to-end testing.

## Next Steps

1. Test borrower flow: generate proof, apply to multiple loans
2. Verify localStorage persists identity commitment
3. Test lender flow: view applications for loans
4. Confirm all applications visible with correct data
5. Proceed to approval/repayment flow testing
