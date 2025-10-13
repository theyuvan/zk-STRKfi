# 🎯 COMMANDS TO RUN NOW

## 📋 Copy & Paste These Commands

### Step 1: Check if you have the tools

```powershell
# Check Circom
circom --version

# Check SnarkJS  
snarkjs --version
```

**If missing, install:**
```powershell
# Install SnarkJS
npm install -g snarkjs

# For Circom, download from:
# https://github.com/iden3/circom/releases/latest
# Get: circom-windows-amd64.exe
# Rename to: circom.exe
# Add to PATH
```

---

### Step 2: Build the ZK Circuit (ONE COMMAND)

```powershell
cd C:\zk-affordability-loan
.\scripts\build_circuit.ps1
```

**This will:**
- ✅ Compile circuit (1 min)
- ✅ Powers of Tau ceremony (3 min)
- ✅ Generate proving/verification keys (1 min)
- ✅ Copy files to backend
- ⏱️ **Total: 5 minutes**

**When prompted for "entropy", just type random characters and press Enter**

---

### Step 3: Test the Circuit

```powershell
.\scripts\test_circuit.ps1
```

**Expected output:**
```
✅ ZK Circuit Test Passed!

The circuit successfully proved that:
   • Activity score (750) >= Threshold (500)
   • Without revealing the exact score!
```

---

## ✅ That's It!

After these 2 commands:
1. ✅ Your ZK circuit is built
2. ✅ Proving/verification keys are generated
3. ✅ Files are copied to backend
4. ✅ Circuit is tested and working

---

## 🔜 What Happens Next?

After the circuit is built, you need to choose how to verify proofs:

### Option A: Off-Chain Verification (Quick & Easy)
- Backend verifies proofs using snarkjs
- Posts commitment hash to StarkNet
- ⚠️ Requires trusting the backend

### Option B: STARK-Native (Fully On-Chain) ⭐ RECOMMENDED
- Rewrite verifier in Cairo
- Use Poseidon hash (StarkNet native)
- ✅ Fully trustless on-chain verification

### Option C: L1 Bridge (Complex)
- Deploy Groth16 verifier to Ethereum L1
- Bridge verification result to StarkNet
- 🌉 Requires L1/L2 messaging

---

## 📊 Current Status

| Task | Status |
|------|--------|
| Install Circom | ⏳ TODO |
| Install SnarkJS | ⏳ TODO |
| Build circuit | ⏳ TODO - Run `.\scripts\build_circuit.ps1` |
| Test circuit | ⏳ TODO - Run `.\scripts\test_circuit.ps1` |
| Update backend | ⏳ TODO - After circuit is built |
| Deploy verifier | ⏳ TODO - Choose approach |

---

## 🚀 START HERE:

```powershell
# 1. Check tools
circom --version
snarkjs --version

# 2. If tools are installed, run:
cd C:\zk-affordability-loan
.\scripts\build_circuit.ps1
```

**Run these commands now and tell me what happens!** 🎯
