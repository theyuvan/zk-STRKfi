# Testing Guide - Identity Commitment System

## Quick Test

### 1. First Time Setup
```bash
# Terminal 1: Start Backend
cd backend
npm start

# Terminal 2: Start Frontend
cd frontend
npm run dev
```

### 2. Test Flow

#### Step 1: First Application
1. Open browser → `http://localhost:5173` (or your frontend URL)
2. Connect wallet
3. Click "Generate ZK Proof"
   - Watch console: Should say "🆕 Creating new identity"
   - Note the commitment value
4. Apply for a loan
   - Check console: Should show commitment used
5. Check "My Applications" → Should show 1 application

#### Step 2: Update Credit Score & Reapply
1. Change activity score (simulate credit score update)
2. Click "Generate ZK Proof" again
   - Watch console: Should say "✅ Found identity commitment"
   - Should use SAME commitment as before
3. Apply for ANOTHER loan
4. Check "My Applications" → Should show 2 applications now!

### 3. Expected Console Logs

#### First Time
```javascript
🔍 Checking for existing commitment on blockchain...
📊 Found 0 ProofRegistered events
🆕 Creating new identity with deterministic salt
🎯 Using identity commitment: 0x1234...
📝 Current proof commitment: 0x1234...
✅ Proof registered successfully!
```

#### Second Time (Updated Score)
```javascript
🔍 Checking for existing commitment on blockchain...
📊 Found 5 ProofRegistered events
✅ Found identity commitment (first registration): 0x1234...
🔄 Reusing identity with deterministic salt
🎯 Using identity commitment: 0x1234...
📝 Current proof commitment: 0x5678... (different - new score!)
✅ Proof registered successfully!
```

### 4. Verify on Lender Side
1. Switch to lender page
2. Select your loan
3. Click "View Applications"
4. Should see ALL applications with same commitment
5. Should show LATEST activity score in each application

## Troubleshooting

### Applications Not Showing
**Check:**
1. Backend logs: Is it scanning 32 loans?
2. Frontend console: What commitment is being used?
3. Contract explorer: Check `LoanApplicationSubmitted` events

### Multiple Identities (Old Issue)
**Symptoms:**
- Each proof generates different commitment
- Applications disappear after generating new proof

**Fix:**
- Should be fixed now with identity commitment
- Clear browser cache and test again

## Expected Behavior

### ✅ Correct:
- One commitment per wallet (identity)
- Multiple proofs per commitment (credit score updates)
- All applications queryable by identity commitment

### ❌ Incorrect (Old Behavior):
- New commitment for each proof
- Applications "disappear" after new proof
