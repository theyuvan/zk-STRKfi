# 🎯 Complete Testing Guide - On-Chain ZK Loan System

## ✅ System Status

### Backend (Port 3000) - RUNNING ✅
```
✅ Server running on port 3000
✅ Event watcher monitoring blockchain
✅ ZK proof generation working
✅ API endpoints ready
```

### Frontend (Port 3001) - RUNNING ✅
```
✅ Vite dev server running
✅ Hot module replacement active
✅ All components updated
✅ Contract addresses configured
```

### Smart Contracts (StarkNet Sepolia) - DEPLOYED ✅
```
✅ LoanEscrowZK: 0x05a4d3ed7d102ab91715c2b36c70b5e9795a3e917214dbd9af40503d2c29f83d
✅ ActivityVerifier: 0x071b94eb84b81868b61fb0ec1bbb59df47bb508583bc79325e5fa997ee3eb4be
✅ STRK Token: 0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d
```

---

## 🧪 Step-by-Step Testing Instructions

### Prerequisites
1. **Wallet Extension Installed**
   - Argent X OR Braavos wallet extension in your browser
   - Wallet configured for StarkNet Sepolia testnet
   
2. **Test STRK Tokens**
   - Get test STRK from Sepolia faucet: https://starknet-faucet.vercel.app/
   - Minimum required: ~100 STRK for testing

3. **Servers Running**
   - Backend: http://localhost:3000 ✅
   - Frontend: http://localhost:3001 ✅

---

## 📝 Test Scenario 1: Create Loan Offer (Lender)

### Step 1: Access Lender Interface
1. Open browser: http://localhost:3001
2. Navigate to **Lender Flow** page
3. Enter password: `12345678`
4. Click "Submit"

### Step 2: Connect Wallet
1. Click "Connect Wallet"
2. Select Argent X or Braavos
3. Approve connection
4. Verify wallet address displayed
5. Verify STRK balance shown

**Expected Output:**
```
✅ Wallet connected: 0x5b3cf755...6ba7ef
💰 STRK Balance: 150.000000 STRK
```

### Step 3: Fetch Activity Data
1. Click "Fetch My Activity Data"
2. Wait for mock data generation

**Expected Output:**
```
✅ Activity data:
   - Score: 750
   - Transactions: 45
   - Volume: $12,350
```

### Step 4: Generate ZK Proof
1. Click "Generate ZK Proof for Lender Verification"
2. Wait for proof generation (~2-3 seconds)

**Expected Console Output:**
```
🔐 Generating ZK proof...
✅ ZK proof generated
```

**Expected Response:**
```json
{
  "proof": { ... },
  "publicSignals": ["1", "750", "commitmentHash..."],
  "proofHash": "6ab5f682fa24cf22...",
  "commitmentHash": "e0a59a9f9e733637..."
}
```

### Step 5: Create Loan Offer
1. Click "Create New Loan Offer"
2. Fill in the form:
   - **Loan Amount per Borrower**: `50` STRK
   - **Number of Borrowers**: `2`
   - **Interest Rate**: `10` (%)
   - **Repayment Period**: `3600` (seconds = 1 hour)
3. Click "Create Loan Offer"

**Expected Flow:**
```
📝 Step 1/2: Approving STRK spending...
💰 Approve amount: 100 STRK (50 × 2 borrowers)
⏳ Waiting for approval tx: 0x...
✅ Approval confirmed

📜 Step 2/2: Creating loan offer on blockchain...
⏳ Waiting for loan creation tx: 0x...
✅ Loan offer created on blockchain!
```

**Browser Alert:**
```
✅ Loan offer created successfully on blockchain!
Transaction: 0x...
```

### Step 6: Verify Loan Created
1. Check "My Loan Offers" section
2. Should show newly created loan

**Expected Display:**
```
Loan #1
Amount: 50 STRK per borrower
Slots: 0/2 filled
Interest: 10%
Period: 3600 seconds
Min Score: 100
Status: Active
```

---

