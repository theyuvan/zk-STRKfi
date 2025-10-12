# Complete Implementation Plan - ZK Loan Platform
**Date:** October 12, 2025  
**Goal:** Full working flow with real StarkNet integration (no mocks except loan provider list)

---

## User Flow Overview

```
1. Connect Wallet (StarkNet Sepolia)
   ↓
2. Fetch STRK Token Balance + Transaction History
   ↓
3. Generate ZK Proof (with transaction points)
   ↓ (proof cached per wallet, updates dynamically)
4. Browse Available Loans (1 mock loan with threshold)
   ↓
5. Select Loan → Verify ZK Proof vs Threshold
   ↓
6. If approved: STRK tokens transferred to user
   ↓
7. 10-minute payment timer starts
   ↓
8. If user pays: Loan closed ✅
   If timeout: Reveal identity to lender ❌
```

---

## Technical Architecture

### 1. **Wallet Connection & Token Fetching**

**Technology:** StarkNet.js + RPC Provider

```javascript
// Components:
- WalletConnect.jsx (connect wallet)
- TokenFetcher.jsx (fetch STRK balance + tx history)

// StarkNet Sepolia STRK Token:
const STRK_TOKEN_ADDRESS = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';

// Data to fetch:
1. STRK balance (balanceOf call)
2. Transaction history (RPC: starknet_getEvents)
3. Transfer events (Transfer events from STRK contract)
```

**API Endpoints:**
- StarkNet Sepolia RPC: `https://starknet-sepolia.public.blastapi.io`
- Alternative: `https://free-rpc.nethermind.io/sepolia-juno`

---

### 2. **Transaction Points Calculation**

**Algorithm:**

```javascript
// Calculate activity score from transaction history
function calculateActivityScore(txHistory, balance) {
  const points = {
    // Balance Score (max 300 points)
    balanceScore: Math.min((balance / 100) * 100, 300),
    
    // Transaction Count Score (max 400 points)
    txCountScore: Math.min(txHistory.length * 5, 400),
    
    // Transaction Volume Score (max 300 points)
    volumeScore: calculateVolumeScore(txHistory),
    
    // Total (max 1000 points)
    total: 0
  };
  
  points.total = Math.min(
    points.balanceScore + points.txCountScore + points.volumeScore,
    1000
  );
  
  return points;
}
```

**Transaction History Structure:**

```javascript
{
  txHash: "0x...",
  timestamp: 1728734521,
  from: "0x...",
  to: "0x...",
  amount: "1000000000000000000", // in wei
  type: "transfer" | "receive"
}
```

---

### 3. **ZK Proof Generation & Caching**

**Circuit Inputs:**

```circom
// Modified circuit to include transaction data
template ActivityVerifier() {
    // Public inputs
    signal input threshold;
    signal output commitment;
    
    // Private inputs
    signal input activity_score;      // Total points (0-1000)
    signal input wallet_address;
    signal input tx_count;            // Number of transactions
    signal input total_volume;        // Total transaction volume
    signal input salt;
    
    // Public output
    signal output isAboveThreshold;
    signal output score_hash;         // Hash of score components
    
    // Constraints...
}
```

**Proof Caching Strategy:**

```javascript
// Store proof in localStorage with wallet address as key
const proofCache = {
  [walletAddress]: {
    proof: {...},
    publicSignals: [...],
    activityScore: 750,
    txCount: 150,
    timestamp: Date.now(),
    lastTxHash: "0x...", // To detect new transactions
    expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  }
};

// Update logic:
async function getOrUpdateProof(walletAddress) {
  const cached = proofCache[walletAddress];
  const latestTx = await fetchLatestTransaction(walletAddress);
  
  // Regenerate if:
  // 1. No cached proof
  // 2. New transaction detected
  // 3. Proof expired
  if (!cached || 
      cached.lastTxHash !== latestTx.hash || 
      cached.expiresAt < Date.now()) {
    return await generateNewProof(walletAddress);
  }
  
  return cached;
}
```

---

### 4. **Loan Provider (Mock Data)**

**Single Loan Provider:**

```javascript
const LOAN_PROVIDER = {
  id: 1,
  providerAddress: "0x1234567890abcdef...", // StarkNet address
  name: "DeFi Lender Alpha",
  
  // Loan terms
  loanAmount: "50000000000000000000", // 50 STRK
  interestRate: 5, // 5%
  thresholdScore: 500, // Minimum activity score required
  
  // Repayment
  repaymentPeriod: 600, // 10 minutes (600 seconds)
  repaymentAmount: "52500000000000000000", // 52.5 STRK (with interest)
  
  // Contract addresses
  loanContractAddress: "0xLOAN_CONTRACT_ADDRESS",
  
  // Status
  availableFunds: "1000000000000000000000", // 1000 STRK
  activeLoanCount: 0,
  maxActiveLoans: 10
};
```

