# Quick Testing Guide - Identity Commitment System

## Prerequisites
- Backend running on `http://localhost:3000`
- Frontend running on `http://localhost:5173`
- Wallet connected with STRK tokens

## Test Scenario: Complete Flow

### Part 1: First-Time Borrower (Identity Creation)

1. **Open Borrower Page**: Navigate to borrower flow
2. **Connect Wallet**: Click "Connect Wallet"
3. **Fetch Activity**: Click "Fetch Activity Data"
   - Should show activity score (e.g., 750)
4. **Generate ZK Proof**: Click "Generate ZK Proof"
   - Check browser console for: `💾 Saved NEW identity commitment: 0x...`
   - Check localStorage: `identityCommitment` should be saved
   - Transaction should be submitted to ActivityVerifier contract
5. **Check Proof Status**: After transaction confirmation
   - `zkProofGenerated` should be true
   - Available loans should load

### Part 2: Apply for First Loan

6. **Select Loan**: Click "View Details" on any loan
7. **Apply for Loan**: Click "Apply for this Loan"
   - Check console for: `🎯 Identity commitment (for applications): 0x...`
   - Transaction should be submitted to LoanEscrowZK contract
   - Alert: "Application submitted successfully!"

### Part 3: Score Update (Same Identity)

8. **Clear zkProofGenerated** (simulate score update):
   - Open browser DevTools
   - Run: `localStorage.removeItem('zkCommitment')`
   - Refresh page, connect wallet again
9. **Modify Activity Score** (for testing):
   - In console: `activityData.score = 850` (or fetch new activity)
10. **Generate New ZK Proof**: Click "Generate ZK Proof" again
    - Check console for: `✅ Found existing identity commitment: 0x...`
    - Should see: "Using same identity as before"
    - New proof commitment may differ, but identityCommitment stays same
11. **Apply for Second Loan**: Apply to a different loan
    - Uses SAME identity commitment
    - New application stored with same commitment

### Part 4: Lender View (Critical Test)

12. **Open Lender Page**: Navigate to lender flow
13. **Login**: Enter password (12345678)
14. **Connect Wallet**: Connect as lender
15. **View Your Loans**: Click "View Applications" on your loan
16. **Check Applications**: Should see ALL applications
    - Check console for: `📊 Total events found: X`
    - Should see: `✅ Found application for loan Y!`
    - Applications list should populate with borrower details

### Expected Results

✅ **Identity Persistence**:
- localStorage has `identityCommitment` saved
- All applications use same commitment value
- Can verify in blockchain events: all have same commitment

✅ **Score Updates Work**:
- New proofs can be generated with updated scores
- Identity commitment remains unchanged
- Both proofs registered on ActivityVerifier

✅ **Lender Can See Applications**:
- Backend queries LoanApplicationSubmitted events
- Finds all commitments that applied to loan
- Fetches full application details for each
- Returns array with borrower address, score, status

## Testing Commands

### Check Backend Logs
```powershell
# Watch backend logs for debugging
cd c:\zk-affordability-loan\backend
npm start
```

Look for these log messages:
- `🔐 Identity system` - Shows if existing identity found
- `📬 Fetching applications for loan: X` - Lender querying apps
- `📊 Total events found: Y` - Event query results
- `✅ Found application for loan X!` - Application discovered

### Check localStorage
```javascript
// In browser console
console.log('Identity:', localStorage.getItem('identityCommitment'));
console.log('Proof Hash:', localStorage.getItem('zkProofHash'));
console.log('Score:', localStorage.getItem('zkActivityScore'));
```

### Test API Endpoints Directly

```powershell
# Generate proof (first time)
Invoke-WebRequest -Uri "http://localhost:3000/api/proof/generate" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"salary": 750, "threshold": 100, "walletAddress": "0x0239..."}' `
  | Select-Object -ExpandProperty Content | ConvertFrom-Json

# Generate proof (with existing identity)
Invoke-WebRequest -Uri "http://localhost:3000/api/proof/generate" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"salary": 850, "threshold": 100, "walletAddress": "0x0239...", "identityCommitment": "0x5b5a..."}' `
  | Select-Object -ExpandProperty Content | ConvertFrom-Json

# Get applications for loan
Invoke-WebRequest -Uri "http://localhost:3000/api/loan/33/applications" `
  | Select-Object -ExpandProperty Content | ConvertFrom-Json
```

## Common Issues & Solutions

### Issue: "No applications found"
**Cause**: Event querying might be slow or failing on Sepolia
**Solution**: 
- Check backend logs for event query errors
- Wait a few seconds and refresh
- Verify applications exist: check borrower endpoint `/borrower/:commitment/applications`

### Issue: "Different commitment each time"
**Cause**: localStorage not persisting or being cleared
**Solution**:
- Check browser console for `💾 Saved NEW identity commitment`
- Verify localStorage has `identityCommitment` key
- Make sure not clearing localStorage between tests

### Issue: "Transaction failed"
**Cause**: Insufficient STRK balance or wallet not connected
**Solution**:
- Check STRK balance in wallet
- Ensure wallet is connected and on Sepolia testnet
- Check transaction error in console

## Success Criteria

✅ Identity commitment saved on first proof generation
✅ Same commitment used for all applications (check localStorage)
✅ Score can be updated without losing identity
✅ Lender can see ALL applications for their loan
✅ Applications show correct borrower address and score
✅ Backend logs show event querying working
✅ No errors in browser console or backend logs

## Next Steps After Testing

Once identity system is verified working:
1. Test approval flow (lender approves borrower)
2. Test repayment flow (borrower repays loan)
3. Test escrow/transfer mechanics
4. Consider implementing event indexer for production
