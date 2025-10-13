# Identity Commitment Fix - Persistent Identity with Updating Credit Score

## Problem
When generating a new ZK proof with updated credit score, a new commitment was created, resulting in:
- Multiple identities for the same user
- Previous loan applications not showing (queried with new commitment)
- Lenders couldn't see applications

## Root Cause
```
commitment = Poseidon(activity_score, wallet_address, salt)
```
When activity_score changes → commitment changes → new identity

## Solution
Use **first commitment** as permanent identity:

### 1. Identity Commitment (Permanent)
- Query blockchain for FIRST `ProofRegistered` event by your wallet
- This becomes your permanent identity commitment
- All applications use this commitment

### 2. Proof Hash (Updates)
- Generate new proof with updated activity_score
- New proof_hash for each credit score update
- But commitment stays the same (identity)

## Implementation

### Frontend Changes (`LoanBorrowerFlowNew.jsx`)
```javascript
// 1. Query blockchain for first registration
const events = await provider.getEvents({
  address: ACTIVITY_VERIFIER_ADDRESS,
  keys: [[hash.getSelectorFromName('ProofRegistered')]]
});

// 2. Find FIRST event from your wallet
for (const event of events.events) {
  if (event.data[3] === walletAddress) {
    identityCommitment = event.data[1]; // Your permanent identity!
    break;
  }
}

// 3. Generate NEW proof (updated score)
const response = await axios.post('/api/proof/generate', {
  salary: activityData.score, // NEW score
  threshold: 100,
  walletAddress
});

// 4. Use identity commitment for queries/applications
const zkProofData = {
  ...response.data,
  identityCommitment: identityCommitment, // Permanent
  currentCommitment: response.data.commitment, // Current proof
  commitmentHash: identityCommitment // Use for all queries
};
```

### Backend Changes (`proofController.js`)
```javascript
// Use deterministic salt based on wallet address
// Same wallet = same identity across sessions
const saltHash = crypto.createHash('sha256')
  .update(walletAddress + '_salt_v1')
  .digest('hex');
salt = saltHash;

// This ensures consistent identity derivation
```

## User Flow

### First Time User
1. ✅ Connect wallet
2. ✅ Generate proof → Creates NEW commitment
3. ✅ Register proof on ActivityVerifier → Emits `ProofRegistered` event
4. ✅ Apply for loans → Uses this commitment as identity
5. ✅ Applications stored with this commitment

### Returning User (Updated Credit Score)
1. ✅ Connect wallet
2. ✅ Query blockchain → Find FIRST commitment (identity)
3. ✅ Generate NEW proof → Creates new proof_hash (but old commitment is used)
4. ✅ Register NEW proof on ActivityVerifier → New event
5. ✅ Apply for loans → Uses OLD commitment (identity)
6. ✅ Query applications → Uses OLD commitment → Finds all applications!

## Benefits
✅ **Single Identity**: One commitment per wallet across all credit score updates
✅ **Persistent Applications**: All applications queryable with identity commitment
✅ **Updated Proofs**: Credit score updates generate new proofs
✅ **No localStorage**: Identity derived from blockchain state
✅ **Privacy**: Commitment doesn't reveal identity until explicitly revealed

## Testing Steps
1. Clear browser state
2. Generate proof (first time) - note the commitment
3. Apply for loan
4. Update credit score
5. Generate NEW proof - check it uses SAME commitment
6. Check applications show up correctly
7. Apply to another loan
8. Verify both applications visible

## Notes
- Commitment is indexed in `Application` struct
- Backend scans all loans for matching commitments
- Future: Add event indexing for better performance
- Consider adding `get_applications_by_borrower` contract method