---

### 5. **Smart Contract Integration**

**Required Contracts:**

**A. Loan Escrow Contract (Cairo)**

```cairo
// contracts/starknet/loan_escrow_v2.cairo

@contract_interface
namespace ILoanEscrow {
    func create_loan_request(
        borrower: felt,
        amount: Uint256,
        threshold: felt,
        proof_hash: felt,
        commitment: felt
    ) {
    }
    
    func approve_loan(loan_id: felt) {
    }
    
    func repay_loan(loan_id: felt, amount: Uint256) {
    }
    
    func claim_defaulted_loan(loan_id: felt) {
    }
}

@storage_var
func loan_details(loan_id: felt) -> (
    borrower: felt,
    lender: felt,
    amount: Uint256,
    deadline: felt,
    status: felt  // 0=pending, 1=active, 2=repaid, 3=defaulted
) {
}

@storage_var
func loan_proofs(loan_id: felt) -> (
    commitment: felt,
    proof_hash: felt,
    threshold: felt
) {
}
```

**B. Identity Reveal Contract**

```cairo
// contracts/starknet/identity_reveal_v2.cairo

@storage_var
func identity_commitment(loan_id: felt) -> (
    encrypted_identity: felt,
    shares_required: felt
) {
}

@external
func reveal_identity_on_default(loan_id: felt) {
    // Only callable after loan default
    // Returns encrypted identity data
}
```

---

### 6. **Payment & Default Flow**

**Timeline:**

```javascript
// After loan approval:
const loanTimeline = {
  t0: "Loan approved, STRK transferred to borrower",
  t0_to_t10: "10-minute countdown",
  t10: "Deadline reached",
  
  // If paid before t10:
  success: "Loan marked as repaid, identity protected",
  
  // If not paid by t10:
  default: "Identity revealed to lender"
};
```

**Default Handler:**

```javascript
// backend/src/services/loanMonitor.js

class LoanMonitor {
  async startLoanTimer(loanId, borrowerAddress, deadline) {
    const timer = setTimeout(async () => {
      const loan = await this.checkLoanStatus(loanId);
      
      if (loan.status !== 'repaid') {
        console.log(`⚠️ LOAN ${loanId} DEFAULTED!`);
        
        // Reveal identity to lender
        await this.revealIdentity(loanId, borrowerAddress);
      }
    }, deadline - Date.now());
    
    this.activeTimers.set(loanId, timer);
  }
  
  async revealIdentity(loanId, borrowerAddress) {
    // Fetch identity data from IPFS
    const identityData = await this.fetchIdentityFromIPFS(borrowerAddress);
    
    // Log to lender dashboard
    console.log(`
      ========================================
      LOAN DEFAULT - IDENTITY REVEALED
      ========================================
      Loan ID: ${loanId}
      Borrower Address: ${borrowerAddress}
      
      CONTACT INFORMATION:
      ${JSON.stringify(identityData, null, 2)}
      ========================================
    `);
    
    // Emit event for lender UI
    this.eventEmitter.emit('identity-revealed', {
      loanId,
      borrowerAddress,
      identityData
    });
  }
}
```

---

### 7. **Frontend Components**

**Component Structure:**

```
src/
├── pages/
│   ├── LoanBorrowerFlow.jsx       # Main borrower flow
│   ├── LenderDashboard.jsx        # Lender's view
│   └── HomePage.jsx
├── components/
│   ├── WalletConnect.jsx          # StarkNet wallet connection
│   ├── TokenBalance.jsx           # Display STRK balance
│   ├── TransactionHistory.jsx     # Show tx history
│   ├── ActivityScoreCard.jsx      # Display calculated score
│   ├── ZKProofGenerator.jsx       # Generate/update proof
│   ├── LoanCard.jsx               # Single loan offer card
│   ├── RepaymentTimer.jsx         # 10-minute countdown
│   └── IdentityRevealModal.jsx    # Show revealed identity
└── services/
    ├── starknetService.js         # StarkNet RPC calls
    ├── zkProofService.js          # ZK proof generation
    ├── loanService.js             # Loan operations
    └── activityCalculator.js      # Calculate points
```

