# Quick Start Guide

## 🚀 Running the Application

### Prerequisites
- Node.js (v16+)
- StarkNet wallet (Argent X or Braavos)
- STRK tokens on Sepolia testnet

### Backend Setup

1. **Navigate to backend**
```powershell
cd C:\zk-affordability-loan\backend
```

2. **Install dependencies** (if not already done)
```powershell
npm install
```

3. **Start the server**
```powershell
npm start
```

**Expected Output:**
```
✅ info: Event watcher started
✅ info: Server running on port 3000
✅ info: Starting from block 2513771
```

**Server runs on**: `http://localhost:3000`

### Frontend Setup

1. **Navigate to frontend**
```powershell
cd C:\zk-affordability-loan\frontend
```

2. **Install dependencies** (if not already done)
```powershell
npm install
```

3. **Create `.env` file** (if not exists)
```env
VITE_STARKNET_RPC=https://starknet-sepolia.public.blastapi.io
VITE_STRK_TOKEN_ADDRESS=0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d
VITE_BACKEND_URL=http://localhost:3000
```

4. **Start the dev server**
```powershell
npm run dev
```

**Expected Output:**
```
✅ VITE v5.x.x ready in xxx ms
✅ Local: http://localhost:5173/
```

### Test the Complete Flow

1. **Open Browser**: Navigate to `http://localhost:5173/loan-borrower`

2. **Step 1: Connect Wallet**
   - Click "Connect Wallet"
   - Select Argent X or Braavos
   - Approve connection

3. **Step 2: Fetch Activity**
   - Click "Fetch My Activity"
   - Wait for blockchain data (5-10 seconds)
   - View your activity score (0-1000)

4. **Step 3: Generate ZK Proof**
   - Click "Generate ZK Proof"
   - Wait for proof generation (10-20 seconds)
   - Check cache status (♻️ or 🆕)

5. **Step 4: Apply for Loan**
   - Review loan terms: 50 STRK, 5% interest, 10 minutes
   - Check eligibility (need score ≥ 500)
   - Click "Apply for 50 STRK Loan"

6. **Step 5: Repayment or Default**
   - **Option A - Repay**: Click "Repay 52.5 STRK Now" before timer expires
   - **Option B - Default**: Wait for timer to reach 0:00

### Testing Default Flow

To test identity reveal on default:

1. **Apply for loan** (follow steps 1-4 above)
2. **Wait 10 minutes** (or reduce `repaymentPeriod` in `loanController.js` line 46 for faster testing)
3. **Check backend console** - You'll see:

```
================================================================================
🚨 LOAN DEFAULT DETECTED - IDENTITY REVEAL 🚨
================================================================================
Loan ID:            abc123...
Borrower Address:   0x0123...abcd
Lender Address:     0x1234...cdef
Loan Amount:        50 STRK
Repayment Amount:   52.5 STRK
Deadline:           2025-10-12T11:40:00.000Z
Defaulted At:       2025-10-12T11:40:01.234Z
Proof Hash:         0x789...
Commitment:         0xdef...
⚠️  Borrower identity revealed to lender for collection purposes
================================================================================
```

### API Endpoints (Testing)

**Check loan status:**
```powershell
curl http://localhost:3000/api/loan/status/YOUR_LOAN_ID
```

**Get all active loans:**
```powershell
curl http://localhost:3000/api/loan/active
```

**Get monitoring stats:**
```powershell
curl http://localhost:3000/api/loan/stats
```

**Force default (testing):**
```powershell
curl -X POST http://localhost:3000/api/loan/default/YOUR_LOAN_ID
```

### Troubleshooting

**Backend won't start:**
- Check port 3000 is not in use
- Verify `backend/src/services/loanMonitor.js` exists
- Check `backend/src/controllers/loanController.js` has no syntax errors

**Frontend can't connect wallet:**
- Install Argent X: https://www.argent.xyz/argent-x/
- Install Braavos: https://braavos.app/
- Make sure wallet is on Sepolia testnet

**No STRK balance:**
- Get testnet STRK from faucet: https://starknet-faucet.vercel.app/
- Or use Sepolia bridge

**Activity score is 0:**
- Make sure you have STRK balance
- Make at least 1 transaction on Sepolia
- Wait a few seconds for RPC to index

**Proof generation fails:**
- Check `contracts/zk/build/` has:
  - `activityVerifier.wasm`
  - `activityVerifier.zkey`
  - `verification_key.json`
- Rebuild circuit if missing: `cd contracts/zk; ./build_zk.sh`

**Timer doesn't start:**
- Check backend console for loan monitoring start message
- Verify loan application returned `{ success: true, loanId, deadline }`
- Check Network tab in browser DevTools

### Quick Test with Reduced Timer

For faster testing, edit `backend/src/controllers/loanController.js`:

```javascript
// Line 46 - Change from 600 (10 min) to 60 (1 min)
repaymentPeriod: 60, // 1 minute for testing
```

Restart backend after change.

---

## 📊 What's Working

✅ **Frontend (Option A)**
- Real StarkNet Sepolia integration
- STRK balance fetching
- Transaction history retrieval
- Activity score calculation (0-1000)
- ZK proof generation
- Proof caching (24h TTL)
- 5-step loan flow UI
- 10-minute countdown timer
- Responsive design

✅ **Backend (Option B)**
- Loan application endpoint
- Repayment endpoint
- Loan monitoring service
- Automatic default handling
- Identity reveal console logging
- Event-driven architecture
- Stats and query endpoints

⏳ **Smart Contracts (Option C)**
- Pending implementation
- Will integrate with Cairo contracts on StarkNet

---

## 🎯 Expected Behavior

### Successful Repayment Flow
```
1. Apply for loan → Backend starts 10-min timer
2. Frontend shows countdown: 10:00 → 9:59 → ... → 5:00 → ...
3. User clicks "Repay 52.5 STRK Now"
4. POST /api/loan/repay → Backend clears timer
5. Frontend: "✅ Loan repaid successfully!"
6. Return to loan selection
```

### Default Flow
```
1. Apply for loan → Backend starts 10-min timer
2. Frontend shows countdown: 10:00 → 9:59 → ... → 0:01 → 0:00
3. Backend timer expires → handleDefault() executes
4. Console logs borrower identity (wallet address, loan details)
5. Frontend: "⏰ TIME EXPIRED - LOAN DEFAULTED"
6. Repay button disabled
```

---

## 📝 Notes

- **Mock Data**: Only the loan provider is mocked (DeFi Lender Alpha)
- **Real Data**: All wallet data, transactions, scores, and proofs are real
- **Testnet**: Uses StarkNet Sepolia (not mainnet)
- **Timer**: 10 minutes in production, can be reduced for testing
- **Identity Reveal**: Console logging only (no on-chain reveal yet)

---

**Status**: ✅ Backend Running | ⏳ Frontend Setup | ⏳ Smart Contracts Pending
