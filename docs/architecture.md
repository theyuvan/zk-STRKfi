# ZK Affordability Loan - Architecture

## System Overview

The ZK Affordability Loan platform enables privacy-preserving lending by using Zero-Knowledge proofs to verify borrower income without revealing sensitive financial data.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Not Included)                  │
│  - Wallet Connect (StarkNet/MetaMask)                           │
│  - ZK Proof Generation (Client-Side)                            │
│  - Transaction Signing                                          │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend API (Node.js)                       │
├─────────────────────────────────────────────────────────────────┤
│  Controllers:                                                    │
│  ├─ Loan Controller (create, fund, payment, default)           │
│  ├─ Proof Controller (prepare, verify)                         │
│  ├─ Identity Controller (encrypt, distribute shares)           │
│  └─ Payroll Controller (OAuth, attestations)                   │
│                                                                  │
│  Services:                                                       │
│  ├─ ZK Service (circuit interaction, proof generation)         │
│  ├─ IPFS Service (encryption, upload, retrieval)               │
│  ├─ Shamir Service (secret sharing, reconstruction)            │
│  ├─ Payroll Adapters (Plaid, ADP, Custom)                     │
│  └─ On-chain Service (contract reads, events)                  │
│                                                                  │
│  Workers:                                                        │
│  ├─ Event Watcher (monitor blockchain)                         │
│  ├─ Share Collector (trustee coordination)                     │
│  └─ Retry Queue (failure handling)                             │
└──────────────┬───────────────────────┬──────────────────────────┘
               │                       │
               ▼                       ▼
┌─────────────────────┐    ┌──────────────────────────┐
│   StarkNet Chain    │    │   IPFS/Pinata           │
├─────────────────────┤    ├──────────────────────────┤
│ - Payroll Contract  │    │ - Encrypted Identity    │
│ - Loan Escrow       │    │ - AES-256-GCM           │
│ - Verifier Stub     │    │ - Pinned Storage        │
└─────────────────────┘    └──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External Services                             │
├─────────────────────────────────────────────────────────────────┤
│  - Plaid (Payroll/Income)                                       │
│  - ADP (Payroll Provider)                                       │
│  - Trustee Nodes (Shamir Share Storage)                        │
│  - Optional Relayer (Meta-transactions)                        │
└─────────────────────────────────────────────────────────────────┘
```

## Component Flow

### 1. Loan Request Flow

```
Borrower → Payroll Provider (Plaid/ADP)
         ↓
    Get Salary Data
         ↓
Generate ZK Proof (Client-Side)
  - Input: salary, threshold, salt
  - Output: proof, commitment
         ↓
Encrypt Identity (Backend)
  - AES-256-GCM encryption
  - Upload to IPFS → CID
         ↓
Split Encryption Key (Shamir)
  - 2-of-3 threshold
  - Distribute to trustees
         ↓
Submit Loan Request (On-Chain)
  - proof_hash
  - commitment
  - threshold
  - amount
```

### 2. Loan Funding Flow

```
Lender Reviews Loan Request
         ↓
Verify ZK Proof (On-Chain)
         ↓
Fund Loan (Transaction)
  - Transfer funds
  - Store IPFS CID
  - Activate loan
         ↓
Borrower Receives Funds
```

### 3. Payment Flow

```
Borrower Makes Payment
         ↓
Report Payment (On-Chain)
         ↓
Update Payment Tracking
         ↓
Check if Fully Paid
  - Yes → Mark as PAID
  - No → Remain ACTIVE
```

### 4. Default & Identity Reveal Flow

```
Lender Triggers Default
         ↓
Start Dispute Window (7 days)
         ↓
Event Watcher Detects Default
         ↓
Share Collector Activated
         ↓
Request Shares from Trustees
  - Collect 2-of-3 shares
         ↓
Reconstruct Encryption Key
         ↓
Decrypt Identity from IPFS
         ↓
Reveal to Lender for Collection
```

## Data Flow Diagrams

### ZK Proof Generation

```
Private Inputs              Public Inputs
┌──────────┐               ┌───────────┐
│  Salary  │               │ Threshold │
│   Salt   │               └─────┬─────┘
└────┬─────┘                     │
     │                           │
     └──────────┬────────────────┘
                ▼
        ┌──────────────┐
        │   Circuit    │
        │ (Circom/R1CS)│
        └──────┬───────┘
               │
               ▼
        ┌──────────────┐
        │   Groth16    │
        │   Prover     │
        └──────┬───────┘
               │
               ▼
    ┌──────────────────────┐
    │  Proof + Commitment  │
    └──────────────────────┘
```

### Identity Encryption & Sharing

```
Identity Data
      ↓
AES-256-GCM Encrypt
      ↓
Upload to IPFS → CID
      ↓
Encryption Key
      ↓
Shamir Split (2-of-3)
      ↓
┌──────┬──────┬──────┐
Share1 Share2 Share3
   ↓      ↓      ↓
Trustee1 Trustee2 Trustee3
```

## Security Layers

1. **Privacy Layer**: ZK proofs hide exact salary
2. **Encryption Layer**: AES-256-GCM for identity
3. **Distribution Layer**: Shamir secret sharing (no single point of failure)
4. **Blockchain Layer**: Immutable audit trail
5. **Time-Lock Layer**: Dispute window before reveal

## Technology Stack

- **Blockchain**: StarkNet (Cairo), Optional EVM (Solidity)
- **ZK Proofs**: Circom + SnarkJS (Groth16)
- **Storage**: IPFS/Pinata
- **Backend**: Node.js + Express
- **Encryption**: AES-256-GCM (node-forge)
- **Secret Sharing**: Shamir's Secret Sharing
- **Payroll**: Plaid, ADP APIs
- **Job Queue**: BullMQ + Redis

## Scalability Considerations

- **Event-Driven**: Workers process blockchain events asynchronously
- **Retry Mechanism**: Failed operations queued for retry
- **Stateless API**: Horizontally scalable backend
- **Decentralized Storage**: IPFS for identity data
- **Optional Relayer**: Meta-transactions to reduce user friction

## Privacy Guarantees

1. **Salary Privacy**: Only proof of `salary >= threshold` revealed
2. **Identity Privacy**: Encrypted until default triggered
3. **Trustee Distribution**: No single trustee can decrypt alone
4. **Client-Side Proving**: Salary never leaves user's device during proof generation
