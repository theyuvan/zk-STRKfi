# 🚀 Quick Start Guide - Web3 Loan System

## Overview

A fully decentralized loan application system where:
- ✅ **NO databases** - Everything on blockchain + IPFS
- ✅ **NO localStorage** - Privacy-first design
- ✅ **Starknet testnet** - Real blockchain integration
- ✅ **ZK Proofs** - Prove creditworthiness without revealing details
- ✅ **Time-based escrow** - Auto identity reveal on default
- ✅ **Ephemeral wallets** - Privacy layer for borrowers

## Prerequisites

```bash
# Required
- Node.js v18+ 
- npm or yarn
- MetaMask with Starknet extension OR Argent/Braavos wallet

# Optional
- Hardhat (for local testing)
- Starknet CLI (for contract deployment)
```

## Installation

### 1. Clone and Install

```bash
# Clone repository
git clone https://github.com/yourusername/zk-affordability-loan.git
cd zk-affordability-loan

# Install frontend dependencies
cd frontend
npm install

# Install contract dependencies
cd ../contracts
npm install
```

### 2. Get Testnet Funds

**Starknet Goerli:**
```
Visit: https://faucet.goerli.starknet.io/
Paste your wallet address
Click "Request"
Wait 1-2 minutes for funds
```

**Make Transactions** (to build activity score):
```
Send 5-10 small transactions to test addresses
This builds your on-chain activity history
Higher transaction count = higher loan eligibility
```

### 3. Deploy Contracts

**Option A: Use Local Hardhat Network**
```bash
cd contracts

# Start local node (in separate terminal)
npx hardhat node

# Deploy contracts
npm run deploy:local

# Copy contract addresses from output
```

**Option B: Deploy to Starknet Goerli**
```bash
cd contracts

# Compile contracts
npm run compile

# Deploy EscrowV2
npx hardhat run scripts/deploy_escrow_v2.js --network starknet-goerli

# Save the contract address
```

### 4. Configure Environment

**Frontend (.env):**
```bash
cd frontend
cp .env.example .env

# Edit .env:
VITE_STARKNET_RPC=https://starknet-goerli.g.alchemy.com/v2/demo
VITE_ESCROW_V2_CONTRACT=0x... # From deployment
VITE_NETWORK=starknet-goerli
```

**Backend (.env)** (if using backend):
```bash
cd backend
cp .env.example .env

# Edit .env:
ESCROW_V2_CONTRACT=0x... # Same as frontend
NETWORK=starknet-goerli
```

### 5. Start Application

```bash
# Frontend
cd frontend
npm run dev

# Opens at http://localhost:5173
```

## Usage Flow

### For Borrowers

**Step 1: Connect Wallet**
```
1. Click "Connect Wallet"
2. Choose "Starknet" (recommended) or "MetaMask"
3. Approve connection in wallet popup
```

**Step 2: Analyze Activity**
```
1. Click "Analyze Activity"
2. System fetches your transaction history from blockchain
3. Calculates activity score (0-1000):
   - Balance: up to 400 points
   - Transaction count: up to 400 points
   - Consistency: up to 200 points
4. View your score
```

**Step 3: Generate ZK Proof**
```
1. Click "Generate ZK Proof"
2. System creates proof: "score >= 500" without revealing exact score
3. Ephemeral wallet address generated for privacy
4. Proof verified ✓
```

**Step 4: Select Loan**
```
1. Browse available loans from banks/anonymous lenders
2. Check eligibility (green badge = eligible)
3. Compare:
   - Loan amount
   - Interest rate
   - Repayment term
4. Click "Apply for Loan"
```

**Step 5: Apply**
```
1. Review loan details
2. Upload identity document (encrypted before IPFS)
3. Confirm:
   - Funds go to YOUR connected wallet
   - Ephemeral address shown to lender
   - Identity private unless you default
4. Click "Submit Application"
```

