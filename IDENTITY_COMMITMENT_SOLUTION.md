# Identity Commitment Storage Solution - IMPLEMENTED

## Problem
The contract's `Application` struct only stores ONE commitment field (activity_commitment from loan proof), but when revealing identity for overdue loans, we need the **identity_commitment** (from identity verification step).

## Root Cause
1. **Identity Verification (Step 2)**: Generates `identity_commitment` 
2. **Loan Proof (Step 3)**: Generates `activity_commitment` and stores it on-chain
3. **Contract Storage**: Only stores `activity_commitment` in Application struct
4. **Identity Reveal**: Contract's `reveal_borrower_identity` function emits the `activity_commitment`, not `identity_commitment`

## Solution Implemented - Backend JSON Storage

Since modifying the contract would require redeployment, we implemented an **off-chain solution** that stores both commitments in a JSON file.

### Files Created

#### 1. `backend/src/data/identity_commitments.json`
```json
{
  "commitments": {},
  "metadata": {
    "created": "2025-01-01T00:00:00.000Z",
    "description": "Stores identity commitments mapped to wallet addresses"
  }
}
```

Data Structure:
```json
{
  "commitments": {
    "0x1234...": {
      "identity_commitment": "0xabc123...",
      "activity_commitment": "0xdef456...",
      "created_at": "2025-01-10T12:00:00.000Z",
      "updated_at": "2025-01-10T12:30:00.000Z"
    }
  }
}
```

#### 2. `backend/src/services/identityCommitmentStore.js`
Service class that manages the JSON storage:

**Key Methods:**
- `storeIdentityCommitment(walletAddress, identity_commitment)` - Store identity commitment when user verifies identity
- `storeActivityCommitment(walletAddress, activity_commitment)` - Store activity commitment when user generates loan proof
- `getCommitmentsByWallet(walletAddress)` - Get both commitments for a wallet
- `findWalletByActivityCommitment(activity_commitment)` - **Critical**: Find identity_commitment by activity_commitment (used during reveal)
- `getAllCommitments()` - Debug method
- `getStats()` - Get storage statistics

### Integration Points

#### 3. `backend/src/routes/identityRoutes.js` - UPDATED
Added storage when identity proof is generated:
```javascript
// After ZK proof generation
await identityCommitmentStore.storeIdentityCommitment(
  identityInputs.wallet_address,
  proofResult.identity_commitment
);
```

#### 4. `backend/src/controllers/proofController.js` - UPDATED
Added storage when loan proof is generated:
```javascript
// After ZK proof generation
await identityCommitmentStore.storeActivityCommitment(
  walletAddress,
  finalIdentityCommitment // This is the activity commitment
);
```

#### 5. `backend/src/routes/loanRoutes_onchain.js` - NEW ENDPOINT
Added new endpoint for identity lookup:
```
GET /api/loan/identity-by-activity/:activityCommitment
```

**Flow:**
1. Lender gets application with `activity_commitment` from contract
2. Frontend calls `/api/loan/identity-by-activity/:activityCommitment`
3. Backend looks up which wallet has this activity_commitment
4. Backend returns the `identity_commitment` for that wallet

**Response:**
```json
{
  "success": true,
  "walletAddress": "0x1234...",
  "identity_commitment": "0xabc123...",
  "activity_commitment": "0xdef456...",
  "created_at": "2025-01-10T12:00:00.000Z",
  "updated_at": "2025-01-10T12:30:00.000Z"
}
```

### Next Steps - Frontend Integration

#### 6. `frontend/app/lenders/page.tsx` - NEEDS UPDATE
Modify `revealBorrowerIdentity` function to:

1. **Before calling contract**: Fetch identity_commitment
```typescript
// NEW: Get identity commitment from backend
const identityResponse = await axios.get(
  `${BACKEND_URL}/api/loan/identity-by-activity/${borrowerCommitment}`
)

if (!identityResponse.data.success) {
  toast.error('Borrower has not completed identity verification', { id: 'reveal' })
  return
}

const identity_commitment = identityResponse.data.identity_commitment
console.log('✅ Found identity commitment:', identity_commitment.slice(0, 20) + '...')
```