## 📝 Test Scenario 2: Apply for Loan (Borrower)

### Step 1: Access Borrower Interface
1. Open **new incognito window** (or use different wallet)
2. Navigate to http://localhost:3001
3. Go to **Borrower Flow** page

### Step 2: Connect Borrower Wallet
1. Click "Connect Wallet"
2. Connect different wallet than lender
3. Verify balance

**Expected:**
```
✅ Wallet connected: 0x1a2b3c4d...
💰 STRK Balance: 75.000000 STRK
```

### Step 3: Generate Borrower ZK Proof
1. Click "Fetch My Activity Data"
2. Click "Generate ZK Proof for Loan Application"

**Expected:**
```
🔐 Generating ZK proof...
✅ ZK proof generated
   - Activity Score: 650
   - Commitment: abc123...
   - Proof Hash: def456...
```

### Step 4: Register Proof (Important!)
**This step must be done before applying for loan**

1. Click "Register Proof on Blockchain" (if available)
2. OR manually call:
   ```javascript
   // In browser console
   const response = await fetch('http://localhost:3000/api/loan/register-proof', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       proofHash: 'YOUR_PROOF_HASH',
       commitment: 'YOUR_COMMITMENT',
       activityScore: 650
     })
   });
   ```

### Step 5: Browse Available Loans
1. Click "View Available Loans"
2. Should see lender's loan offer

**Expected:**
```
Available Loans (1)
────────────────────────────
Loan #1
Lender: 0x5b3cf755...6ba7ef
Amount: 50 STRK
Slots: 0/2 filled
Interest: 10%
Min Score: 100
[Apply] button
```

### Step 6: Apply for Loan
1. Click "Apply" on desired loan
2. Confirm transaction in wallet

**Expected Flow:**
```
📝 Submitting loan application...
🔐 Using ZK proof: def456...
🔐 Using commitment: abc123...
⏳ Calling contract.apply_for_loan()...
⏳ Waiting for transaction...
✅ Application submitted!
```

**What Happens On-Chain:**
1. Contract calls `ActivityVerifier.verify_proof()`
2. Verifier checks if proof is valid for given commitment and score
3. If valid: Application accepted ✅
4. If invalid: Transaction reverts ❌

---

## 📝 Test Scenario 3: Approve Borrower (Lender)

### Step 1: View Applications
1. Return to lender window
2. Click on "Loan #1" to view details
3. Should see borrower's application

**Expected:**
```
Applications (1)
────────────────────────────
Borrower Commitment: abc123...
Activity Score: 650
Status: Pending
[Approve] button
```

### Step 2: Approve Borrower
1. Click "Approve" button
2. Confirm transaction in wallet

**Expected Flow:**
```
📝 Approving borrower...
⏳ Calling contract.approve_borrower()...
⏳ Transferring 50 STRK to borrower...
✅ Borrower approved!
✅ Funds transferred!
```

**What Happens On-Chain:**
1. Contract calls `STRK.transferFrom(lender, borrower, 50 STRK)`
2. Borrower receives 50 STRK immediately
3. Loan status updated to "Active"
4. Repayment deadline set (current time + 3600 seconds)

### Step 3: Verify Transfer
1. Check borrower wallet balance
2. Should increase by 50 STRK

**Borrower Balance:**
```
Before: 75 STRK
After:  125 STRK ✅ (+50 STRK)
```

---

## 📝 Test Scenario 4: Repay Loan (Borrower)

### Step 1: View Active Loans
1. In borrower window
2. Navigate to "My Active Loans"
3. Should see approved loan

**Expected:**
```
Active Loans (1)
────────────────────────────
Loan #1
Amount Borrowed: 50 STRK
Interest (10%): 5 STRK
Total Repayment: 55 STRK
Deadline: Oct 13, 2025 2:00 AM
[Repay] button
```

### Step 2: Repay Loan
1. Click "Repay" button
2. Confirm transaction in wallet