---

### 8. **Data Flow Diagram**

```
┌─────────────────┐
│  User Connects  │
│   Wallet        │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Fetch STRK Balance & Tx History│
│  (StarkNet RPC)                 │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Calculate Activity Score       │
│  - Balance: 0-300 pts           │
│  - Tx Count: 0-400 pts          │
│  - Volume: 0-300 pts            │
│  Total: 0-1000 pts              │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Check Proof Cache              │
│  - Cached & valid? Use it       │
│  - New tx? Regenerate           │
│  - Expired? Regenerate          │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Generate ZK Proof              │
│  Inputs:                        │
│  - activity_score               │
│  - tx_count                     │
│  - wallet_address               │
│  - salt (auto-generated)        │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Display Loan Offer             │
│  - Amount: 50 STRK              │
│  - Threshold: 500 pts           │
│  - Interest: 5%                 │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  User Clicks "Apply"            │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Verify: score >= threshold?    │
│  - Yes: Approve loan            │
│  - No: Reject                   │
└────────┬────────────────────────┘
         │ (approved)
         ▼
┌─────────────────────────────────┐
│  Transfer 50 STRK to Borrower   │
│  (StarkNet transaction)         │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Start 10-Minute Timer          │
│  Display countdown in UI        │
└────────┬────────────────────────┘
         │
         ├──► (user pays) ──────────┐
         │                          │
         ├──► (timeout) ─────────┐  │
         │                       │  │
         ▼                       ▼  ▼
┌──────────────────┐   ┌─────────────────────┐
│  LOAN DEFAULTED  │   │   LOAN REPAID ✅    │
│  Reveal Identity │   │   Identity Protected│
└──────────────────┘   └─────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Lender Dashboard               │
│  Shows:                         │
│  - Borrower wallet address      │
│  - Contact info (from IPFS)     │
│  - Loan details                 │
│  - Default timestamp            │
└─────────────────────────────────┘
```

---

## Implementation Steps

### Phase 1: StarkNet Integration (2-3 hours)
1. ✅ Set up StarkNet provider (Sepolia testnet)
2. ✅ Implement wallet connection (Argent/Braavos)
3. ✅ Fetch STRK token balance
4. ✅ Fetch transaction history via RPC events
5. ✅ Calculate activity score from tx data

### Phase 2: ZK Proof System (3-4 hours)
1. ✅ Update circuit to include tx metadata
2. ✅ Implement proof caching logic
3. ✅ Add dynamic proof update on new tx
4. ✅ Add field validation (from OVERFLOW_ANALYSIS.md)
5. ✅ Test proof generation with real wallet data

### Phase 3: Loan Flow (2-3 hours)
1. ✅ Create loan provider mock data
2. ✅ Implement loan application UI
3. ✅ Add proof threshold verification
4. ✅ Implement STRK token transfer (testnet)
5. ✅ Add 10-minute repayment timer

### Phase 4: Default Handling (2 hours)
1. ✅ Implement loan monitoring service
2. ✅ Add identity reveal on timeout
3. ✅ Create lender dashboard
4. ✅ Add console logging for revealed data
5. ✅ Test complete default flow

### Phase 5: Testing & Refinement (2 hours)
1. ✅ End-to-end test with real wallet
2. ✅ Test proof caching/updates
3. ✅ Test loan approval/rejection
4. ✅ Test repayment flow
5. ✅ Test default flow

**Total Estimated Time:** 11-14 hours

---

## Technical Requirements

### StarkNet Testnet Setup

```bash
# Get Sepolia ETH faucet
https://starknet-faucet.vercel.app/

# Get STRK tokens (Sepolia)
https://starknet-faucet.vercel.app/

# Recommended wallets:
- Argent X (Chrome extension)
- Braavos (Chrome extension)
```

### Environment Variables

```env
# .env (frontend)
VITE_STARKNET_RPC=https://starknet-sepolia.public.blastapi.io
VITE_STRK_TOKEN=0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d
VITE_LOAN_CONTRACT=<deployed_contract_address>

# .env (backend)
STARKNET_RPC=https://starknet-sepolia.public.blastapi.io
STRK_TOKEN_ADDRESS=0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d
```

---

## Next Steps

**Ready to implement?**

I'll create:
1. ✅ Real StarkNet transaction fetcher
2. ✅ Activity score calculator
3. ✅ ZK proof caching system
4. ✅ Loan flow components
5. ✅ Default handling & identity reveal

**Start with Phase 1?** (StarkNet integration)

