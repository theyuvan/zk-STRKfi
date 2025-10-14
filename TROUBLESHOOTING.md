# 🔧 Troubleshooting Guide - Contract Address Issues

## Current Status

### ✅ What's Working
- New contract deployed: `0x06b058a0946bb36fa846e6a954da885fa20809f43a9e47038dc83b4041f7f012`
- Contract has `reveal_borrower_identity` and `repay_loan` functions
- Backend .env updated
- Frontend .env updated
- Code fixes applied

### ❌ What's NOT Working
You're seeing these errors:
1. **"Only lender can reveal"** - When clicking reveal identity
2. **"Failed to deserialize param #2"** - When registering ZK proof (Step 2)

## Root Cause Analysis

### Error 1: "Only lender can reveal"
This error means you're **not logged in as the lender** when trying to reveal identity.

**The Contract Rule:**
```cairo
assert(caller == loan.lender, 'Only lender can reveal');
```

**Solution:**
1. Make sure you're on the **Lender Portal** page
2. Enter password: `12345678`
3. Connect the **same wallet** that created the loan
4. Then click "View Applications"
5. Then click "🔓 Reveal Borrower Identity"

**To Verify You're The Lender:**
- Your connected wallet address should match the loan's lender address
- Check in browser console: The loan details will show the lender address

### Error 2: "Failed to deserialize param #2"
This error means the frontend is **still using the OLD contract address**.

**The Evidence:**
The error shows contract address: `0x05b3cf7557800cce10fbad48e6cc95f2ffd82702996ea324bbb2470b6a6ba7ef`
But we deployed NEW contract: `0x06b058a0946bb36fa846e6a954da885fa20809f43a9e47038dc83b4041f7f012`

**Root Cause:** Vite caches environment variables and compiled code

## 🚀 Complete Fix (Do ALL Steps)

### Step 1: Verify .env File
```powershell
cat c:\zk-affordability-loan\frontend\.env
```

You should see:
```
VITE_LOAN_ESCROW_ZK_ADDRESS=0x06b058a0946bb36fa846e6a954da885fa20809f43a9e47038dc83b4041f7f012
```

If you see a different address, update it!

### Step 2: Stop Frontend Completely
Press `Ctrl+C` in the frontend terminal window

### Step 3: Clear Vite Cache
```powershell
cd c:\zk-affordability-loan\frontend
Remove-Item -Recurse -Force node_modules\.vite
```

### Step 4: Clear Browser Cache
Open browser DevTools (F12) and run in Console:
```javascript
// Clear localStorage
localStorage.clear();

// Clear sessionStorage
sessionStorage.clear();

// Log current addresses (before reload)
console.log('Before reload - Contract addresses:', {
  escrow: import.meta?.env?.VITE_LOAN_ESCROW_ZK_ADDRESS,
  verifier: import.meta?.env?.VITE_ACTIVITY_VERIFIER_ADDRESS
});

// Hard reload
location.reload(true);
```

### Step 5: Restart Frontend with Fresh Cache
```powershell
cd c:\zk-affordability-loan\frontend
npm run dev
```

### Step 6: Verify Contract Address in Browser
After page loads, open DevTools Console and run:
```javascript
console.log('Contract Addresses:', {
  escrow: import.meta.env.VITE_LOAN_ESCROW_ZK_ADDRESS,
  verifier: import.meta.env.VITE_ACTIVITY_VERIFIER_ADDRESS,
  strk: import.meta.env.VITE_STRK_TOKEN_ADDRESS
});
```

**Expected Output:**
```
Contract Addresses: {
  escrow: "0x06b058a0946bb36fa846e6a954da885fa20809f43a9e47038dc83b4041f7f012",
  verifier: "0x071b94eb84b81868b61fb0ec1bbb59df47bb508583bc79325e5fa997ee3eb4be",
  strk: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"
}
```

If you see **any different address**, the cache is still active. Repeat Step 3-5.

## 🎯 Testing After Fix

### Test 1: Generate ZK Proof (Step 2)
1. Connect wallet (Argent X/Braavos)
2. Enter wallet address
3. Click "Generate ZK Proof & Enter Dashboard"
4. **Expected:** Success without "param #2" error
5. **Check Console:** Should see contract address `0x06b058a0...`

### Test 2: Create & Apply for Loan
1. **As Lender:**
   - Enter password: `12345678`
   - Create loan (e.g., 10 STRK, 1 slot, 5% interest, 300 seconds deadline)
   
