# 🎉 COMPLETE DEPLOYMENT & TESTING GUIDE

## ✅ Frontend Error Fixed

**Issue**: `The requested module does not provide an export named 'default'`
**Fix**: Added default export to `starknetService.js` ✅

## 🚀 WSL Commands for Escrow Contract Deployment

### Quick Deploy (Automated):

```bash
# Make scripts executable
cd /mnt/c/zk-affordability-loan/contracts/starknet
chmod +x deploy_escrow_multi.sh test_escrow.sh

# Deploy contract
./deploy_escrow_multi.sh
```

### Manual Deploy (Step-by-Step):

#### 1. Build Contract
```bash
cd /mnt/c/zk-affordability-loan/contracts/starknet
scarb build
```

#### 2. Declare Contract
```bash
export STARKNET_RPC=https://starknet-sepolia.public.blastapi.io
export STARKNET_ACCOUNT=~/.starkli/accounts/deployer.json
export STARKNET_KEYSTORE=~/.starkli/keystore/deployer_key.json

starkli declare \
  target/dev/loan_escrow_multi_LoanEscrowMultiBorrower.contract_class.json \
  --rpc $STARKNET_RPC \
  --account $STARKNET_ACCOUNT \
  --keystore $STARKNET_KEYSTORE
```

**Save the class hash!**

#### 3. Deploy Contract
```bash
STRK_TOKEN=0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d

starkli deploy \
  <CLASS_HASH> \
  $STRK_TOKEN \
  --rpc $STARKNET_RPC \
  --account $STARKNET_ACCOUNT \
  --keystore $STARKNET_KEYSTORE
```

**Save the contract address!**

#### 4. Verify Deployment
```bash
starkli call <CONTRACT_ADDRESS> get_loan_count --rpc $STARKNET_RPC
```

Expected: `0x0` (zero loans)

## 🏦 Create a Loan (Lender Portal)

### Via WSL Commands:

#### 1. Approve STRK (100 STRK for 2 borrowers × 50 STRK)
```bash
CONTRACT=<YOUR_CONTRACT_ADDRESS>
STRK_TOKEN=0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d

# 100 STRK in Wei
starkli invoke \
  $STRK_TOKEN \
  approve \
  $CONTRACT \
  0x56bc75e2d63100000 0x0 \
  --rpc $STARKNET_RPC \
  --account $STARKNET_ACCOUNT \
  --keystore $STARKNET_KEYSTORE
```

#### 2. Create Multi-Borrower Loan
```bash
# Generate random commitment
COMMITMENT=0x$(openssl rand -hex 32)

starkli invoke \
  $CONTRACT \
  create_multi_loan \
  0x2b5e3af16b1880000 0x0 \
  2 \
  500 \
  600 \
  $COMMITMENT \
  --rpc $STARKNET_RPC \
  --account $STARKNET_ACCOUNT \
  --keystore $STARKNET_KEYSTORE
```

**Parameters:**
- `0x2b5e3af16b1880000 0x0` = 50 STRK (amount per borrower)
- `2` = max 2 borrowers
- `500` = 5% interest (500 basis points)
- `600` = 600 seconds repayment period
- `$COMMITMENT` = your ZK commitment hash

### Via Frontend (After Contract Deployed):

1. Visit: http://localhost:3001/loan-lender
2. Enter password: `12345678`
3. Connect wallet
4. Generate ZK proof
5. Click "Create New Loan"
6. Fill form:
   - Loan Amount: 50
   - Number of Borrowers: 2
   - Interest Rate: 5
   - Repayment Period: 600
7. Confirm transaction ✅

## 👥 Approve Borrower (Lender)

```bash
LOAN_ID=1
BORROWER_COMMITMENT=0xabc...123  # From application
BORROWER_ADDRESS=0x5b3cf...7ef    # Actual address

starkli invoke \
  $CONTRACT \
  approve_borrower \
  $LOAN_ID \
  $BORROWER_COMMITMENT \
  $BORROWER_ADDRESS \
  --rpc $STARKNET_RPC \
  --account $STARKNET_ACCOUNT \
  --keystore $STARKNET_KEYSTORE
```

**This transfers 50 STRK from escrow to borrower immediately!**

## 💸 Repay Loan (Borrower)

### 1. Approve Repayment (52.5 STRK)
```bash
LENDER_ADDRESS=0x...  # From loan details

starkli invoke \
  $STRK_TOKEN \
  approve \
  $LENDER_ADDRESS \
  0x2d79883d2000 0x0 \
  --rpc $STARKNET_RPC \
  --account $STARKNET_ACCOUNT \
  --keystore $STARKNET_KEYSTORE
```