**Expected Flow:**
```
📝 Step 1/2: Approving STRK for repayment...
💰 Repayment amount: 55 STRK (50 + 5 interest)
⏳ Waiting for approval...
✅ Approval confirmed

📜 Step 2/2: Repaying loan...
⏳ Calling contract.repay_loan()...
⏳ Transferring 55 STRK to lender...
✅ Loan repaid successfully!
```

**What Happens On-Chain:**
1. Contract calls `STRK.transferFrom(borrower, lender, 55 STRK)`
2. Lender receives 55 STRK (50 principal + 5 interest)
3. Loan status updated to "Repaid"
4. Borrower marked as fully repaid

### Step 3: Verify Final Balances

**Lender:**
```
Initial:  150 STRK
After creating loan: 50 STRK (-100 for 2 borrowers, only 1 approved)
After repayment: 105 STRK (+55 repayment)
Net Profit: 5 STRK ✅ (interest earned)
```

**Borrower:**
```
Initial: 75 STRK
After approval: 125 STRK (+50 loan)
After repayment: 70 STRK (-55 repayment)
Net Cost: -5 STRK ✅ (interest paid)
```

---

## 🔍 Debugging & Console Monitoring

### Backend Console (Port 3000)
Monitor for:
```
info: POST /api/proof/generate
info: ZK proof generated successfully
info: GET /api/loan/lender/0x...
info: ✅ Found X loans for lender
info: Retrieved loan events
```

### Frontend Console (Browser DevTools)
Monitor for:
```javascript
// Wallet Connection
✅ Wallet connected: 0x...
💰 STRK Balance: 150.000000

// ZK Proof Generation
🔐 Generating ZK proof...
✅ ZK proof generated

// Loan Creation
💼 Creating loan offer: { ... }
📝 Step 1/2: Approving STRK spending...
💰 Approve amount: 100 STRK = 100000000000000000000 wei
💰 Uint256 format: { low: '...', high: '...' }
⏳ Waiting for approval tx: 0x...
✅ Approval confirmed
📜 Step 2/2: Creating loan offer on blockchain...
⏳ Waiting for loan creation tx: 0x...
✅ Loan offer created on blockchain!

// Loan Application
📝 Submitting loan application...
✅ Application submitted!

// Borrower Approval
📝 Approving borrower...
✅ Borrower approved!

// Loan Repayment
📝 Approving STRK for repayment...
✅ Approval confirmed
💰 Repaying loan...
✅ Loan repaid successfully!
```

### Blockchain Explorer (StarkScan)
View transactions:
- https://sepolia.starkscan.co/contract/0x05a4d3ed7d102ab91715c2b36c70b5e9795a3e917214dbd9af40503d2c29f83d

Check for:
- `create_loan_offer` calls
- `apply_for_loan` calls (with ZK verification)
- `approve_borrower` calls
- `repay_loan` calls
- STRK transfer events

---

## ❌ Common Errors & Solutions

### Error 1: "undefined can't be computed by felt()"
**Cause:** Uint256 passed as object instead of low/high values

**Solution:** Already fixed in code! Uses:
```javascript
const amountUint256 = uint256.bnToUint256(amount);
contract.invoke('function', [
  amountUint256.low,   // ✅
  amountUint256.high   // ✅
]);
```

### Error 2: "Contract address undefined"
**Cause:** Environment variable not loaded

**Solution:** Check `frontend/.env` file exists with:
```bash
VITE_LOAN_ESCROW_ZK_ADDRESS=0x05a4d3ed...
VITE_ACTIVITY_VERIFIER_ADDRESS=0x071b94eb...
VITE_STRK_TOKEN_ADDRESS=0x04718f5a...
```

### Error 3: "ZK proof verification failed"
**Cause:** Proof not registered on ActivityVerifier

**Solution:** Call `/api/loan/register-proof` before applying:
```javascript
await fetch('http://localhost:3000/api/loan/register-proof', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    proofHash: proof.proofHash,
    commitment: proof.commitmentHash,
    activityScore: activityData.score
  })
});
```

