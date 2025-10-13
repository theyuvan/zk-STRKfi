# 🔄 Restart Instructions - Fixed Contracts Deployed

## ✅ What Was Fixed

1. **New LoanEscrowZK Contract Deployed** with `repay_loan` and `reveal_borrower_identity` functions
   - New Address: `0x06b058a0946bb36fa846e6a954da885fa20809f43a9e47038dc83b4041f7f012`
   - Old Address: `0x0731fa59e1da780c1585de660415f627c2c66c4b42b8849805e68a2eaaca79d8`

2. **Fixed Parameter Deserialization** in ZK proof registration
   - Changed calldata format from `.toString()` to direct BigInt values
   - Properly formats u256 parameters for Starknet

3. **Updated .env Files** 
   - Backend: `c:\zk-affordability-loan\backend\.env` ✅
   - Frontend: `c:\zk-affordability-loan\frontend\.env` ✅

## 🚀 Required Steps

### 1. Stop Running Services

Press `Ctrl+C` in both terminals to stop:
- Backend (running on port 3000)
- Frontend (running on port 5173)

### 2. Clear Browser Cache & localStorage

Open browser DevTools (F12):
```javascript
// In Console tab:
localStorage.clear();
location.reload();
```

### 3. Restart Backend

```powershell
cd c:\zk-affordability-loan\backend
npm start
```

Wait for: `✅ Server running on port 3000`

### 4. Restart Frontend

```powershell
cd c:\zk-affordability-loan\frontend
npm run dev
```

Wait for: `Local: http://localhost:5173/`

### 5. Test the Full Flow

1. **Connect Wallet** (Argent X or Braavos)
2. **Generate ZK Proof** - This should now work without "param #2" error
3. **Create a Loan** (as lender with password: 12345678)
4. **Apply for Loan** (as borrower)
5. **Approve Loan** (as lender)
6. **Check Active Loans** - Should display with countdown timer
7. **Test Repay Function** - Should work without "Use repay_loan_with_commitment" error
8. **Test Reveal Identity** (if overdue) - Should work without "ENTRYPOINT_NOT_FOUND" error

## 🎯 New Contract Features

### ✅ Repay Loan Function
```cairo
fn repay_loan(loan_id: u256, borrower_commitment: felt252)
```
- Borrower can repay loan with their commitment
- Transfers repayment amount from borrower to lender
- Updates application status to "repaid"
- Emits `LoanRepaid` event

### ✅ Reveal Borrower Identity Function
```cairo
fn reveal_borrower_identity(loan_id: u256, borrower_commitment: felt252)
```
- Only lender can call
- Only works if loan is overdue
- Reveals borrower's wallet address
- Emits `IdentityRevealed` event with:
  - Borrower address
  - Amount due
  - Days overdue

## 📝 Contract Addresses

All addresses are on **Starknet Sepolia Testnet**:

| Contract | Address |
|----------|---------|
| **LoanEscrowZK** (NEW) | `0x06b058a0946bb36fa846e6a954da885fa20809f43a9e47038dc83b4041f7f012` |
| ActivityVerifier | `0x071b94eb84b81868b61fb0ec1bbb59df47bb508583bc79325e5fa997ee3eb4be` |
| STRK Token | `0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d` |

## 🐛 If You Still See Errors

### Error: "Failed to deserialize param #2"
- **Solution**: Clear browser cache and restart frontend
- Make sure you're using the NEW contract address

### Error: "ENTRYPOINT_NOT_FOUND"
- **Solution**: Restart both backend and frontend
- The old contract didn't have `reveal_borrower_identity` function

### Error: "Use repay_loan_with_commitment"
- **Solution**: This error should be gone with the new contract
- If still seeing it, verify contract address in .env files

### Error: "0 loans" after approval
- **Solution**: 
  1. Clear localStorage: `localStorage.clear()`
  2. Regenerate ZK proof
  3. Make sure commitment is 65 characters (not 66)

## ✅ Success Indicators

You'll know everything is working when:
- ✅ ZK proof registers without "param #2" error
- ✅ Active loans appear after approval
- ✅ Countdown timer shows time remaining
- ✅ Repay button works without errors
- ✅ Reveal identity button works for overdue loans

## 📞 Need Help?

Check the browser console (F12) for detailed error messages and logs. All operations log their progress with emoji prefixes:
- 🎯 = Important information
- ✅ = Success
- ❌ = Error
- 🔍 = Debug information
- 💾 = Storage operation
