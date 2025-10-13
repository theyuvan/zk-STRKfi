# Lender Applications Workaround

## Problem
The lender endpoint `/api/loan/:loanId/applications` can't easily list applications because:
1. Contract stores applications by `(loan_id, commitment)` pair
2. To list all applications for a loan, we need to know all commitments
3. Event querying on StarkNet is failing
4. No way to iterate through all commitments

## Current Status
✅ **Borrower endpoint works**: `/api/loan/borrower/:commitment/applications`
- Scans all 33 loans
- Checks if commitment has application for each loan
- Returns applications for that specific borrower

❌ **Lender endpoint broken**: `/api/loan/:loanId/applications`
- Can't discover which commitments applied
- Events not working
- Returns empty array

## Solutions

### Option 1: Scan All Registered Proofs (RECOMMENDED)
Query `ProofRegistered` events from ActivityVerifier to get all commitments, then check each against the loan:

```javascript
// 1. Get all commitments from ActivityVerifier
const proofEvents = await provider.getEvents({
  address: ACTIVITY_VERIFIER_ADDRESS,
  keys: [[hash.getSelectorFromName('ProofRegistered')]]
});

// 2. Extract unique commitments
const commitments = [...new Set(proofEvents.events.map(e => e.data[1]))];

// 3. Check each commitment against this loan
for (const commitment of commitments) {
  const app = await contract.get_application(loanId, commitment);
  if (app.borrower !== '0x0') {
    applications.push(app);
  }
}
```

### Option 2: Frontend Workaround (QUICK FIX)
Lender page can scan all loans like borrower does, then filter by loan_id:

```javascript
// In LoanLenderFlow.jsx
const loadApplications = async (loanId) => {
  // Get ALL applications by scanning
  const allApps = await scanAllApplications(); // Scan like borrower endpoint
  
  // Filter for this loan
  const loanApps = allApps.filter(app => app.loanId === loanId);
  setApplications(loanApps);
};
```

### Option 3: Contract Modification (BEST LONG-TERM)
Add array to track commitments per loan:

```cairo
struct LoanApplications {
    commitments: Array<felt252>, // All commitments that applied
}

storage {
    loan_applications: Map<u256, LoanApplications>
}

fn apply_for_loan(loan_id, commitment) {
    // Store application
    applications.write((loan_id, commitment), app);
    
    // Track commitment
    let mut apps = loan_applications.read(loan_id);
    apps.commitments.append(commitment);
    loan_applications.write(loan_id, apps);
}

fn get_loan_applications(loan_id) -> Array<Application> {
    let apps = loan_applications.read(loan_id);
    // Return all applications for this loan
}
```

## Immediate Action
Use **Option 1** - scan ProofRegistered events to get commitments, then check each.

This is what the borrower endpoint does (scans all loans), but reversed (scan all commitments).