2. **As Borrower:**
   - Connect wallet
   - Generate ZK proof
   - Find the loan in "Available Loans"
   - Click "Apply Now"
   - **Expected:** Application succeeds

3. **As Lender:**
   - Go to "My Loan Offers"
   - Click "View Applications"
   - Click "✅ Approve & Release Funds"
   - **Expected:** Approval succeeds

4. **As Borrower:**
   - Check "Active Loans" section
   - **Expected:** Loan appears with countdown timer

### Test 3: Repay Loan
1. **As Borrower:**
   - In "Active Loans" section
   - Click "💰 Repay Loan" button
   - **Expected:** No "Use repay_loan_with_commitment" error
   - **Expected:** Transaction succeeds
   - **Expected:** Loan disappears from active loans

### Test 4: Reveal Identity (for overdue loans)
1. **Wait for loan to be overdue** (or create loan with very short deadline)
2. **As Lender:**
   - Enter password: `12345678`
   - Make sure you're using the **same wallet** that created the loan
   - Go to "My Loan Offers"
   - Click "View Applications"
   - **Expected:** See "⚠️ OVERDUE" badge
   - Click "🔓 Reveal Borrower Identity"
   - **Expected:** No "Only lender can reveal" error
   - **Expected:** Shows borrower wallet address

## 🐛 Common Mistakes

### Mistake 1: Wrong Wallet for Reveal
**Error:** "Only lender can reveal"
**Fix:** Connect the wallet that **created the loan**, not any random wallet

### Mistake 2: Trying to Reveal Before Deadline
**Error:** "Loan not overdue yet"
**Fix:** Wait until deadline passes, or create test loan with 60 second deadline

### Mistake 3: Vite Cache Not Cleared
**Error:** Still hitting old contract (`0x05b3cf7...` or `0x0731fa59...`)
**Fix:** Delete `frontend/node_modules/.vite` folder

### Mistake 4: Browser Cache Not Cleared
**Error:** localStorage has old contract addresses
**Fix:** Run `localStorage.clear()` in console

## 📊 Verification Checklist

Before testing, verify:
- [ ] Frontend .env has NEW contract: `0x06b058a0...`
- [ ] Backend .env has NEW contract: `0x06b058a0...`
- [ ] Vite cache deleted: `frontend/node_modules/.vite` doesn't exist
- [ ] Browser localStorage cleared
- [ ] Frontend restarted with `npm run dev`
- [ ] Backend restarted with `npm start`
- [ ] Browser console shows NEW contract address

## 🎉 Success Indicators

You'll know it's working when:
1. ✅ ZK proof registers without "param #2" error
2. ✅ Browser console shows contract `0x06b058a0...`
3. ✅ No "Use repay_loan_with_commitment" error
4. ✅ No "ENTRYPOINT_NOT_FOUND" error
5. ✅ "Only lender can reveal" only appears when not logged in as lender

## 📞 Still Having Issues?

### Debug Command 1: Check Which Contract Frontend Is Using
In browser console:
```javascript
// This will show in real-time which contract the code is calling
const originalExecute = window.starknet?.account?.execute;
if (originalExecute) {
  window.starknet.account.execute = function(call) {
    console.log('🔍 Contract Call:', call);
    return originalExecute.apply(this, arguments);
  };
}
```

### Debug Command 2: Check .env Loading
```javascript
console.log('All VITE env vars:', 
  Object.entries(import.meta.env)
    .filter(([key]) => key.startsWith('VITE_'))
);
```

### Debug Command 3: Check localStorage
```javascript
console.log('localStorage contents:', 
  Object.entries(localStorage)
);
```

## 🔄 Nuclear Option (Last Resort)

If NOTHING works:
```powershell
# Stop all processes
# Frontend: Ctrl+C
# Backend: Ctrl+C

# Clear everything
cd c:\zk-affordability-loan\frontend
Remove-Item -Recurse -Force node_modules\.vite
Remove-Item -Recurse -Force dist

# Clear node_modules (if needed)
# Remove-Item -Recurse -Force node_modules
# npm install

# Restart
npm run dev

# In new terminal:
cd c:\zk-affordability-loan\backend
npm start
```

Then clear browser:
1. Open DevTools (F12)
2. Application tab > Clear storage > Clear site data
3. Close and reopen browser
4. Hard reload: Ctrl+Shift+R
