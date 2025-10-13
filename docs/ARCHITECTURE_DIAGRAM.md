# 🏗️ On-Chain ZK Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Wallet Integration (Argent X / Braavos)               │ │
│  │  - Connect wallet                                      │ │
│  │  - Sign transactions                                   │ │
│  │  - Manage STRK approvals                               │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  ZK Proof Generator (Client-Side)                      │ │
│  │  - Fetch wallet activity                               │ │
│  │  - Generate snarkJS proof                              │ │
│  │  - Create commitment hash                              │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               │ Sign TX                       │ Query Data
               ↓                               ↓
┌──────────────────────────────┐   ┌─────────────────────────┐
│   STARKNET BLOCKCHAIN        │   │  BACKEND (Node.js)      │
│                              │   │  ┌───────────────────┐  │
│  ┌────────────────────────┐ │   │  │ Blockchain Reader │  │
│  │  ActivityVerifier      │ │   │  │ (No Cache)        │  │
│  │  ─────────────────────│ │   │  └───────────────────┘  │
│  │  Storage:              │ │   │                         │
│  │  proof_hash →          │←┼───┼──── Query only         │
│  │    commitment          │ │   │      No writes          │
│  │    activity_score      │ │   │                         │
│  │    verified: bool      │ │   │  ┌───────────────────┐  │
│  │                        │ │   │  │ Event Indexer     │  │
│  │  Functions:            │ │   │  │ (Read Events)     │  │
│  │  • register_proof()    │ │   │  └───────────────────┘  │
│  │  • verify_proof()      │ │   │                         │
│  │  • get_proof_score()   │ │   │  Express API:           │
│  └────────────────────────┘ │   │  GET /available         │
│                              │   │  GET /lender/:addr      │
│  ┌────────────────────────┐ │   │  GET /application/:id   │
│  │  LoanEscrowZK          │←┼───┼──                        │
│  │  ─────────────────────│ │   └─────────────────────────┘
│  │  Storage:              │ │
│  │  loan_offers →         │ │
│  │    lender              │ │
│  │    amount              │ │
│  │    slots               │ │
│  │    min_score           │ │
│  │                        │ │
│  │  applications →        │ │
│  │    (loan_id, hash) →   │ │
│  │      borrower          │ │
│  │      proof_hash        │ │
│  │      status            │ │
│  │                        │ │
│  │  Functions:            │ │
│  │  • create_loan_offer() │ │
│  │  • apply_for_loan() ✓ │ │  ← Calls verify_proof()
│  │  • approve_borrower()  │ │
│  │  • repay_loan()        │ │
│  └────────────────────────┘ │
│                              │
│  ┌────────────────────────┐ │
│  │  STRK Token (ERC20)    │ │
│  │  ─────────────────────│ │
│  │  • approve()           │ │
│  │  • transfer_from()     │ │
│  └────────────────────────┘ │
└──────────────────────────────┘
```

---

## Flow Diagrams

### 1️⃣ **Lender Creates Loan Offer**

```
Lender Wallet
     │
     │ 1. Fill loan form
     │    (amount, slots, interest, min_score)
     ↓
Frontend
     │
     │ 2. Sign transaction
     ↓
LoanEscrowZK.create_loan_offer()
     │
     │ 3. Store on-chain
     ↓
Blockchain Storage
     │
     │ 4. Emit event: LoanOfferCreated
     ↓
Backend (Event Listener)
     │
     │ 5. Index event
     ↓
Frontend refreshes available loans
```

---

### 2️⃣ **Borrower Applies (with ZK Verification)**

```
Borrower Wallet
     │
     │ 1. Connect wallet
     ↓
Frontend
     │
     │ 2. Fetch wallet activity
     │    (balance, transactions)
     ↓
Activity Score Calculator
     │
     │ 3. Calculate score
     ↓
ZK Proof Generator (snarkJS)
     │
     │ 4. Generate proof
     │    Input: score, threshold, salt
     │    Output: proof, commitment, proof_hash
     ↓
Step 1: Register Proof
     │
     │ 5. Sign TX: ActivityVerifier.register_proof()
     ↓
ActivityVerifier Contract
     │
     │ 6. Store:
     │    proof_hash → (commitment, score, verified: true)
     ↓
Step 2: Apply for Loan
     │
     │ 7. Sign TX: LoanEscrowZK.apply_for_loan(
     │       loan_id, proof_hash, commitment
     │    )
     ↓
LoanEscrowZK Contract
     │
     │ 8. VERIFY PROOF ON-CHAIN:
     │    ┌────────────────────────────────┐
     │    │ verifier.verify_proof(         │
     │    │   proof_hash,                  │
     │    │   commitment,                  │
     │    │   min_activity_score           │
     │    │ )                              │
     │    │                                │
     │    │ Returns: true/false            │
     │    └────────────────────────────────┘
     ↓
     ├──► If FALSE → Transaction REVERTS ❌
     │
     └──► If TRUE → Continue ✅
          │
          │ 9. Store application
          ↓
Blockchain Storage
     │
     │ 10. Emit event: LoanApplicationSubmitted
     ↓
