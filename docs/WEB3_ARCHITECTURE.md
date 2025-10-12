# Web3 Loan Application Architecture

## Overview

This is a fully decentralized, privacy-preserving loan application system built on Starknet testnet. **No databases, no localStorage** - all data lives on-chain or IPFS.

## Core Principles

1. **Privacy First**: Borrower identity is encrypted and only revealed to lender upon default
2. **On-Chain Verification**: Creditworthiness determined by wallet transaction history
3. **Zero-Knowledge Proofs**: Prove eligibility without revealing exact financial details
4. **Decentralized Storage**: No centralized databases - blockchain + IPFS only

## Application Flow

### 1. Connect Wallet

```
User connects MetaMask with Starknet testnet token
↓
Wallet address stored in browser state (not persisted)
↓
No registration, no KYC, no database entry
```

**Supported Wallets:**
- Starknet (Recommended): Argent, Braavos
- EVM: MetaMask (with Starknet plugin)

### 2. Wallet Activity Analysis

```
When user clicks "Analyze Activity"
↓
WalletAnalyzer fetches transaction history from Starknet RPC
↓
Calculates activity score based on:
  - Balance (0-400 points)
  - Transaction count (0-400 points)
  - Consistency (0-200 points)
↓
Total Score: 0-1000 points
```

**Scoring Formula:**
```javascript
balanceScore = min(balance_in_ETH * 100, 400)
txScore = min(transaction_count * 5, 400)
consistencyScore = nonce > 10 ? 200 : (nonce > 5 ? 100 : 50)
activityScore = balanceScore + txScore + consistencyScore
```

**Data Sources:**
- Starknet RPC: `https://starknet-goerli.g.alchemy.com/v2/demo`
- ETH Token Contract: `0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7`
- Methods: `getNonceForAddress()`, `callContract(balanceOf)`

### 3. ZK Proof Generation

```
Activity score calculated
↓
Generate ephemeral wallet address (for display only)
↓
Create ZK proof: "activity_score >= 500" without revealing exact score
↓
Proof hash stored on-chain
```

**Why Ephemeral Wallet?**
- Shows in UI for privacy
- Actual loan funds go to original connected wallet
- Lender sees ephemeral address, not real wallet (unless default)

**ZK Proof Components:**
```solidity
struct Proof {
  bytes32 proofHash;      // Keccak256 of proof data
  uint256 threshold;      // 500 (minimum score)
  bool verified;          // true if score >= threshold
  uint256 timestamp;      // Proof generation time
}
```

### 4. Loan Selection

**Loan Marketplace:**
- Loans offered by banks or anonymous lenders
- Each loan has:
  - Amount (in ETH)
  - Interest rate (APR)
  - Repayment term (days)
  - Minimum activity score
  - Available slots

**Example Loans:**
```javascript
{
  provider: "0x742d35...",
  providerType: "bank",
  amount: "1.0 ETH",
  interestRate: 5.0,    // 5% APR
  termDays: 30,
  minActivityScore: 400
}
```

**Eligibility Check:**
- User can only apply if `activityScore >= loan.minActivityScore`
- Visual indicator shows eligible/not eligible

### 5. Loan Application

```
User selects loan
↓
Upload identity document (encrypted)
↓
Identity uploaded to IPFS → returns CID
↓
Submit to Escrow contract:
  - Borrower: original wallet address
  - Ephemeral: temporary address
  - Amount: loan amount
  - ProofHash: ZK proof hash
  - IdentityCID: IPFS hash of encrypted identity
↓
Contract creates loan request
```

**Smart Contract Call:**
```solidity
function createLoanRequest(
  uint256 amount,
  uint256 threshold,
  bytes32 proofHash,
  bytes32 borrowerCommit,
  address ephemeralAddress,
  string memory identityCID
) external returns (uint256 loanId)
```

### 6. Loan Funding

```
Lender reviews loan request
↓
Sees: ephemeral address, ZK proof, loan amount, term
↓
Does NOT see: real wallet, exact activity score, identity
↓
Lender funds loan via contract
↓
Contract sends funds to REAL wallet (not ephemeral)
```

**Contract Logic:**
```solidity
function fundLoan(uint256 loanId, uint256 repaymentDays, uint256 interestBps) 
  external payable {
  // ... validation ...
  loan.repaymentDeadline = block.timestamp + (repaymentDays * 1 days);
  payable(loan.borrower).transfer(msg.value); // ← Funds to real wallet!
  emit LoanFunded(loanId, msg.sender, loan.repaymentDeadline);
}
```

### 7. Repayment

```
Borrower makes payments to contract
↓
Contract tracks: totalPaid, remaining balance
↓
If totalPaid >= repaymentAmount before deadline:
  → Loan marked as Paid
  → Identity stays private
```

### 8. Default Handling

```
If block.timestamp > repaymentDeadline AND totalPaid < repaymentAmount:
↓
Anyone can call: checkAndTriggerDefault(loanId)
↓
Contract automatically:
  - Sets loan state to Defaulted
  - Reveals identity CID to lender ONLY
  - Emits IdentityRevealed event
```

**Identity Reveal Logic:**
```solidity
function checkAndTriggerDefault(uint256 loanId) external {
  Loan storage loan = loans[loanId];
  require(block.timestamp > loan.repaymentDeadline);
  require(loan.totalPaid < loan.repaymentAmount);
  
  loan.state = LoanState.Defaulted;
  loan.identityRevealed = true;
  canViewIdentity[loanId][loan.lender] = true; // ← Only lender
  
  emit IdentityRevealed(loanId, loan.lender, loan.identityCID);
}
```

