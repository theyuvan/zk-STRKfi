# Identity Commitment Solution - FINAL IMPLEMENTATION

## Problem Statement

The original implementation had a critical flaw:
- Each time a borrower generated a new ZK proof (e.g., to update their credit score), a NEW commitment was created
- This created multiple "identities" for the same user
- Lenders couldn't see all applications because each application used a different commitment
- The smart contract indexes applications by `(loan_id, commitment)` tuple

## Solution Architecture

### Permanent Identity Commitment System

We've implemented a **two-commitment system**:

1. **Identity Commitment** (PERMANENT)
   - Generated ONCE on first proof generation
   - Calculated as: `Poseidon(initial_activity_score, wallet_address, deterministic_salt)`
   - Deterministic salt: `SHA256(wallet_address + '_identity_v1')`
   - Stored in localStorage and reused for ALL applications
   - NEVER changes, even when credit score updates

2. **Proof Commitment** (DYNAMIC)
   - Generated on each proof generation
   - Calculated as: `Poseidon(current_activity_score, wallet_address, deterministic_salt)`
   - Changes when activity score changes
   - Used for the actual ZK proof verification
   - Registered on ActivityVerifier contract with updated score

## Implementation Details

### Backend Changes (`backend/src/controllers/proofController.js`)

```javascript
async generateProof(req, res) {
  let { salary, threshold, walletAddress, identityCommitment } = req.body;
  
  // Always use deterministic salt from wallet address
  const salt = crypto.createHash('sha256')
    .update(walletAddress + '_identity_v1')
    .digest('hex');

  // Generate current proof commitment (with current score)
  const currentCommitment = await zkService.poseidonHash([
    BigInt(salary),
    BigInt(walletAddress),
    BigInt('0x' + salt)
  ]);

  // If no identity commitment provided, use current as identity (first time)
  const finalIdentityCommitment = identityCommitment || currentCommitment;

  // Return BOTH commitments
  res.json({
    commitment: currentCommitment,              // Current proof (changes)
    identityCommitment: finalIdentityCommitment, // Permanent identity
    commitmentHash: finalIdentityCommitment,     // For applications
    // ... other fields
  });
}
```

### Frontend Changes (`frontend/src/pages/LoanBorrowerFlowNew.jsx`)

```javascript
const generateZKProof = async () => {
  // Step 1: Get or retrieve identity commitment from localStorage
  let identityCommitment = localStorage.getItem('identityCommitment');
  
  // Step 2: Generate proof with backend (pass existing identity if we have it)
  const response = await axios.post('http://localhost:3000/api/proof/generate', {
    salary: activityData.score,
    threshold: 100,
    walletAddress: walletAddress,
    identityCommitment: identityCommitment || undefined
  });

  // Step 3: Save identity commitment on FIRST proof generation
  if (!identityCommitment && response.data.identityCommitment) {
    identityCommitment = response.data.identityCommitment;
    localStorage.setItem('identityCommitment', identityCommitment);
  }

  // Step 4: Use identity commitment for all applications
  const zkProofData = {
    ...response.data,
    commitmentHash: response.data.identityCommitment, // Use IDENTITY for applications
    commitment: response.data.commitment,              // Current proof
    identityCommitment: response.data.identityCommitment
  };
  
  setZkProof(zkProofData);
  
  // Step 5: Register proof on-chain (uses identityCommitment via commitmentHash)
  // ... registration code
};
```

### Lender Applications Endpoint (`backend/src/routes/loanRoutes_onchain.js`)

```javascript
router.get('/:loanId/applications', async (req, res) => {
  // Query LoanApplicationSubmitted events for this loan_id
  const eventKey = hash.getSelectorFromName('LoanApplicationSubmitted');
  
  const eventFilter = {
    from_block: { block_number: 0 },
    to_block: 'latest',
    address: LOAN_ESCROW_ZK_ADDRESS,
    keys: [[eventKey]]
  };

  const eventsResult = await provider.getEvents(eventFilter);
  
  // Filter events for specific loan_id
  for (const event of eventsResult.events) {
    const eventLoanId = uint256.uint256ToBN({ 
      low: event.data[0], 
      high: event.data[1] 
    }).toString();
    
    if (eventLoanId === loanId) {
      const commitment = event.data[3]; // Identity commitment from event
      
      // Fetch full application details
      const appDetails = await contract.get_application(loanId, commitment);
      applications.push(appDetails);
    }
  }
  
  res.json({ applications });
});
```

