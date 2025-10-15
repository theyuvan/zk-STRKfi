# 🔧 Active Loans Not Showing - Troubleshooting Guide

## 🚨 Problem
Lender approved loan application (Transaction: `0x7b8f9cd4ffa0e7e3891118fea216633fac669c846ec7710d3595054c968e7d8`), but the active loan is NOT showing in the borrower's frontend.

**Lender's approved commitment:** `0x4961c7426ec28ea71c07307d9ea0bb66273c13f3cb901cfbc13c653e5dce726`

## ✅ Fixes Applied

### 1. **Enhanced `fetchMyActiveLoans()` Function**
Now tries multiple commitment formats to find your loans:
- `loanZkProof.commitment` (primary)
- `loanZkProof.commitmentHash` (alternate)
- LocalStorage values (`zkCommitment_`, `zkProofHash_`)

### 2. **Always Visible Active Loans Section**
Changed from conditional rendering to always showing:
```tsx
// BEFORE: Only shows when loans exist
{myActiveLoans.length > 0 && <ActiveLoansSection />}

// AFTER: Always shows with helpful message
<ActiveLoansSection>
  {myActiveLoans.length > 0 ? <LoanCards /> : <EmptyState />}
</ActiveLoansSection>
```

### 3. **Auto-Refresh Every 30 Seconds**
Automatically checks for new active loans when you're on the dashboard:
```typescript
useEffect(() => {
  if (currentStep === 'dashboard' && loanZkProof?.commitment) {
    fetchMyActiveLoans() // Initial fetch
    
    const interval = setInterval(() => {
      fetchMyActiveLoans() // Auto-refresh every 30s
    }, 30000)

    return () => clearInterval(interval)
  }
}, [currentStep, loanZkProof?.commitment])
```

### 4. **Enhanced Logging**
Added detailed console logs to diagnose commitment mismatches:
```
💼 Fetching my active loans...
🔑 Using commitment: 0x...
🔑 Commitment hash: 0x...
🔍 Full ZK proof object: {...}
🔍 Trying commitment variants: [...]
🔎 Trying commitment: 0x4961c7426ec28ea71...
✅ Found 1 loan(s) with commitment: 0x4961c7426ec28ea71...
```

### 5. **"Check for Updates" Button**
Replaced "Refresh" with clearer "Check for Updates" button:
- Always visible even when no loans
- Shows loading spinner when checking
- Provides immediate feedback

## 🔍 How to Debug

### Step 1: Open Browser Console (F12)
Look for these log messages after clicking "Check for Updates":

**Expected Output When Working:**
```
💼 Fetching my active loans...
🔑 Using commitment: 0x4961c7426ec28ea71c07307d9ea0bb66273c13f3cb901cfbc13c653e5dce726
🔍 Trying commitment variants: ["0x...", "0x...", ...]
🔎 Trying commitment: 0x4961c7426ec28ea71...
✅ Found 1 loan(s) with commitment: 0x4961c7426ec28ea71...
✅ Total active loans found: 1
📦 Active loan details: [{loanId: "28", ...}]
```

**Warning Output When Not Working:**
```
⚠️ No active loans found. Check if lender approved with correct commitment.
💡 Expected commitment (from approval): 0x4961c7426ec28ea71c07307d9ea0bb66273c13f3cb901cfbc13c653e5dce726
💡 Your commitment: 0x15d4f064d026756afaae509c03e9a96a6e226ecb...
```

### Step 2: Verify Commitment Match

**Check what the borrower used when applying:**
1. Go to Step 3 (Loan Proof) in borrower portal
2. Look at the proof details card
3. Compare the "Commitment" value with lender's approval

**Expected Match:**
- Lender approved: `0x4961c7426ec28ea71c07307d9ea0bb66273c13f3cb901cfbc13c653e5dce726`
- Borrower's commitment: `0x4961c7426ec28ea71c07307d9ea0bb66273c13f3cb901cfbc13c653e5dce726`
- ✅ They should be IDENTICAL

**If they don't match:**
- ❌ Problem: Borrower applied with one commitment, lender approved another
- 🔧 Solution: Regenerate ZK proof OR fix commitment mapping

### Step 3: Check Backend Response

In console, look for the backend API response:
```javascript
// Should see this network request
GET http://localhost:3000/api/loan/borrower/0x4961c7426ec28ea71.../active

// Response should contain:
{
  "loans": [
    {
      "loanId": "28",
      "lender": "0x5b3cf7557800cce...",
      "amount": "10000000000000000000",
      "interestRate": "50",
      "status": "approved",
      "approvedAt": "2025-10-15T...",
      "repaymentDeadline": "2025-10-22T..."
    }
  ],
  "count": 1
}
```

### Step 4: Manual Refresh Test

1. **Go to Dashboard tab**
2. **Click "Check for Updates" button**
3. **Wait 5 seconds**
4. **Check console for logs**
5. **Active loan should appear in green card**

### Step 5: Check Backend Logs

If frontend shows no errors, check backend terminal:

**Expected Backend Logs:**
```
💼 Fetching active loans for borrower commitment: 0x4961c7426ec28ea71...
✅ Total loans on-chain: 28
📥 Received commitment (first 30 chars): 0x4961c7426ec28ea71c07307d9ea...
📦 Found 157 total application events
✅ Found matching application! Loan #28, Commitment: 0x4961c7426ec28ea71...
📋 Found 1 loans with applications from this borrower
📋 Loan #28 application found: { status: 1 (approved) }
✅ Found 1 active loans
```

