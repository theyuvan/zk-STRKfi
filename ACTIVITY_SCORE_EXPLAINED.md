# 🎯 Activity Score Calculation - Complete Guide

## Overview

The Activity Score is a **zero-knowledge proof** of a user's wallet activity WITHOUT revealing their actual wallet address or transaction details to the lender. It's calculated based on:

1. **Number of Transactions** - How active is the wallet
2. **Transaction Volume** - Total value transacted
3. **Wallet Age** - How long the wallet has existed
4. **Transaction Diversity** - Different types of transactions

## How It Works

### Step 1: Wallet Data Collection (Client-Side)
When a borrower generates a ZK proof, the frontend:

1. **Connects to Starknet RPC** to fetch wallet data
2. **Analyzes transaction history** (last 90 days or 100 transactions)
3. **Calculates raw metrics**:
   - Total transactions
   - Total volume (in STRK)
   - Wallet creation date
   - Types of interactions (transfers, contract calls, etc.)

### Step 2: Score Calculation Algorithm

Located in: `frontend/src/utils/activityScoreCalculator.js`

```javascript
export const getActivityData = async (walletAddress) => {
  // 1. Fetch transactions from Starknet
  const transactions = await fetchTransactions(walletAddress);
  
  // 2. Calculate individual metrics
  const txCount = transactions.length;
  const totalVolume = calculateTotalVolume(transactions);
  const walletAge = calculateWalletAge(transactions);
  const diversity = calculateDiversity(transactions);
  
  // 3. Weight the metrics
  const score = (
    (txCount * 0.3) +      // 30% weight on transaction count
    (totalVolume * 0.4) +   // 40% weight on volume
    (walletAge * 0.2) +     // 20% weight on age
    (diversity * 0.1)       // 10% weight on diversity
  );
  
  // 4. Normalize to 0-1000 range
  return Math.min(1000, Math.max(0, score));
};
```

### Step 3: ZK Proof Generation

The borrower's wallet data is used to generate a **zero-knowledge proof** that proves:
- ✅ "I have an activity score of X"
- ❌ WITHOUT revealing which wallet address
- ❌ WITHOUT revealing transaction details
- ❌ WITHOUT revealing transaction amounts

### Step 4: On-Chain Verification

The proof is verified by the `ActivityVerifier` contract:
```cairo
fn verify_proof(proof_hash: felt252, commitment: felt252, activity_score: u256) {
    // Verifies the ZK proof is valid
    // Stores commitment → activity_score mapping
}
```

## Current Implementation Status

### ⚠️ **IMPORTANT: Current Version is DEMO Mode**

The current implementation uses **SIMULATED** activity data because:

1. **No Real ZK Circuit Yet**: The full circom circuit for activity verification isn't deployed
2. **RPC Limitations**: Fetching full transaction history from public RPC nodes can timeout
3. **Demo Purpose**: To demonstrate the loan flow without waiting for ZK infrastructure

### What's Actually Happening Now

Located in: `backend/src/services/zkService.js`

```javascript
async function generateProof(walletAddress, activityData) {
  console.log('📊 Generating ZK proof (DEMO MODE)');
  console.log('Input activity data:', activityData);
  
  // DEMO: Generate dummy proof
  const proofHash = generateHash(walletAddress + activityData.score);
  const commitment = generateHash(walletAddress);
  
  return {
    proofHash,
    commitment,
    activityScore: activityData.score,
    proof: {
      pi_a: ['0x...'], // Dummy proof components
      pi_b: [['0x...'], ['0x...']],
      pi_c: ['0x...'],
      protocol: 'groth16',
      curve: 'bn128'
    }
  };
}
```

##💡 How to Calculate REAL Activity Score

If you want to see REAL transaction-based scores, you need to:

### Option 1: Use Starknet Block Explorer API

```javascript
// In frontend/src/utils/activityScoreCalculator.js
export const getActivityData = async (walletAddress) => {
  try {
    // Fetch from Voyager/Starkscan API
    const response = await fetch(
      `https://api.voyager.online/beta/txns?to=${walletAddress}&ps=100&p=1`
    );
    const data = await response.json();
    
    // Calculate based on real transactions
    const txCount = data.items.length;
    const totalVolume = data.items.reduce((sum, tx) => {
      return sum + parseFloat(tx.value || 0);
    }, 0);
    
    // Calculate wallet age
    const oldestTx = data.items[data.items.length - 1];
    const walletAge = Date.now() - (oldestTx.timestamp * 1000);
    const ageInDays = walletAge / (1000 * 60 * 60 * 24);
    
    // Score calculation
    const score = Math.min(1000, 
      (txCount * 2) +           // 2 points per transaction
      (totalVolume / 1e18) +     // 1 point per STRK transacted
      (ageInDays * 0.5)          // 0.5 points per day of age
    );
    
    return {
      score: Math.round(score),
      txCount,
      totalVolume: totalVolume / 1e18,
      walletAgeInDays: Math.round(ageInDays)
    };
  } catch (error) {
    console.error('Failed to fetch real transactions:', error);
    // Fallback to demo mode
    return {
      score: Math.floor(Math.random() * 500) + 300, // Random 300-800
      txCount: 0,
      totalVolume: 0,
      walletAgeInDays: 0
    };
  }
};
```

### Option 2: Use Starknet.js Direct RPC

```javascript
import { RpcProvider } from 'starknet';