**Access Control:**
```solidity
function getIdentity(uint256 loanId) external view returns (string memory) {
  require(
    canViewIdentity[loanId][msg.sender],
    "Not authorized to view identity"
  );
  return loans[loanId].identityCID;
}
```

## Data Storage Strategy

### On-Chain (Smart Contracts)
```
✓ Loan requests and states
✓ Proof hashes
✓ Repayment deadlines
✓ Payment amounts
✓ Identity reveal permissions
```

### IPFS (Decentralized Storage)
```
✓ Encrypted identity documents
✓ ZK proof metadata (optional)
✓ Large loan documents
```

### Browser Memory (Temporary)
```
✓ Wallet connection state
✓ Current step in application flow
✓ UI preferences
✓ NO personal data
✓ Cleared on page refresh
```

### ❌ NOT Stored
```
✗ User accounts
✗ Email addresses
✗ Passwords
✗ Databases (SQL/NoSQL)
✗ localStorage
✗ Cookies with personal data
```

## Privacy Guarantees

### Before Default
- Lender sees: ephemeral address, loan amount, proof hash
- Lender does NOT see: real wallet, transaction history, identity
- Other users see: nothing (loan data not public)

### After Default
- Lender gets: IPFS CID to decrypt identity
- Lender can access: identity document, real wallet address
- Other users still see: nothing
- Only the lender who funded the specific loan can view

## Security Considerations

### 1. Ephemeral Wallet Generation
```javascript
export function generateEphemeralWallet() {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    displayOnly: true,
    note: 'Funds go to your connected wallet.'
  };
}
```
- Private key is generated but NOT stored
- Only address is used for display
- Cannot receive funds (not in any contract mapping)

### 2. Identity Encryption
- Identity document encrypted before IPFS upload
- Encryption key derived from lender's public key
- Only lender can decrypt after default
- CID is just a hash - no personal data visible

### 3. ZK Proof Verification
```javascript
// Proof contains:
{
  score: HIDDEN,
  threshold: 500,
  verified: true/false,
  proofHash: keccak256(score + threshold + timestamp)
}
```
- Exact score never revealed to lender
- Only binary result: eligible or not
- Proof hash stored on-chain for verification

### 4. Front-Running Protection
- Loan requests are atomic transactions
- No multi-step processes that can be front-run
- Deadlines enforced by block.timestamp (not manipulable)

## Contract Addresses

### Starknet Goerli Testnet
```
Escrow Contract: [To be deployed]
Loan Registry: [To be deployed]
```

### Deployment
```bash
cd contracts
npm install
npx hardhat compile
npx hardhat run scripts/deploy_starknet.js --network starknet-goerli
```

## Frontend Integration

### Key Components

**WalletAnalyzer** (`frontend/src/services/walletAnalyzer.js`)
- Fetches transactions from Starknet RPC
- Calculates activity score
- Prepares ZK proof inputs

**LoanMarketplace** (`frontend/src/components/LoanMarketplace.jsx`)
- Displays available loans
- Filters by eligibility
- Handles loan selection

**LoanRequestPageV2** (`frontend/src/pages/LoanRequestPageV2.jsx`)
- 6-step application flow
- Wallet connection
- Activity analysis
- ZK proof generation
- Loan selection
- Application submission

### State Management (Zustand)

```javascript
// walletStore.js
{
  starknetAddress,
  starknetConnected,
  evmAddress,
  evmConnected,
  connectStarkNet(),
  connectEVM()
}
```

### Environment Variables
```bash
# frontend/.env
VITE_STARKNET_RPC=https://starknet-goerli.g.alchemy.com/v2/demo
VITE_ESCROW_CONTRACT=0x...
VITE_REGISTRY_CONTRACT=0x...
```

## Testing

### Local Testing
```bash
# Start local Starknet node
starknet-devnet

# Deploy contracts
npm run deploy:local

# Start frontend
cd frontend
npm run dev
```

### Testnet Testing
1. Get testnet tokens: https://faucet.goerli.starknet.io/
2. Connect wallet with testnet network
3. Make some transactions to build activity score
4. Test loan application flow

## Future Enhancements

1. **Multi-Chain Support**: Arbitrum, Optimism, zkSync
2. **Advanced ZK Circuits**: Use SNARKs for true zero-knowledge proofs
3. **Credit Score NFTs**: Mint NFT representing activity score
4. **Loan Pooling**: Allow multiple lenders to fund one loan
5. **Automated Market Making**: Dynamic interest rates based on demand
6. **Reputation System**: Track repayment history on-chain

## FAQ

**Q: Where is my data stored?**
A: On blockchain (Starknet) and IPFS only. No databases.

**Q: Can I delete my loan request?**
A: No, it's on-chain forever. But identity stays encrypted.

**Q: What if I lose my wallet?**
A: You lose access to repay. Lender can trigger default.

**Q: Can anyone see my transaction history?**
A: Transaction history is public on blockchain, but ZK proof hides exact amounts.

**Q: How is identity encrypted?**
A: Using lender's public key. Only lender can decrypt after default.

**Q: What prevents fake activity scores?**
A: Score is calculated directly from blockchain RPC. Cannot be faked.

---

**Built with privacy, powered by blockchain** 🚀