## 🐛 Common Issues & Solutions

### Issue 1: "No active loans found" despite lender approval

**Cause:** Commitment mismatch between application and approval

**Solution:**
1. Check console for: `💡 Expected commitment vs Your commitment`
2. If different, the issue is commitment mismatch
3. Options:
   - **Option A**: Lender re-approves with correct commitment
   - **Option B**: Fix backend to handle both commitment formats
   - **Option C**: Borrower regenerates proof with matching commitment

### Issue 2: Active loans section not showing at all

**Cause:** Old code still cached or `currentStep !== 'dashboard'`

**Solution:**
1. **Hard refresh:** Ctrl + Shift + R (Windows) or Cmd + Shift + R (Mac)
2. **Clear cache and reload**
3. **Verify you're on "Dashboard" tab**

### Issue 3: "Check for Updates" button does nothing

**Cause:** Missing ZK proof commitment

**Solution:**
1. Check console for: `⚠️ No ZK proof commitment available`
2. Go back to Step 3 and regenerate ZK proof
3. Return to Dashboard

### Issue 4: Backend returns 404 or 500 error

**Cause:** Backend endpoint issue or contract read failure

**Solution:**
1. **Check backend is running:** `http://localhost:3000`
2. **Check backend logs** for errors
3. **Verify contract address** in backend config
4. **Test endpoint directly:**
   ```bash
   curl http://localhost:3000/api/loan/borrower/0x4961c7426ec28ea71.../active
   ```

### Issue 5: Loan shows in backend but not frontend

**Cause:** Frontend state not updating or parsing issue

**Solution:**
1. Check `setMyActiveLoans(uniqueLoans)` is called
2. Verify `myActiveLoans` state updates in React DevTools
3. Check for JavaScript errors in console

## 🎯 Quick Fix Checklist

- [ ] **Frontend refreshed** (Ctrl + F5)
- [ ] **Backend running** on port 3000
- [ ] **Wallet connected** in borrower portal
- [ ] **On Dashboard tab** (Tab 4)
- [ ] **Clicked "Check for Updates"** button
- [ ] **Console open** (F12) to see logs
- [ ] **Commitment matches** between application and approval
- [ ] **Auto-refresh active** (wait 30 seconds)
- [ ] **Backend logs checked** for errors
- [ ] **Transaction confirmed** on Voyager

## 📊 Expected User Flow

1. **Borrower applies for loan** with commitment `0x4961c7426ec28ea71...`
2. **Lender sees application** with same commitment
3. **Lender approves** → Transaction succeeds
4. **Borrower waits 30 seconds** (auto-refresh) OR clicks "Check for Updates"
5. **Active loan appears** in green card at top of dashboard
6. **Borrower can repay** (feature coming soon)

## 🔬 Advanced Debugging

### Test Backend Endpoint Directly

```bash
# Test with the exact commitment from lender approval
curl -X GET "http://localhost:3000/api/loan/borrower/0x4961c7426ec28ea71c07307d9ea0bb66273c13f3cb901cfbc13c653e5dce726/active" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "loans": [
    {
      "loanId": "28",
      "lender": "0x5b3cf7557800cce10fbad48e6cc95f2ffd82702996ea324bbb2470b6a6ba7ef",
      "amount": "10000000000000000000",
      "interestRate": "50",
      "borrower": "0x161409362764b2646e015081ccac96501533d3ad4f81e288d416d1a48cda4b7",
      "commitment": "0x4961c7426ec28ea71c07307d9ea0bb66273c13f3cb901cfbc13c653e5dce726",
      "status": "approved",
      "approvedAt": "2025-10-15T12:30:00.000Z",
      "repaymentDeadline": "2025-10-22T12:30:00.000Z"
    }
  ],
  "count": 1
}
```

### Check Smart Contract State

```javascript
// In browser console or backend
const { RpcProvider, Contract } = require('starknet');
const provider = new RpcProvider({ nodeUrl: 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7' });

// Check loan details
const loanId = 28;
const result = await provider.callContract({
  contractAddress: '0x06b058a0946bb36fa846e6a954da885fa20809f43a9e47038dc83b4041f7f012',
  entrypoint: 'get_loan_details',
  calldata: [loanId, 0] // loan_id as u256
});

console.log('Loan on-chain:', result);
```

## 🎉 Success Indicators

When everything is working, you should see:

1. **Green "My Active Loans" section** at top of dashboard
2. **Loan card** with loan #28 details
3. **Console logs** showing successful fetch
4. **Auto-refresh** every 30 seconds (check console timestamps)
5. **"Check for Updates" button** responsive and working
6. **No errors** in console or backend logs

## 📞 Still Not Working?

If active loans still don't show after following this guide:

1. **Share console logs** (full output from F12 Console)
2. **Share backend logs** (terminal output)
3. **Share commitment values** (from both borrower and lender)
4. **Share transaction hash** (approval transaction)
5. **Test backend endpoint** with curl and share response

The issue is 99% likely a **commitment mismatch** between what the borrower used to apply and what the lender approved with.