### Error 4: "Insufficient balance"
**Cause:** Not enough STRK tokens

**Solution:** Get test STRK from faucet:
- https://starknet-faucet.vercel.app/
- https://faucet.goerli.starknet.io/

### Error 5: "Transaction reverted"
**Cause:** Multiple possibilities:
1. Activity score < min required score
2. Loan already filled
3. Insufficient allowance

**Solution:** Check console logs for specific error message

---

## 📊 Expected Test Results

### Successful Test Run
```
✅ Lender wallet connected
✅ Lender ZK proof generated
✅ Loan offer created (50 STRK × 2 slots)
✅ Borrower wallet connected
✅ Borrower ZK proof generated
✅ Proof registered on-chain
✅ Loan application submitted
✅ ZK proof verified by contract
✅ Borrower approved by lender
✅ 50 STRK transferred to borrower
✅ Loan repaid (55 STRK)
✅ Lender received repayment + interest
✅ Loan status = Repaid
```

### Transaction Count
- Total transactions: 7
  1. Approve STRK (lender)
  2. Create loan offer
  3. Register proof
  4. Apply for loan
  5. Approve borrower
  6. Approve STRK (borrower)
  7. Repay loan

### Gas Costs (Approximate)
- Loan creation: ~0.001 STRK
- Loan application: ~0.0015 STRK
- Approve borrower: ~0.002 STRK
- Repay loan: ~0.002 STRK
- **Total gas: ~0.0065 STRK**

---

## 🎉 Success Criteria

Your system is working correctly if:

1. ✅ Lender can create loan offers on blockchain
2. ✅ Borrower can generate ZK proofs
3. ✅ Borrower can apply for loans
4. ✅ Contract enforces ZK verification (rejects invalid proofs)
5. ✅ Lender can approve borrowers
6. ✅ STRK transfers execute correctly
7. ✅ Borrower can repay loans
8. ✅ Interest calculated correctly
9. ✅ No in-memory caches (all data from blockchain)
10. ✅ Event watcher detects on-chain events

---

## 📱 Quick Test Checklist

Use this for rapid testing:

- [ ] Backend running on port 3000
- [ ] Frontend running on port 3001
- [ ] Lender wallet has >100 STRK
- [ ] Borrower wallet has >60 STRK
- [ ] Lender creates loan (50 STRK × 2)
- [ ] Borrower generates ZK proof
- [ ] Borrower applies for loan
- [ ] Application accepted (proof valid)
- [ ] Lender approves borrower
- [ ] Borrower receives 50 STRK
- [ ] Borrower repays 55 STRK
- [ ] Lender receives repayment
- [ ] All transactions confirmed on StarkScan

---

## 🚀 Next Steps After Testing

1. **Test edge cases:**
   - Invalid ZK proofs (should reject)
   - Insufficient balances
   - Expired repayment deadlines
   - Multiple borrowers per loan

2. **Test concurrent operations:**
   - Multiple loans active simultaneously
   - Multiple applications to same loan
   - Rapid creation/application cycles

3. **Performance testing:**
   - Query speed with many loans
   - Event watcher performance
   - Frontend rendering with 100+ loans

4. **Security testing:**
   - Try to bypass ZK verification
   - Test commitment uniqueness
   - Test reentrancy protection

5. **Deploy to production:**
   - Deploy contracts to StarkNet Mainnet
   - Update RPC endpoints
   - Configure production environment variables
   - Set up monitoring and alerts

---

## 📞 Support

If you encounter issues:

1. Check backend console for errors
2. Check browser console for errors
3. Verify contract addresses in `.env` files
4. Verify transactions on StarkScan
5. Review `FRONTEND_FIXES_COMPLETE.md` for detailed fixes

---

## 🎊 System is Ready!

Both servers are running, all fixes applied, and the system is ready for testing!

**Access Points:**
- Frontend: http://localhost:3001
- Backend: http://localhost:3000
- Blockchain: StarkNet Sepolia Testnet

**Happy Testing! 🚀**
