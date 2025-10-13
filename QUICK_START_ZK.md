# 🚀 Complete ZK Setup - Quick Start Guide

## 📋 What This Does

Builds a **REAL** zero-knowledge proof system that:
- ✅ Generates cryptographic Groth16 proofs
- ✅ Proves activity_score >= threshold
- ✅ Keeps actual score private
- ⚠️ **Note**: Full on-chain verification requires STARK-native approach (see below)

---

## ⚡ Quick Start (5 Commands)

### 1️⃣ Install Prerequisites

```powershell
# Install SnarkJS
npm install -g snarkjs

# Install Circom (download from GitHub)
# Visit: https://github.com/iden3/circom/releases
# Download: circom-windows-amd64.exe
# Rename to circom.exe and add to PATH
```

**Verify:**
```powershell
circom --version  # Should show: circom compiler 2.1.x
snarkjs --version # Should show: snarkjs@0.7.x
```

---

### 2️⃣ Build the Circuit

```powershell
# Run the automated build script
cd C:\zk-affordability-loan
.\scripts\build_circuit.ps1
```

**What this does:**
- ✅ Compiles `activityVerifier.circom` to constraint system
- ✅ Generates proving/verification keys (trusted setup)
- ✅ Exports verification key
- ✅ Copies files to backend (`backend/src/zk/`)

**⏱️ Time: 3-5 minutes**

---

### 3️⃣ Test the Circuit

```powershell
# Test with sample data
.\scripts\test_circuit.ps1
```

**Expected Output:**
```
🧪 Testing ZK Circuit...
✅ Test input created
✅ Witness generated
✅ Proof generated
✅ Proof verification PASSED!

The circuit successfully proved that:
   • Activity score (750) >= Threshold (500)
   • Without revealing the exact score!
```

---

### 4️⃣ Update Backend to Use Real ZK

The backend currently generates mock proofs. Update it to use real Groth16:

```powershell
# I'll create the updated backend code for you
# (see BACKEND_ZK_UPDATE.md)
```

---

### 5️⃣ Choose Verification Approach

Since StarkNet doesn't natively support Groth16 verification, choose one:

#### **Option A: Off-Chain Verification (Quick)** ⚡
```
✅ Generate proof on frontend
✅ Verify proof on backend
✅ Backend posts commitment to StarkNet
⚠️ Requires trusting backend
```

#### **Option B: STARK-Native Verification (Recommended)** ⭐
```
✅ Use Poseidon hash (StarkNet native)
✅ Verify constraints in Cairo
✅ Fully on-chain and trustless
❌ Need to rewrite circuit for STARK
```

#### **Option C: L1 Bridge Verification (Complex)** 🌉
```
✅ Deploy Groth16 verifier to Ethereum L1
✅ Verify proofs on L1
✅ Bridge result to StarkNet via messaging
❌ Complex infrastructure
```

---

## 📁 Files Generated

After running `build_circuit.ps1`, you'll have:

```
contracts/zk/build/
├── activityVerifier.r1cs           # Constraint system
├── activityVerifier_js/
│   └── activityVerifier.wasm       # Witness generator
├── activityVerifier_final.zkey     # Proving key
├── verification_key.json           # Verification key
└── pot12_final.ptau                # Powers of Tau

backend/src/zk/                     # Copied here ✅
├── activityVerifier.wasm
├── activityVerifier_final.zkey
└── verification_key.json
```

---

## 🔧 Manual Build Commands

If you prefer to run commands manually:

```powershell
# 1. Navigate to ZK directory
cd C:\zk-affordability-loan\contracts\zk

# 2. Compile circuit
New-Item -ItemType Directory -Force -Path "build"
circom activityVerifier.circom --r1cs --wasm --sym -o build

# 3. Powers of Tau
cd build
snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="First" -v
# Type random characters when prompted for entropy
snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v

# 4. Generate keys
snarkjs groth16 setup activityVerifier.r1cs pot12_final.ptau activityVerifier_0000.zkey
snarkjs zkey contribute activityVerifier_0000.zkey activityVerifier_final.zkey --name="Contribution" -v
# Type random characters when prompted
snarkjs zkey export verificationkey activityVerifier_final.zkey verification_key.json

# 5. Copy to backend
New-Item -ItemType Directory -Force -Path "..\..\backend\src\zk"
Copy-Item "activityVerifier_js\activityVerifier.wasm" -Destination "..\..\backend\src\zk\"
Copy-Item "activityVerifier_final.zkey" -Destination "..\..\backend\src\zk\"
Copy-Item "verification_key.json" -Destination "..\..\backend\src\zk\"
```

---

## 🧪 Manual Test Commands

```powershell
cd C:\zk-affordability-loan\contracts\zk\build

# Create test input
@"
{
  "activity_score": "750",
  "wallet_address": "123456789012345678901234567890",
  "salt": "999999888888777777",
  "threshold": "500"
}
"@ | Out-File -Encoding utf8 test_input.json

# Generate witness
node activityVerifier_js\generate_witness.js activityVerifier_js\activityVerifier.wasm test_input.json witness.wtns

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

## 🎯 Next Steps

### Step 1: Build the Circuit ✅
```powershell
.\scripts\build_circuit.ps1
```

### Step 2: Test It ✅
```powershell
.\scripts\test_circuit.ps1
```

### Step 3: Choose Your Approach

**Tell me which you want:**

1. **"Off-chain verification"** - Fast, backend verifies proofs
2. **"STARK-native"** - I'll create a Cairo verifier (fully on-chain)
3. **"L1 bridge"** - Deploy to Ethereum L1, bridge results

---

## ❓ Troubleshooting

### Error: "circom: command not found"
```powershell
# Download from: https://github.com/iden3/circom/releases
# Get: circom-windows-amd64.exe
# Rename to circom.exe
# Add directory to PATH
```

### Error: "snarkjs: command not found"
```powershell
npm install -g snarkjs
```

### Error: "Node.js not found"
```powershell
# Install Node.js 18+
# Visit: https://nodejs.org/
```

### Build takes too long
```
Normal! Powers of Tau takes 2-5 minutes.
Just wait for it to complete.
```

---

## 📊 Summary

| Step | Command | Time | Status |
|------|---------|------|--------|
| Install tools | `npm install -g snarkjs` | 1 min | ⏳ TODO |
| Build circuit | `.\scripts\build_circuit.ps1` | 5 min | ⏳ TODO |
| Test circuit | `.\scripts\test_circuit.ps1` | 1 min | ⏳ TODO |
| Update backend | See BACKEND_ZK_UPDATE.md | 10 min | ⏳ TODO |
| Deploy verifier | Choose approach above | TBD | ⏳ TODO |

---

## 🚀 Ready?

Run these commands now:

```powershell
# Check prerequisites
circom --version
snarkjs --version

# Build circuit
cd C:\zk-affordability-loan
.\scripts\build_circuit.ps1

# Test circuit
.\scripts\test_circuit.ps1
```

**Let me know when you've completed these steps!** 🎉
