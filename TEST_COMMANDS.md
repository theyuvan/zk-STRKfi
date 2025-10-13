# 🧪 Test Commands - Run These Now

## Step 1: Start Backend

```powershell
cd C:\zk-affordability-loan\backend
npm start
```

**Expected Output:**
```
Server running on http://localhost:3000
ZK Service initialized
```

---

## Step 2: Test Backend Proof Generation

Open a new PowerShell terminal:

```powershell
# Test proof generation endpoint
Invoke-WebRequest -Uri "http://localhost:3000/api/proof/generate" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"salary": 750, "threshold": 500, "walletAddress": "123456789012345678901234567890"}' | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

**Expected Response:**
```json
{
  "message": "Proof generated successfully",
  "proof": { ... },
  "publicSignals": [...],
  "commitment": "0x1234abcd...",
  "proofHash": "0x5678ef01...",
  "activityScore": 750
}
```

---

## Step 3: Start Frontend

Open another PowerShell terminal:

```powershell
cd C:\zk-affordability-loan\frontend
npm run dev
```

**Expected Output:**
```
VITE ready in 500ms
Local: http://localhost:3001/
```

---

## Step 4: Test Complete Flow

### In Browser (http://localhost:3001):

1. **Connect Wallet**
   - Click "Connect Wallet"
   - Approve connection in Argent/Braavos

2. **Generate ZK Proof**
   - Go to Borrower page
   - Click "Generate ZK Proof"
   - Check console (F12) for:
     ```
     Generating ZK proof for score: 750
     Backend proof response: {...}
     Registering proof on verifier contract...
     Proof registered on-chain!
     ```

3. **Apply for Loan**
   - Select a loan
   - Click "Apply"
   - Approve transaction in wallet
   - Check console for:
     ```
     Applying for loan: 1
     Application submitted on blockchain!
     ```

4. **Verify in Lender Page**
   - Switch to Lender page
   - See loan application
   - Click "Approve"
   - Verify STRK transfer!

---

## 🔍 Debug Commands

### Check Backend Logs
```powershell
# In backend terminal, you should see:
ZK proof generated {
  threshold: 500,
  activityScore: 750,
  publicSignalsCount: 3,
  proofHash: '0x5678ef01...'
}
```

### Check Frontend Console
```javascript
// F12 → Console
// You should see:
✅ ZK proof generated: {proof: {...}, commitment: "0x...", ...}
📝 Registering proof on verifier contract...
✅ Proof registered on-chain!
```

### Check Transaction on Voyager
```
https://sepolia.voyager.online/tx/{transaction_hash}
```

---

## ❌ Troubleshooting

### Backend Error: "Cannot find module 'snarkjs'"
```powershell
cd C:\zk-affordability-loan\backend
npm install snarkjs circomlibjs
```

### Backend Error: "ENOENT: no such file or directory"
```powershell
# Make sure circuit files are in backend/src/zk/
ls C:\zk-affordability-loan\backend\src\zk\

# Should show:
# activityVerifier.wasm
# activityVerifier_final.zkey
# verification_key.json

# If missing, rebuild circuit:
cd C:\zk-affordability-loan
.\scripts\build_circuit.ps1
```

### Frontend Error: "Wallet not connected"
- Make sure Argent or Braavos extension is installed
- Click "Connect Wallet" before generating proof

### Contract Error: "ZK proof verification failed"
- Make sure you generated and registered the proof first
- Check that proof_hash and commitment match

---

## ✅ Success Criteria

You know it's working when:
- ✅ Backend generates real Groth16 proofs
- ✅ Frontend registers proofs on ActivityVerifier
- ✅ Loan application succeeds without "proof verification failed" error
- ✅ Lender can approve application
- ✅ STRK tokens transfer successfully

---

## 🎯 Quick Test (All Commands)

```powershell
# Terminal 1: Backend
cd C:\zk-affordability-loan\backend
npm start

# Terminal 2: Frontend
cd C:\zk-affordability-loan\frontend
npm run dev

# Terminal 3: Test proof generation
Invoke-WebRequest -Uri "http://localhost:3000/api/proof/generate" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"salary": 750, "threshold": 500}' | Select-Object -ExpandProperty Content
```

---

**Now run these commands and tell me the results!** 🚀
