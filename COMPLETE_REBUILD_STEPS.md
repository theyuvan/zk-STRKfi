# 🔄 Complete Re-Setup After Circuit Changes

## What You Need To Do

Since you changed the circom circuit, you need to:
1. ✅ Rebuild the circuit
2. ✅ Restart backend (to load new circuit files)
3. ⚠️ **NO need to redeploy Cairo contract** (it doesn't do actual ZK verification)

The ActivityVerifier contract on StarkNet is just a **registry** - it stores proof hashes and activity scores. It doesn't verify the actual cryptographic proof on-chain. The real verification happens in the backend using snarkjs.

---

## 📋 Step-by-Step Commands

### Step 1: Rebuild Circuit (PowerShell)

```powershell
cd C:\zk-affordability-loan
.\scripts\build_circuit.ps1
```

**Wait for:**
```
[SUCCESS] ZK Circuit Build Completed!

Generated files:
   * activityVerifier.r1cs (constraint system)
   * activityVerifier.wasm (witness generator)
   * activityVerifier_final.zkey (proving key)
   * verification_key.json (verification key)

Files copied to: C:\zk-affordability-loan\backend\src\zk
```

---

### Step 2: Test Circuit (PowerShell)

```powershell
.\scripts\test_circuit.ps1
```

**Expected:**
```
[SUCCESS] ZK Circuit Test Passed!

The circuit successfully proved that:
   * Activity score (750) >= Threshold (500)
   * Without revealing the exact score!
```

---

### Step 3: Restart Backend (PowerShell)

```powershell
# Stop current backend (Ctrl+C in backend terminal)

# Start fresh
cd C:\zk-affordability-loan\backend
npm start
```

**Expected:**
```
Server running on http://localhost:3000
ZK Service initialized
```

---

### Step 4: Test Backend Proof Generation (PowerShell)

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/proof/generate" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"salary": 750, "threshold": 500, "walletAddress": "123456789012345678901234567890"}' `
  | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

**Expected:**
```json
{
  "message": "Proof generated successfully",
  "proof": {...},
  "publicSignals": [...],
  "commitment": "0x...",
  "proofHash": "0x...",
  "activityScore": 750
}
```

---

### Step 5: Restart Frontend (PowerShell)

```powershell
# Stop current frontend (Ctrl+C in frontend terminal)

# Start fresh
cd C:\zk-affordability-loan\frontend
npm run dev
```

---

### Step 6: Test Complete Flow (Browser)

1. Open http://localhost:3001
2. Connect wallet
3. Go to Borrower page
4. Click "Generate ZK Proof"
5. **This time, the wallet popup should work properly**

---

## 🐧 Alternative: Using WSL Bash

If PowerShell scripts have issues, you can use WSL:

### Step 1: Navigate to Project (WSL)

```bash
cd /mnt/c/zk-affordability-loan
```

### Step 2: Rebuild Circuit (WSL)

```bash
cd contracts/zk

# Compile circuit
circom activityVerifier.circom --r1cs --wasm --sym -o build

cd build

# Powers of Tau (if not already done)
if [ ! -f pot12_final.ptau ]; then
    snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
    echo "random entropy" | snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="First" -v
    snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v
fi

# Generate keys
snarkjs groth16 setup activityVerifier.r1cs pot12_final.ptau activityVerifier_0000.zkey
echo "more entropy" | snarkjs zkey contribute activityVerifier_0000.zkey activityVerifier_final.zkey --name="Contribution" -v
snarkjs zkey export verificationkey activityVerifier_final.zkey verification_key.json

# Copy to backend
mkdir -p ../../../backend/src/zk
cp activityVerifier_js/activityVerifier.wasm ../../../backend/src/zk/
cp activityVerifier_final.zkey ../../../backend/src/zk/
cp verification_key.json ../../../backend/src/zk/

echo "✅ Circuit built successfully!"
```

### Step 3: Test Circuit (WSL)

```bash
cd /mnt/c/zk-affordability-loan/contracts/zk/build

# Create test input
cat > test_input.json << EOF
{
  "activity_score": "750",
  "wallet_address": "123456789012345678901234567890",
  "salt": "999999888888777777",
  "threshold": "500"
}
EOF

# Generate witness
node activityVerifier_js/generate_witness.js activityVerifier_js/activityVerifier.wasm test_input.json witness.wtns

# Generate proof
snarkjs groth16 prove activityVerifier_final.zkey witness.wtns proof.json public.json

# Verify proof
snarkjs groth16 verify verification_key.json public.json proof.json
```

**Expected:**
```
[INFO]  snarkJS: OK!
```

---

## 🔍 About the Wallet Issue

The wallet not showing the "Confirm" button might be due to:

1. **Network issues** - Try switching networks in wallet and back
2. **Wallet cache** - Try disconnecting and reconnecting wallet
3. **Transaction simulation failure** - This is okay, you can still submit

### To Fix Wallet Issues:

1. **Disconnect wallet** from the app
2. **Refresh browser** (Ctrl+F5)
3. **Connect wallet** again
4. **Try proof generation** again

---

## ✅ Checklist

- [ ] Run `.\scripts\build_circuit.ps1` or WSL commands
- [ ] See "Circuit build completed" message
- [ ] Run `.\scripts\test_circuit.ps1` and see "Test Passed"
- [ ] Restart backend (Ctrl+C, then `npm start`)
- [ ] Test backend API with Invoke-WebRequest
- [ ] Restart frontend
- [ ] Disconnect and reconnect wallet
- [ ] Try generating proof again

---

## 🎯 Quick Commands (Copy-Paste)

```powershell
# Terminal 1: Rebuild circuit
cd C:\zk-affordability-loan
.\scripts\build_circuit.ps1
.\scripts\test_circuit.ps1

# Terminal 2: Backend
cd C:\zk-affordability-loan\backend
npm start

# Terminal 3: Frontend  
cd C:\zk-affordability-loan\frontend
npm run dev

# Terminal 4: Test API
Invoke-WebRequest -Uri "http://localhost:3000/api/proof/generate" -Method POST -Headers @{"Content-Type"="application/json"} -Body '{"salary": 750, "threshold": 500, "walletAddress": "123456789012345678901234567890"}' | Select-Object -ExpandProperty Content
```

---

**Run these commands now and tell me the results!** 🚀