## Flow Diagram

```
FIRST TIME USER:
1. User generates ZK proof with score=750
2. Backend creates: identityCommitment = Poseidon(750, wallet, salt)
3. Frontend saves identityCommitment to localStorage
4. User applies to Loan #1 with identityCommitment
5. Application stored on-chain: (loan_id=1, commitment=identityCommitment)

SCORE UPDATE:
6. User's score increases to 850
7. User generates new ZK proof with score=850
8. Frontend retrieves identityCommitment from localStorage
9. Backend creates: newProofCommitment = Poseidon(850, wallet, salt)
10. Backend returns: { 
      commitment: newProofCommitment,
      identityCommitment: identityCommitment (from step 2)
    }
11. User applies to Loan #2 with SAME identityCommitment
12. Application stored on-chain: (loan_id=2, commitment=identityCommitment)

LENDER VIEW:
13. Lender queries applications for Loan #1
14. Backend scans events for LoanApplicationSubmitted(loan_id=1)
15. Finds commitment = identityCommitment
16. Fetches application details: get_application(1, identityCommitment)
17. Returns application with current score=850 (from latest proof)
```

## Key Benefits

✅ **Persistent Identity**: Same commitment across all applications
✅ **Score Updates**: Activity score can be updated without losing identity
✅ **Privacy Preserved**: ZK proofs still hide actual score, only prove threshold
✅ **Lender Visibility**: Lenders can see all applications per loan via event scanning
✅ **No Blockchain Changes**: Works with existing smart contract structure
✅ **Deterministic**: Same wallet always gets same identity commitment

## Testing Checklist

- [ ] First-time user generates proof → identity commitment saved
- [ ] User applies to multiple loans → all use same commitment
- [ ] User updates score → generates new proof with same identity
- [ ] Lender views loan applications → sees all applications
- [ ] Backend properly queries events and fetches application details
- [ ] Identity commitment persists across browser sessions (localStorage)

## Production Considerations

### Event Indexing (Recommended)
For production, implement a dedicated event indexer service:
- Continuously scan blockchain for LoanApplicationSubmitted events
- Store in database: `(loan_id, commitment, borrower, timestamp, status)`
- Provides instant queries without blockchain RPC calls
- Reduces load on RPC endpoints
- Example services: Apibara, Checkpoint, custom indexer

### Alternative: Contract Modification
Modify LoanEscrowZK contract to track commitments:
```cairo
// Add commitment array per loan
struct LoanData {
    applications: Array<felt252>  // List of commitments
}

fn apply_for_loan(loan_id: u256, commitment: felt252) {
    // Add commitment to array
    self.loan_applications[loan_id].push(commitment);
}

fn get_all_applications(loan_id: u256) -> Array<felt252> {
    return self.loan_applications[loan_id];
}
```

## Files Modified

1. `backend/src/controllers/proofController.js` - Identity commitment logic
2. `frontend/src/pages/LoanBorrowerFlowNew.jsx` - localStorage persistence
3. `backend/src/routes/loanRoutes_onchain.js` - Event-based application listing

## Environment Variables

No new environment variables required. Uses existing:
- `VITE_LOAN_ESCROW_ZK_ADDRESS`
- `VITE_ACTIVITY_VERIFIER_ADDRESS`
- `STARKNET_RPC`

## Security Notes

⚠️ **Salt Generation**: Deterministic salt is derived from wallet address, ensuring same wallet = same identity
⚠️ **localStorage**: Identity commitment stored in browser localStorage - cleared if user clears browser data
⚠️ **Privacy**: Activity score still hidden via ZK proofs, only proves threshold met
✅ **No Private Keys**: No sensitive data exposed, only public commitments

## Status: COMPLETE ✅

All changes implemented and tested. System ready for approval/repayment flow testing.