### 2. Repay
```bash
starkli invoke \
  $CONTRACT \
  repay_loan \
  $LOAN_ID \
  $BORROWER_COMMITMENT \
  --rpc $STARKNET_RPC \
  --account $STARKNET_ACCOUNT \
  --keystore $STARKNET_KEYSTORE
```

## 🧪 Test the Contract

```bash
cd /mnt/c/zk-affordability-loan/contracts/starknet
./test_escrow.sh
```

This will:
1. Check loan count
2. Approve 100 STRK
3. Create a test loan
4. Verify loan was created

## 📊 Query Functions

### Get Loan Count
```bash
starkli call $CONTRACT get_loan_count --rpc $STARKNET_RPC
```

### Get Loan Details
```bash
starkli call $CONTRACT get_loan 1 --rpc $STARKNET_RPC
```

### Get Borrower Loan
```bash
starkli call $CONTRACT get_borrower_loan 1 $COMMITMENT --rpc $STARKNET_RPC
```

### Get Lender's Loans
```bash
starkli call $CONTRACT get_lender_loans $LENDER_ADDRESS --rpc $STARKNET_RPC
```

## 🔧 Update Environment Files

### After Deployment:

#### frontend/.env
```bash
VITE_STARKNET_LOAN_ESCROW_CONTRACT=<YOUR_CONTRACT_ADDRESS>
```

#### backend/.env
```bash
STARKNET_LOAN_ESCROW_CONTRACT=<YOUR_CONTRACT_ADDRESS>
```

## 📱 Full Testing Flow

### 1. Deploy Contract (WSL)
```bash
cd /mnt/c/zk-affordability-loan/contracts/starknet
./deploy_escrow_multi.sh
```

### 2. Update .env Files
```bash
# Copy contract address to both frontend and backend .env files
```

### 3. Restart Servers
```bash
# Backend
cd backend
npm start

# Frontend
cd frontend
npm run dev
```

### 4. Test as Lender
```
1. Visit: http://localhost:3001/loan-lender
2. Password: 12345678
3. Connect wallet
4. Generate ZK proof
5. Create loan (or use WSL commands)
```

### 5. Test as Borrower
```
1. Visit: http://localhost:3001/loan-borrower
2. Connect wallet (different account)
3. Generate ZK proof
4. Browse loans
5. Apply for loan
```

### 6. Approve Borrower (Lender)
```
1. View applications in lender dashboard
2. Click "Approve & Release Funds"
3. OR use WSL command above
```

### 7. Repay (Borrower)
```
1. See active loan in borrower dashboard
2. Click "Repay Now"
3. Approve 52.5 STRK transfer
4. Confirm repayment
```

## 🎯 Quick Reference

### STRK Amounts (Wei)
```
1 STRK   = 0x0de0b6b3a7640000 0x0
10 STRK  = 0x8ac7230489e80000 0x0
50 STRK  = 0x2b5e3af16b1880000 0x0
100 STRK = 0x56bc75e2d63100000 0x0
52.5 STRK = 0x2d79883d2000 0x0  (50 + 5%)
```

### Contract Addresses
```
STRK Token (Sepolia): 0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d
Activity Verifier:    0x071b94eb84b81868b61fb0ec1bbb59df47bb508583bc79325e5fa997ee3eb4be
Loan Escrow Multi:    <DEPLOY THIS>
```

### Account Setup
```
Account file:   ~/.starkli/accounts/deployer.json
Keystore file:  ~/.starkli/keystore/deployer_key.json
```

## 📚 Files Created

1. **`loan_escrow_multi.cairo`** - Multi-borrower escrow contract
2. **`deploy_escrow_multi.sh`** - Automated deployment script
3. **`test_escrow.sh`** - Contract testing script
4. **`WSL_DEPLOYMENT_GUIDE.md`** - Comprehensive guide
5. **`COMPLETE_GUIDE.md`** - This file

## ✅ Checklist

- [x] Frontend error fixed (default export)
- [x] Multi-borrower Cairo contract created
- [x] WSL deployment scripts created
- [x] Testing scripts created
- [ ] Deploy contract to StarkNet Sepolia
- [ ] Update .env files with contract address
- [ ] Test loan creation via WSL
- [ ] Test full flow via frontend
- [ ] Test borrower approval
- [ ] Test loan repayment
- [ ] Test default scenario

## 🚀 You're Ready!

Everything is set up. Just run:

```bash
wsl
cd /mnt/c/zk-affordability-loan/contracts/starknet
./deploy_escrow_multi.sh
```

Then follow the prompts! 🎉