export const getActivityData = async (walletAddress) => {
  const provider = new RpcProvider({
    nodeUrl: 'https://starknet-sepolia.public.blastapi.io'
  });
  
  try {
    // Get transaction hashes
    const txs = await provider.getTransactionByHash(walletAddress);
    
    // Analyze transactions
    let score = 0;
    let txCount = 0;
    let totalVolume = 0;
    
    for (const tx of txs) {
      txCount++;
      if (tx.value) {
        totalVolume += BigInt(tx.value);
      }
    }
    
    score = (txCount * 5) + (Number(totalVolume) / 1e18);
    
    return {
      score: Math.min(1000, Math.round(score)),
      txCount,
      totalVolume: Number(totalVolume) / 1e18,
      transactions: txs.slice(0, 10) // Show last 10 transactions
    };
  } catch (error) {
    console.error('RPC fetch failed:', error);
    return { score: 500, txCount: 0, totalVolume: 0 };
  }
};
```

## Displaying Transaction History

To show users their transactions and how the score is calculated:

### Frontend Component

```jsx
// In LoanBorrowerFlowNew.jsx

const [activityBreakdown, setActivityBreakdown] = useState(null);

const showActivityBreakdown = async () => {
  const data = await getActivityData(walletAddress);
  setActivityBreakdown(data);
};

// In render:
{activityBreakdown && (
  <div className="activity-breakdown">
    <h3>📊 Your Activity Score Breakdown</h3>
    <div className="score-card">
      <div className="score-big">{activityBreakdown.score}</div>
      <div className="score-max">/ 1000</div>
    </div>
    
    <div className="metrics">
      <div className="metric">
        <span className="metric-label">Transactions</span>
        <span className="metric-value">{activityBreakdown.txCount}</span>
      </div>
      <div className="metric">
        <span className="metric-label">Total Volume</span>
        <span className="metric-value">{activityBreakdown.totalVolume.toFixed(2)} STRK</span>
      </div>
      <div className="metric">
        <span className="metric-label">Wallet Age</span>
        <span className="metric-value">{activityBreakdown.walletAgeInDays} days</span>
      </div>
    </div>
    
    {activityBreakdown.transactions && (
      <div className="recent-transactions">
        <h4>Recent Transactions</h4>
        {activityBreakdown.transactions.map((tx, idx) => (
          <div key={idx} className="tx-item">
            <span>{tx.hash.slice(0, 10)}...</span>
            <span>{new Date(tx.timestamp * 1000).toLocaleDateString()}</span>
            <span>{(tx.value / 1e18).toFixed(4)} STRK</span>
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

## Production Implementation Roadmap

To make this production-ready:

### Phase 1: Real Data Integration (1-2 weeks)
- [ ] Integrate Voyager/Starkscan API
- [ ] Add caching layer for transaction data
- [ ] Implement rate limiting
- [ ] Add retry logic for failed API calls

### Phase 2: Real ZK Circuit (2-3 weeks)
- [ ] Deploy actual circom circuit for activity verification
- [ ] Set up trusted setup ceremony
- [ ] Generate verification keys
- [ ] Update contract to verify real proofs

### Phase 3: Enhanced Scoring (1 week)
- [ ] Add more metrics:
  - Contract interaction types
  - NFT holdings
  - DeFi protocol usage
  - Social reputation (if available)
- [ ] Machine learning model for fraud detection
- [ ] Dynamic score weighting based on loan amount

### Phase 4: Privacy Enhancements (2 weeks)
- [ ] Implement range proofs (prove score > X without revealing exact score)
- [ ] Add commitment schemes for historical scores
- [ ] Enable score updates without re-generating full proof

## Testing with Real Data (Quick Fix)

To test with real transaction data RIGHT NOW:

1. **Edit `frontend/src/utils/activityScoreCalculator.js`**:
```javascript
// Add this function
async function fetchRealTransactions(walletAddress) {
  try {
    const response = await fetch(
      `https://api.voyager.online/beta/txns?to=${walletAddress}&ps=50&p=1`
    );
    const data = await response.json();
    return data.items || [];
  } catch {
    return [];
  }
}

// Update getActivityData:
export const getActivityData = async (walletAddress) => {
  const txs = await fetchRealTransactions(walletAddress);
  
  if (txs.length === 0) {
    // Fallback to demo mode
    return {
      score: 500 + Math.floor(Math.random() * 300),
      txCount: 0,
      totalVolume: 0,
      demo: true
    };
  }
  
  // Real calculation
  const score = Math.min(1000, txs.length * 10);
  return {
    score,
    txCount: txs.length,
    totalVolume: txs.reduce((sum, tx) => sum + parseFloat(tx.value || 0), 0),
    demo: false,
    transactions: txs.slice(0, 10)
  };
};
```

2. **Show the calculation in UI**:
   - Display "DEMO MODE" badge when using simulated data
   - Display "REAL DATA" badge when using Voyager API
   - Show transaction count and volume

## Summary

| Aspect | Current (Demo) | Production |
|--------|---------------|------------|
| **Data Source** | Random/Simulated | Voyager API / RPC |
| **ZK Proof** | Dummy proof | Real Groth16 proof |
| **Score Calculation** | Simple random | Multi-factor algorithm |
| **Privacy** | Hash-based commitment | ZK-SNARKs |
| **Verification** | Contract accepts any proof | Contract verifies ZK proof |
| **Transaction Display** | None | Full history with breakdown |

The system is designed to be **privacy-preserving** while still allowing lenders to assess creditworthiness. The demo mode lets you test the full loan flow, and can be upgraded to production-grade ZK verification when the circom circuit is deployed.