2. **Call reveal with identity_commitment** (not activity_commitment)
```typescript
// Use identity_commitment instead of activity_commitment
const identityCommitmentNum = BigInt(identity_commitment)

const revealTx = await starknet.account.execute({
  contractAddress: LOAN_ESCROW_ADDRESS,
  entrypoint: 'reveal_borrower_identity',
  calldata: [
    loanIdU256.low.toString(),
    loanIdU256.high.toString(),
    identityCommitmentNum.toString() // <-- Use identity, not activity
  ]
})
```

3. **Display identity_commitment** in the UI
```typescript
toast.success(
  `Identity revealed successfully!\n\n` +
  `ZK Identity: ${identity_commitment.slice(0, 20)}...\n` +
  `Wallet: ${borrowerWallet}\n` +
  `Overdue by: ${overdueText}`,
  { id: 'reveal', duration: 10000 }
)
```

## How It Works

### Flow Diagram
```
Step 2: Identity Verification
├─> Frontend: User uploads passport
├─> Backend: Generate identity ZK proof
├─> Backend: identity_commitment = hash(passport, dob, address)
└─> Backend: Store identity_commitment in JSON file ✅

Step 3: Loan Proof
├─> Frontend: User generates activity proof
├─> Backend: activity_commitment = hash(walletActivity, salt)
└─> Backend: Store activity_commitment in JSON file ✅

Step 4: Apply for Loan
├─> Frontend: Submit application with activity_commitment
└─> Contract: Store activity_commitment in Application struct

Lender Reveal (Overdue Loan)
├─> Frontend: Get application with activity_commitment from contract
├─> Frontend: Call /api/loan/identity-by-activity/:activityCommitment
├─> Backend: Look up wallet by activity_commitment
├─> Backend: Return identity_commitment for that wallet ✅
├─> Frontend: Call reveal_borrower_identity(loan_id, identity_commitment)
└─> Contract: Emit IdentityRevealed event with identity_commitment ✅
```

## Testing Checklist

- [ ] Test identity verification (Step 2) - check JSON file is updated
- [ ] Test loan proof generation (Step 3) - check JSON file is updated
- [ ] Test identity lookup endpoint - verify correct identity_commitment returned
- [ ] Test reveal with identity_commitment - verify contract emits correct commitment
- [ ] Test error case: Reveal before identity verification completes
- [ ] Test error case: Activity commitment not found in JSON

## Benefits of This Solution

✅ **No Contract Changes**: Works with existing deployed contract  
✅ **Backward Compatible**: Doesn't break existing functionality  
✅ **Simple Implementation**: Uses JSON file storage (can upgrade to database later)  
✅ **Privacy Preserved**: Only stores commitments, not sensitive data  
✅ **Fast Lookup**: O(n) search (can optimize with index if needed)  

## Future Enhancements

1. **Database Storage**: Migrate from JSON file to MongoDB/PostgreSQL
2. **Indexing**: Add index on activity_commitment for faster lookups
3. **Encryption**: Encrypt the JSON file at rest
4. **Backup**: Implement automated backups
5. **Contract Upgrade**: In V2, modify contract to store both commitments on-chain

## Files Modified Summary

**Created:**
- `backend/src/data/identity_commitments.json` - Storage file
- `backend/src/services/identityCommitmentStore.js` - Storage service

**Modified:**
- `backend/src/routes/identityRoutes.js` - Added identity storage
- `backend/src/controllers/proofController.js` - Added activity storage
- `backend/src/routes/loanRoutes_onchain.js` - Added lookup endpoint

**Pending:**
- `frontend/app/lenders/page.tsx` - Update reveal function to use identity_commitment

## Status
✅ Backend implementation complete  
⏳ Frontend integration pending  
⏳ Testing pending
