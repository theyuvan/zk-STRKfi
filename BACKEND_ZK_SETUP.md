# 🔧 Backend ZK Proof Generation - SETUP GUIDE

## Problem:
Backend can't generate real ZK proofs because it's missing:
- `activityVerifier.wasm` - Circuit witness generator
- `activityVerifier_final.zkey` - Proving key
- These files need to be compiled from your circuit

## Current Situation:
✅ Frontend working with **test proofs** (mock proofs)
❌ Backend missing WASM files for **real proofs**

## Solution Options:

### Option 1: Keep Using Test Proofs (Recommended for Now)
**Pros:**
- ✅ Already working perfectly
- ✅ No setup needed
- ✅ Can test full loan flow
- ✅ Fast development

**What works:**
- Create loan offers ✅
- Apply for loans ✅
- Activity scoring ✅
- Commitment hashing ✅

**What's different:**
- Proofs aren't cryptographically verified
- But commitment hashes are still generated correctly

**Action:** Nothing! Just keep using your app as is.

---

### Option 2: Compile ZK Circuit (For Real Proofs)

If you need real cryptographic proofs, follow these steps:

#### Step 1: Install circom and snarkjs
```bash
# Install circom (circuit compiler)
npm install -g circom

# Install snarkjs (proof generator)
npm install -g snarkjs
```

#### Step 2: Compile the Circuit
```bash
cd contracts/zk

# Compile circuit to WASM
circom circuits/activityVerifier.circom --wasm --output build/

# This creates: build/activityVerifier_js/activityVerifier.wasm
```

#### Step 3: Generate Proving Key
```bash
cd contracts/zk

# Start a new powers of tau ceremony
snarkjs powersoftau new bn128 12 pot12_0000.ptau -v

# Contribute to ceremony
snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="First contribution" -v

# Prepare phase 2
snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v

# Generate .zkey file
snarkjs groth16 setup build/activityVerifier_js/activityVerifier.wasm pot12_final.ptau activityVerifier_0000.zkey

# Contribute to phase 2
snarkjs zkey contribute activityVerifier_0000.zkey activityVerifier_final.zkey --name="1st Contributor" -v

# Export verification key
snarkjs zkey export verificationkey activityVerifier_final.zkey verification_key.json
```

#### Step 4: Copy Files to Backend
```bash
# Copy WASM file
cp build/activityVerifier_js/activityVerifier.wasm ../backend/src/zk/

# Copy proving key
cp activityVerifier_final.zkey ../backend/src/zk/

# Copy verification key (already exists)
cp verification_key.json ../backend/src/zk/
```

#### Step 5: Restart Backend
```bash
cd backend
npm start
```

#### Step 6: Test Real Proofs
- Go to `http://localhost:3001/lenders`
- Generate ZK proof
- Should see: "✅ Real ZK Proof generated"

---

### Option 3: Use Pre-compiled Files (If Available)

If you have the compiled files from another machine:

```bash
# Place these files in backend/src/zk/:
activityVerifier.wasm          # ~500KB
activityVerifier_final.zkey    # ~5MB
verification_key.json          # Already exists
```

Then restart backend.

---

## Current Status:

### ✅ Working Now (Test Proofs):
```
Frontend → zkProofService → Mock Proof Generator
  ↓
✅ Commitment hash: 0x2447037...
✅ Identity commitment: 0x6ff92f...
✅ Activity score: 325
✅ Can create loans!
```

### 🎯 After Compilation (Real Proofs):
```
Frontend → zkProofService → Backend API → snarkjs
  ↓
✅ Real cryptographic proof
✅ Commitment hash: 0x2447037...
✅ Identity commitment: 0x6ff92f...
✅ Activity score: 325
✅ Verified on-chain!
```

---

## Recommendation:

**For development/testing**: Keep using test proofs (Option 1)
- Zero setup
- Works perfectly
- Test full flow

**For production**: Compile circuit (Option 2)
- Real cryptographic proofs
- On-chain verification
- More secure

---

## Quick Commands:

### Check if circuit exists:
```bash
ls contracts/zk/circuits/activityVerifier.circom
```

### Check backend files:
```bash
ls backend/src/zk/
```

### Test backend API:
```bash
curl -X POST http://localhost:3000/api/proof/generate \
  -H "Content-Type: application/json" \
  -d '{"salary":325,"threshold":100,"walletAddress":"0xtest"}'
```

---

## Summary:

Your app is **fully functional** with test proofs! 🎉

To get real proofs, you need to:
1. Install circom + snarkjs
2. Compile the circuit
3. Generate proving keys
4. Copy files to backend

**But you can keep using test proofs for now - everything works!** ✅