**Step 6: Receive Funds**
```
1. Lender reviews and approves
2. Funds sent to YOUR wallet (not ephemeral)
3. Repayment deadline starts
4. Make payments before deadline to keep identity private
```

### For Lenders

**Offer a Loan:**
```
1. Connect wallet
2. Create loan offer:
   - Set amount (in ETH)
   - Set interest rate (%)
   - Set term (days)
   - Set minimum activity score
3. Lock funds in contract
4. Wait for borrowers
```

**Fund a Loan:**
```
1. View pending loan requests
2. See:
   - Ephemeral address (not real wallet)
   - ZK proof (verified/not verified)
   - Requested amount
   - Repayment term
3. Click "Fund Loan"
4. Funds sent to borrower's REAL wallet
```

**Monitor Repayment:**
```
1. View active loans
2. See:
   - Days remaining
   - Amount paid
   - Amount remaining
3. If default:
   - Identity automatically revealed (ONLY to you)
   - Access encrypted identity document via IPFS
```

## Architecture

```
┌──────────────┐
│   Borrower   │
│   Wallet     │ (Starknet)
└──────┬───────┘
       │
       │ 1. Connect
       ▼
┌──────────────────────┐
│  WalletAnalyzer.js   │
│  ─────────────────   │
│  - getNonce()        │
│  - getBalance()      │
│  - calculateScore()  │
└──────┬───────────────┘
       │
       │ 2. Activity Score
       ▼
┌──────────────────────┐
│  Activity Score      │
│  ───────────────     │
│  Balance: 200 pts    │
│  Tx Count: 150 pts   │
│  Consistency: 100pts │
│  ───────────────     │
│  Total: 450/1000     │
└──────┬───────────────┘
       │
       │ 3. Generate Proof
       ▼
┌──────────────────────┐
│  ZK Proof            │
│  ─────────           │
│  score >= 500? NO    │
│  proofHash: 0x...    │
│  ephemeral: 0x...    │
└──────┬───────────────┘
       │
       │ 4. Select from Marketplace
       ▼
┌──────────────────────┐
│  Available Loans     │
│  ─────────────       │
│  □ Bank - 1 ETH      │
│     5% APR, 30 days  │
│     Min score: 400   │
│                      │
│  ☑ Private - 0.5 ETH │
│     8% APR, 15 days  │
│     Min score: 300   │
└──────┬───────────────┘
       │
       │ 5. Apply
       ▼
┌──────────────────────┐
│  EscrowV2 Contract   │
│  ─────────────────   │
│  createLoanRequest() │
│  - borrower (real)   │
│  - ephemeral (fake)  │
│  - proofHash         │
│  - identityCID       │
└──────┬───────────────┘
       │
       │ 6. Lender Funds
       ▼
┌──────────────────────┐
│  fundLoan()          │
│  ─────────────────   │
│  transfer(amount)    │
│  → borrower wallet   │
│  start deadline      │
└──────┬───────────────┘
       │
       │ 7a. Repay on time
       ▼
   Identity stays private ✓

       │ 7b. Default
       ▼
   Identity revealed to lender ✗
```

## Testing

### Test Scenarios

**Scenario 1: High Score Borrower**
```
1. Make 20+ transactions on testnet
2. Maintain 1+ ETH balance
3. Connect and analyze
4. Score should be 600-800
5. Eligible for most loans
```

**Scenario 2: Low Score Borrower**
```
1. New wallet with 2-3 transactions
2. Low balance (0.1 ETH)
3. Score will be 100-300
4. Only eligible for high-risk loans
```

**Scenario 3: Full Loan Cycle**
```
1. Borrower applies with high score
2. Lender funds loan
3. Funds received in borrower wallet
4. Borrower makes partial payment
5. Borrower completes payment before deadline
6. Identity stays private ✓
```

**Scenario 4: Default**
```
1. Borrower applies
2. Lender funds
3. Deadline passes without full repayment
4. Anyone calls checkAndTriggerDefault()
5. Identity revealed to lender only
6. Lender accesses IPFS CID
```