Backend indexes event
```

---

### 3️⃣ **Lender Approves Borrower (STRK Transfer)**

```
Lender Wallet
     │
     │ 1. View applications
     ↓
Frontend
     │
     │ 2. Click "Approve"
     ↓
Step 1: Approve STRK
     │
     │ 3. Sign TX: STRK.approve(
     │       LoanEscrowZK_ADDRESS,
     │       amount
     │    )
     ↓
STRK Token Contract
     │
     │ 4. Grant spending permission
     ↓
Step 2: Approve Borrower
     │
     │ 5. Sign TX: LoanEscrowZK.approve_borrower(
     │       loan_id,
     │       borrower_commitment
     │    )
     ↓
LoanEscrowZK Contract
     │
     │ 6. Verify lender is loan creator
     │ 7. Check slots available
     │ 8. Update application: status → approved
     │ 9. Transfer STRK:
     │    transfer_from(lender, borrower, amount)
     ↓
Borrower receives STRK ✅
     │
     │ 10. Emit event: BorrowerApproved
     ↓
Backend indexes event
```

---

### 4️⃣ **Borrower Repays Loan (STRK + Interest)**

```
Borrower Wallet
     │
     │ 1. View active loans
     ↓
Frontend
     │
     │ 2. Calculate repayment:
     │    amount + (amount * interest_rate / 10000)
     ↓
Step 1: Approve STRK
     │
     │ 3. Sign TX: STRK.approve(
     │       LoanEscrowZK_ADDRESS,
     │       repayment_amount
     │    )
     ↓
STRK Token Contract
     │
     │ 4. Grant spending permission
     ↓
Step 2: Repay Loan
     │
     │ 5. Sign TX: LoanEscrowZK.repay_loan(loan_id)
     ↓
LoanEscrowZK Contract
     │
     │ 6. Verify borrower owns application
     │ 7. Check within deadline
     │ 8. Update application: status → repaid
     │ 9. Transfer STRK:
     │    transfer_from(borrower, lender, repayment_amount)
     ↓
Lender receives STRK + interest ✅
     │
     │ 10. Emit event: LoanRepaid
     ↓
Backend indexes event
```

---

## 🔐 ZK Proof Verification Detail

```
┌───────────────────────────────────────────────────────┐
│  ActivityVerifier Storage                             │
│  ────────────────────────────────────────────────    │
│                                                       │
│  proof_hash_1 → {                                     │
│    commitment: 0x1234...                              │
│    activity_score: 350                                │
│    verified: true                                     │
│    registered_by: 0xabc...                            │
│  }                                                    │
│                                                       │
│  proof_hash_2 → {                                     │
│    commitment: 0x5678...                              │
│    activity_score: 180                                │
│    verified: true                                     │
│    registered_by: 0xdef...                            │
│  }                                                    │
└───────────────────────────────────────────────────────┘
                      ↑
                      │
        ┌─────────────┴──────────────┐
        │  Verification Call         │
        │  ──────────────────────    │
        │                            │
        │  verify_proof(             │
        │    proof_hash: hash_1,     │
        │    commitment: 0x1234...,  │
        │    threshold: 200          │
        │  )                         │
        │                            │
        │  Checks:                   │
        │  1. proof exists? ✓        │
        │  2. verified == true? ✓    │
        │  3. commitment matches? ✓  │
        │  4. score >= threshold? ✓  │
        │     (350 >= 200)           │
        │                            │
        │  Returns: TRUE ✅          │
        └────────────────────────────┘
```

---

## 📊 Data Storage Comparison

### **In-Memory (OLD) ❌**
```
Backend Memory (RAM)
┌─────────────────────┐
│ loansCache = [      │
│   { id: 1, ... },   │
│   { id: 2, ... }    │
│ ]                   │
│                     │
│ applicationsCache = │
│   [...]             │
└─────────────────────┘
      ↓
  Restart Server
      ↓
  ❌ ALL DATA LOST
```

### **On-Chain (NEW) ✅**
```
StarkNet Blockchain
┌──────────────────────────┐
│ LoanEscrowZK Storage     │
│ ──────────────────────   │
│                          │
│ loan_offers:             │
│   1 → { ... }            │
│   2 → { ... }            │
│   3 → { ... }            │
│                          │
│ applications:            │
│   (1, hash_a) → { ... }  │
│   (1, hash_b) → { ... }  │
│   (2, hash_c) → { ... }  │
└──────────────────────────┘
      ↓
  ✅ PERMANENT
  ✅ VERIFIABLE
  ✅ IMMUTABLE
```

---

## 🎯 Trust Model

### **In-Memory (Centralized)**
```
User → Backend → Database
       ↑
    Must trust backend
    to not:
    - Lose data
    - Modify data
    - Fake verifications
```

### **On-Chain (Trustless)**
```
User → Smart Contract → Blockchain
              ↑
         No trust needed:
         - Code is public
         - Execution verified
         - Data immutable
         - Math guarantees correctness
```

---

**This architecture provides true cryptographic privacy with blockchain enforcement!** 🔐⛓️
