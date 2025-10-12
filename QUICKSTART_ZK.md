# Quick Start: Build ZK Circuit

## TL;DR - Get Running in 5 Minutes

### Prerequisites
```powershell
# 1. Install circom (one-time)
# Download from: https://github.com/iden3/circom/releases
# Windows: circom-windows-amd64.exe
# Extract and add to PATH

# 2. Verify installation
circom --version    # Should show v2.x.x
node --version      # Should show v18.x or higher
```

### Build Circuit
```powershell
# From project root
cd scripts
.\build_zk_circuit.ps1
```

**Expected output:**
```
🔧 ZK Circuit Build Script
==========================
✅ Prerequisites satisfied
🔨 Step 1/5: Compiling circuit...
✅ Circuit compiled
🎲 Step 2/5: Running Powers of Tau ceremony...
✅ Powers of Tau ceremony complete
🔑 Step 3/5: Generating proving key...
✅ Initial .zkey generated
🎯 Step 4/5: Contributing to circuit-specific setup...
✅ Final .zkey generated
🔓 Step 5/5: Exporting verification key...
✅ Verification key exported
🧪 Running verification test...
✅ Proof verified successfully!
🎉 Build is working correctly!
```

**Time:** 1-2 minutes

### Test Full System
```powershell
# Terminal 1 - Backend
cd backend
npm start

# Terminal 2 - Frontend
cd frontend
npm run dev
```

**Test in browser:**
1. Open http://localhost:3001
2. Connect wallet
3. Click "Analyze Wallet Activity" → See score: 65
4. Click "Prepare Proof" → Threshold: 50
5. Click "Generate Proof" → **REAL ZK PROOF** ✅

---

## What Changed

### Before (Mock Version)
```javascript
// zkService.js had fallback
if (circuit files missing) {
  return mockProof();  // ❌ Silent fallback
}
```

### Now (Original Version)
```javascript
// zkService.js throws error
if (circuit files missing) {
  throw new Error();  // ✅ Proper error
}
```

**Result:** You'll know immediately if circuit isn't built.

---

## Files Created

| File | Purpose |
|------|---------|
| `ZK_CIRCUIT_IMPLEMENTATION.md` | Full guide with theory & troubleshooting |
| `ZKSERVICE_RESTORED.md` | Summary of changes made |
| `scripts/build_zk_circuit.ps1` | Automated build (Windows) |
| `scripts/build_zk_circuit.sh` | Automated build (Linux/Mac) |
| `QUICKSTART_ZK.md` | This file |

---

## Troubleshooting

### "circom: command not found"
**Fix:** Install circom and add to PATH
- Download: https://github.com/iden3/circom/releases
- Windows: Extract and add folder to System PATH
- Restart terminal

### Build script fails
**Fix:** Run manually:
```powershell
cd contracts/zk/build

# Compile
circom ..\activityVerifier.circom --r1cs --wasm --sym -o .

# Setup
snarkjs powersoftau new bn128 12 pot12_0000.ptau
snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="test"
snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau
snarkjs groth16 setup activityVerifier.r1cs pot12_final.ptau activityVerifier_0000.zkey
snarkjs zkey contribute activityVerifier_0000.zkey activityVerifier.zkey --name="test"
snarkjs zkey export verificationkey activityVerifier.zkey verification_key.json

# Move wasm
copy activityVerifier_js\activityVerifier.wasm .
```

### "Proof generation failed"
**Possible causes:**
1. Circuit files not built → Run build script
2. Input format wrong → Check logs for details
3. Circuit expects wallet_address → See implementation guide

---

## What's Next?

### For Testing
✅ You're ready! Circuit is built, just test the flow.

### For Production
Read `ZK_CIRCUIT_IMPLEMENTATION.md` sections:
- **Security** - Multi-party ceremony
- **Performance** - Optimize constraints
- **Scaling** - Batch verification

---

## Need More Info?

| Topic | File |
|-------|------|
| Complete implementation | `ZK_CIRCUIT_IMPLEMENTATION.md` |
| What was changed | `ZKSERVICE_RESTORED.md` |
| Circuit design | `contracts/zk/activityVerifier.circom` |
| Build automation | `scripts/build_zk_circuit.ps1` |

---

## Commands Cheat Sheet

```powershell
# Build circuit (one-time)
cd scripts; .\build_zk_circuit.ps1

# Start backend
cd backend; npm start

# Start frontend
cd frontend; npm run dev

# Test circuit only
cd contracts/zk; node test-build.js

# Clean build (start over)
rm -r contracts/zk/build; cd scripts; .\build_zk_circuit.ps1
```

---

**Status:** ✅ zkService.js restored (original, no mocks)  
**Next:** Build circuit using the script above  
**Then:** Test full loan request flow with real ZK proofs  

🚀 **Let's implement some proper zero-knowledge proofs!**