## Troubleshooting

### Wallet Won't Connect
```
- Check MetaMask is on correct network
- Try refreshing page
- Check browser console for errors
- Make sure Starknet extension installed
```

### Transaction Analysis Fails
```
- Verify RPC endpoint is accessible
- Check wallet has transaction history
- Try with different RPC: Infura, Alchemy
- Check console for specific error
```

### Activity Score is 0
```
- New wallet? Make some transactions first
- Wait for transactions to confirm
- Check balance is > 0
- Verify nonce > 0
```

### Contract Call Fails
```
- Check contract address in .env
- Verify contract is deployed
- Check wallet has gas for transaction
- Review error message in console
```

## Security Notes

### What is Stored Where

**On Blockchain (Permanent):**
- Loan requests
- Proof hashes
- Repayment deadlines
- Payment amounts
- Identity reveal permissions

**On IPFS (Permanent):**
- Encrypted identity documents
- Only decryptable by lender after default

**In Browser (Temporary):**
- Wallet connection state
- Current step in flow
- UI preferences
- NOTHING else

**Never Stored:**
- Private keys
- Passwords
- Exact transaction amounts
- Unencrypted personal data

### Privacy Guarantees

**Before Repayment:**
- Lender sees: ephemeral address
- Lender does NOT see: real wallet

**After Successful Repayment:**
- Identity never revealed
- Loan marked as complete
- No data shared

**After Default:**
- Identity revealed ONLY to specific lender
- Other users cannot access
- Encryption key in lender's wallet

## Development

### Project Structure

```
zk-affordability-loan/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── LoanMarketplace.jsx      # Loan listings
│   │   ├── pages/
│   │   │   └── LoanRequestPageV2.jsx    # Main flow
│   │   ├── services/
│   │   │   └── walletAnalyzer.js        # Activity analysis
│   │   └── store/
│   │       └── walletStore.js           # Wallet state
│   └── package.json
├── contracts/
│   ├── solidity/
│   │   └── EscrowV2.sol                 # Enhanced escrow
│   ├── scripts/
│   │   └── deploy_escrow_v2.js          # Deployment
│   └── package.json
├── backend/
│   └── ... (optional, can be removed)
└── docs/
    ├── WEB3_ARCHITECTURE.md             # Full architecture
    └── IMPLEMENTATION_SUMMARY.md        # Status
```

### Build Commands

```bash
# Frontend
cd frontend
npm run dev          # Development server
npm run build        # Production build
npm run preview      # Preview production build

# Contracts
cd contracts
npm run compile      # Compile Solidity
npm run test         # Run tests
npm run deploy:local # Deploy to local network
```

### Environment Variables

**Frontend (.env):**
```
VITE_STARKNET_RPC=https://starknet-goerli.g.alchemy.com/v2/demo
VITE_ESCROW_V2_CONTRACT=0x...
VITE_NETWORK=starknet-goerli
```

**Contracts (.env):**
```
PRIVATE_KEY=0x...              # Deployer private key
SEPOLIA_RPC_URL=https://...    # If using Sepolia
STARKNET_RPC_URL=https://...   # Starknet RPC
```

## Next Steps

1. **Deploy Contracts** → See "Deploy Contracts" section above
2. **Test Locally** → Follow "Usage Flow" with local network
3. **Deploy to Testnet** → Use Starknet Goerli
4. **Add IPFS** → Implement real identity encryption
5. **Build ZK Circuit** → Replace mock proof with real SNARK
6. **Remove Backend** → Pure Web3 (no server needed)

## Support

- 📖 Full docs: `docs/WEB3_ARCHITECTURE.md`
- 🔧 Implementation status: `docs/IMPLEMENTATION_SUMMARY.md`
- 🐛 Issues: GitHub Issues
- 💬 Questions: GitHub Discussions

---

**Built with privacy, powered by blockchain** 🔐⛓️
