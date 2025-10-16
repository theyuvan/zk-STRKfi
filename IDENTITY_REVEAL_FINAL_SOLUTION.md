# Identity Commitment Reveal - Final Solution

## Problem Summary
The contract's `reveal_borrower_identity` function requires the **activity_commitment** to look up the application, but we want to show the **identity_commitment** to the lender for reputation tracking.

## Root Cause
```cairo
// Contract code:
fn reveal_borrower_identity(
    ref self: ContractState,
    loan_id: u256,
    borrower_commitment: felt252,  // <-- This parameter
) {
    let app = self.applications.read((loan_id, borrower_commitment)); // <-- Used as key
    // ...
    self.emit(IdentityRevealed {
        commitment: borrower_commitment,  // <-- Emitted in event
        // ...
    });
}
```

The contract:
1. Uses `borrower_commitment` parameter to look up the application
2. Applications are stored with **activity_commitment** as the key
3. If we pass **identity_commitment**, the contract can't find the application → ERROR

## Solution Implemented

### Backend (JSON Storage)
Created a mapping system that links activity_commitment → identity_commitment:

**File**: `backend/src/data/identity_commitments.json`
```json
{
  "0xWALLET_ADDRESS": {
    "identity_commitment": "0x25184c...",  // From Step 2 (identity verification)
    "activity_commitment": "0x46086f9...",  // From Step 3 (loan proof)
  }
}
```

### Frontend Flow
1. **Get activity_commitment** from loan application (stored in contract)
2. **Call backend** to lookup identity_commitment:
   ```typescript
   GET /api/loan/identity-by-activity/${activity_commitment}
   → Returns: { identity_commitment, activity_commitment, wallet }
   ```
3. **Pass activity_commitment to contract** (so it can find the application):
   ```typescript
   reveal_borrower_identity(loan_id, activity_commitment)
   ```
4. **Show BOTH commitments to user**:
   - **Identity Commitment**: Permanent reputation ID
   - **Activity Commitment**: This loan's proof
   - **Wallet Address**: Borrower's wallet

## Key Insight

**We can't change what the contract stores/requires, but we can:**
1. Store the mapping off-chain (in backend JSON)
2. Pass the correct commitment to the contract (activity_commitment)
3. Show the desired commitment to the user (identity_commitment)

## User Experience

When lender clicks "Reveal Identity" on overdue loan:

```
🔓 Borrower Identity Revealed!

🔒 ZK Identity Commitment (Permanent): 0x25184c8956f56e5ef3...
   (Decimal: 16778507962528408673...)

📊 Activity Commitment (This Loan): 0x46086f90bafdac0a69...

📍 Wallet Address: 0xb8f699e32dd76264d2e9d52bab...
📋 Loan ID: 36
⏰ Overdue by: 2 minutes
📝 Transaction: 0x1234abcd...

💡 The Identity Commitment is the borrower's permanent identity for reputation tracking.
💡 The Activity Commitment is specific to this loan application.
```

## Files Modified

1. ✅ `backend/src/data/identity_commitments.json` - Storage file
2. ✅ `backend/src/services/identityCommitmentStore.js` - Storage service
3. ✅ `backend/src/routes/identityRoutes.js` - Store identity_commitment
4. ✅ `backend/src/controllers/proofController.js` - Store activity_commitment + preserve identity_commitment
5. ✅ `backend/src/routes/loanRoutes_onchain.js` - Added `/identity-by-activity/:activityCommitment` endpoint
6. ✅ `frontend/app/lenders/page.tsx` - Updated reveal flow:
   - Fetch identity_commitment from backend
   - Pass activity_commitment to contract
   - Show both commitments to user

## Testing

1. ✅ Backend endpoint works: `GET /api/loan/identity-by-activity/0x46086f9...`
2. ✅ Returns correct mapping
3. ⏳ Test reveal transaction (need to click "Reveal Identity" button)

## Status
✅ **Implementation Complete**  
⏳ **Pending User Test** - Click "Reveal Identity" on overdue loan

## Next Steps
1. Test the reveal function end-to-end
2. Verify the correct commitments are shown to the user
3. Consider contract upgrade in V2 to store both commitments on-chain
