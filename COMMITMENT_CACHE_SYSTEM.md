# 🔐 Commitment Cache System - Application Discovery Solution

## Problem Statement

**Original Issue:**
Lenders couldn't see WHO applied to their loans because:
1. The Cairo contract stores applications as `applications: Map<(loan_id, commitment), Application>`
2. The `get_application()` function requires KNOWING the commitment beforehand
3. Events (`LoanApplicationSubmitted`) weren't being reliably emitted when using `account.execute()`
4. There's no `get_all_loan_applications(loan_id)` function in the contract

**User Impact:**
- Lenders create loans but can't see applications
- Borrowers apply but lenders can't find them
- The permanent identity commitment (borrower's "salted address") was invisible

---

## Solution: Commitment Cache Service

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    COMMITMENT FLOW                           │
└─────────────────────────────────────────────────────────────┘

1️⃣ BORROWER GENERATES PROOF
   ↓
   POST /api/proof/generate
   ↓
   [proofController.js] Caches commitment
   ↓
   commitmentCache.addCommitment(identityCommitment)


2️⃣ BORROWER APPLIES FOR LOAN
   ↓
   contract.apply_for_loan(loan_id, proof_hash, commitment)
   ↓
   [On-chain storage] applications[(loan_id, commitment)] = {...}


3️⃣ BORROWER CHECKS "MY APPLICATIONS"
   ↓
   GET /api/loan/borrower/:commitment/applications
   ↓
   [loanRoutes_onchain.js] Finds applications
   ↓
   commitmentCache.addCommitment(commitment, loan_id)


4️⃣ LENDER VIEWS APPLICATIONS (NEW!)
   ↓
   GET /api/loan/:loanId/applications/scan
   ↓
   [NEW ENDPOINT] Uses cache to discover applications
   ↓
   Tests each known commitment against the loan
   ↓
   Returns list with VISIBLE permanent identities
```

---

## Implementation Details

### 1. Commitment Cache Service

**File:** `backend/src/services/commitmentCacheService.js`

**Purpose:** Maintain an in-memory database of known borrower commitments

**Features:**
```javascript
class CommitmentCacheService {
  // Global commitment registry
  knownCommitments: Set<string>
  
  // Loan-specific mappings
  loanApplications: Map<loanId, Set<commitment>>
  
  // Methods
  addCommitment(commitment, loanId?)
  getAllCommitments() → Array<string>
  getCommitmentsForLoan(loanId) → Array<string>
  getStats() → { totalCommitments, loansWithApplications }
}
```

**Cache Population:**
- ✅ When borrower generates proof (`POST /api/proof/generate`)
- ✅ When borrower checks applications (`GET /api/loan/borrower/:commitment/applications`)
- ✅ When lender scans applications (`GET /api/loan/:loanId/applications/scan`)

---

### 2. New Lender Endpoint

**Endpoint:** `GET /api/loan/:loanId/applications/scan`

**Purpose:** Allow lenders to see WHO applied to their loans

**Flow:**
1. Fetch loan details from contract
2. Get all known commitments from cache
3. Test each commitment: `get_application(loan_id, commitment)`
4. Return applications with visible permanent identities

**Response Format:**
```json
{
  "success": true,
  "loanId": "38",
  "loanDetails": {
    "lender": "0x5b3cf7...",
    "amount": "1000000000000000000",
    "totalSlots": 2,
    "filledSlots": 0,
    "interestRate": "500",
    "minActivityScore": "100"
  },
  "applications": [
    {
      "loanId": "38",
      "borrowerAddress": "0x2398452a...",
      "permanentIdentity": "0x22083c8b84ffd614c2...", // ⭐ VISIBLE!
      "proofHash": "0x0d65e595...",
      "activityScore": "300",
      "status": "pending",
      "appliedAt": "2025-10-13T15:49:29.587Z"
    }
  ],
  "cacheInfo": {
    "totalKnownCommitments": 5,
    "applicationsFound": 1,
    "message": "Commitments are cached when borrowers generate ZK proofs"
  }
}
```

---

### 3. Cache Statistics Endpoint

**Endpoint:** `GET /api/loan/cache/stats`

**Purpose:** Monitor cache health and debugging

**Response:**
```json
{
  "success": true,
  "cache": {
    "totalCommitments": 5,
    "loansWithApplications": 3,
    "commitmentsList": [
      "0x22083c8b84ffd614...",
      "0x5a4b2c1d87ef3920...",
      ...
    ]
  }
}
```

---

## File Changes

### ✅ Created New Files

1. **`backend/src/services/commitmentCacheService.js`**
   - Commitment cache singleton
   - In-memory storage (use Redis in production)
   - Methods for adding/retrieving commitments

### ✅ Modified Existing Files

1. **`backend/src/controllers/proofController.js`**
   ```javascript
   // Line 4: Import cache
   const commitmentCache = require('../services/commitmentCacheService');
   
   // Line 145: Cache commitment after proof generation
   commitmentCache.addCommitment(finalIdentityCommitment);
   logger.info('💾 [CACHE] Commitment cached for future application discovery');
   ```

2. **`backend/src/routes/loanRoutes_onchain.js`**
   ```javascript
   // Line 820+: New endpoint GET /:loanId/applications/scan
   // Uses cache to discover applications by testing known commitments
   
   // Line 980+: New endpoint GET /cache/stats
   // Returns cache statistics
   
   // Line 595: Cache population in borrower endpoint
   const commitmentCache = require('../services/commitmentCacheService');
   commitmentCache.addCommitment(commitmentVariant, i);
   ```

---

## Usage Guide

### For Borrowers (No Change!)

1. Generate proof: `POST /api/proof/generate`
   - ✅ Commitment automatically cached
2. Apply for loan: `contract.apply_for_loan(...)`
   - ✅ Application stored on-chain
3. Check applications: `GET /api/loan/borrower/:commitment/applications`
   - ✅ Works as before, now also populates cache

### For Lenders (NEW!)

1. Create loan (existing flow)
2. **View applications:** `GET /api/loan/:loanId/applications/scan`
   - ✅ See borrower permanent identities
   - ✅ See activity scores
   - ✅ See application status

---

## Frontend Integration

### Lender View Applications Button

**Current (Broken):**
```javascript
// Old endpoint - relies on events
GET /api/loan/38/applications
// Returns: { applications: [] } ❌
```

**New (Working):**
```javascript
// New scan endpoint - uses cache
GET /api/loan/38/applications/scan
// Returns: { applications: [...] } ✅
```

**Update Needed:**
```javascript
// In LoanLenderFlow.jsx or wherever "View Applications" is called
const viewApplications = async (loanId) => {
  try {
    // CHANGE THIS LINE:
    // const response = await axios.get(`/api/loan/${loanId}/applications`);
    
    // TO THIS:
    const response = await axios.get(`/api/loan/${loanId}/applications/scan`);
    
    if (response.data.success) {
      const apps = response.data.applications;
      
      // Display applications with VISIBLE identities:
      apps.forEach(app => {
        console.log('Borrower Identity:', app.permanentIdentity); // ⭐ NOW VISIBLE!
        console.log('Activity Score:', app.activityScore);
        console.log('Status:', app.status);
      });
    }
  } catch (error) {
    console.error('Failed to fetch applications:', error);
  }
};
```

---

## Advantages

✅ **No Contract Changes Required**
   - Works with existing contract
   - No redeployment needed

✅ **Backwards Compatible**
   - Existing applications still work
   - Handles both full (66 char) and truncated (65 char) commitments

✅ **Automatic Cache Population**
   - Filled by borrower activity
   - No manual intervention needed

✅ **Privacy Preserved**
   - Commitments are hashes (salted addresses)
   - Real identities remain private

✅ **Scalable**
   - In-memory cache for development
   - Easy to migrate to Redis/database for production

---

## Limitations & Future Improvements

### Current Limitations

1. **Cache is Volatile**
   - In-memory storage (lost on server restart)
   - **Solution:** Use Redis or database for persistence

2. **Requires Borrower Activity First**
   - Commitments added when proofs are generated
   - **Solution:** Pre-populate cache by scanning all loans on startup

3. **No Real-time Updates**
   - Cache doesn't auto-update from blockchain events
   - **Solution:** Add event listener for `LoanApplicationSubmitted`

### Recommended Upgrades

#### 1. Persistent Cache (Redis)

```javascript
// Use Redis instead of in-memory
const redis = require('redis');
const client = redis.createClient();

class CommitmentCacheService {
  async addCommitment(commitment) {
    await client.sAdd('commitments:all', commitment);
    await client.sAdd(`commitments:loan:${loanId}`, commitment);
  }
  
  async getAllCommitments() {
    return await client.sMembers('commitments:all');
  }
}
```

#### 2. Contract Upgrade (Ideal Solution)

Add to `loan_escrow_zk.cairo`:
```rust
// NEW FUNCTION
fn get_all_loan_applications(
    self: @TContractState, 
    loan_id: u256
) -> Array<Application> {
    // Return all applications for a loan
    // No commitment parameter needed!
}
```

#### 3. Event-Based Cache Population

```javascript
// Listen for LoanApplicationSubmitted events
const eventWatcher = require('./workers/eventWatcher');

eventWatcher.on('LoanApplicationSubmitted', (event) => {
  const { loan_id, commitment } = event.data;
  commitmentCache.addCommitment(commitment, loan_id);
  logger.info(`📬 Event captured: commitment ${commitment.slice(0, 20)}... for loan #${loan_id}`);
});
```

---

## Testing

### Test Cache Population

```bash
# 1. Check cache is empty
curl http://localhost:3000/api/loan/cache/stats

# 2. Generate proof as borrower
curl -X POST http://localhost:3000/api/proof/generate \
  -H "Content-Type: application/json" \
  -d '{"salary": 300, "threshold": 100, "walletAddress": "0x123..."}'

# 3. Check cache now has commitment
curl http://localhost:3000/api/loan/cache/stats
# Should show: {"totalCommitments": 1}

# 4. Apply for loan (using frontend or direct contract call)

# 5. Lender scans applications
curl http://localhost:3000/api/loan/38/applications/scan
# Should return applications with permanent identities!
```

### Verify Identity Visibility

```javascript
// Frontend console after calling /scan endpoint:
response.data.applications.forEach(app => {
  console.assert(app.permanentIdentity, 'Identity should be visible!');
  console.assert(app.permanentIdentity.startsWith('0x'), 'Should be hex string');
  console.assert(app.permanentIdentity.length >= 64, 'Should be full commitment');
});
```

---

## Summary

### What Was Built

✅ **Commitment Cache Service** - In-memory registry of known borrower identities  
✅ **New Scan Endpoint** - Lenders can discover applications using cache  
✅ **Automatic Cache Population** - Filled when borrowers generate proofs/check applications  
✅ **Stats Endpoint** - Monitor cache health  
✅ **Backwards Compatibility** - Works with existing contracts and applications

### What This Solves

✅ Lenders can now see WHO applied to their loans  
✅ Permanent identity commitments (salted addresses) are VISIBLE  
✅ No contract changes or redeployment required  
✅ Privacy preserved (commitments are hashes, not real identities)  
✅ Scalable solution that works with existing infrastructure

### Next Steps for Frontend

1. Change lender's "View Applications" to call `/api/loan/:loanId/applications/scan`
2. Display `app.permanentIdentity` in the UI
3. Show `app.activityScore` and `app.status`
4. Test with existing loans and applications

---

## Support & Troubleshooting

### Issue: Cache is Empty

**Cause:** No borrowers have generated proofs yet  
**Solution:** 
- Borrowers must generate at least one proof
- Or manually populate cache by calling borrower endpoints

### Issue: Applications Not Found

**Possible Causes:**
1. Borrower used different commitment variant (truncated vs full)
2. Application was made before cache system was deployed
3. Cache was cleared/server restarted

**Solution:**
- Check both commitment variants (63 and 64 hex chars)
- Rebuild cache by calling `GET /api/loan/borrower/:commitment/applications` for known commitments
- Use persistent Redis cache in production

---

**Last Updated:** October 13, 2025  
**Version:** 1.0.0  
**Status:** ✅ Implemented and Ready for Testing
