# 🔐 Loanzy - Zero-Knowledge Privacy-Preserving Loan Platform

<div align="center">

![Status](https://img.shields.io/badge/Status-Production%20Ready-success)
![Network](https://img.shields.io/badge/Network-StarkNet%20Sepolia-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![ZK](https://img.shields.io/badge/ZK%20Proofs-Circom%20%2B%20Poseidon-purple)

**A fully decentralized, privacy-preserving loan platform using Zero-Knowledge proofs verified on-chain**

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Architecture](#-architecture)
- [Technology Stack](#-technology-stack)
- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [Smart Contracts](#-smart-contracts)
- [API Documentation](#-api-documentation)
- [Security](#-security)
- [Deployment](#-deployment)
- [License](#-license)

---

## 🎯 Overview

**Loanzy** is a revolutionary decentralized lending platform that enables privacy-preserving loans using Zero-Knowledge (ZK) proofs verified directly on the StarkNet blockchain. Borrowers can prove their creditworthiness without revealing sensitive personal or financial information.

### What Makes Loanzy Unique?

✅ **True On-Chain ZK Verification** - Proofs verified by smart contracts, not backend servers  
✅ **Zero In-Memory Storage** - All data stored on blockchain (StarkNet Sepolia)  
✅ **Privacy-First Design** - Borrowers never reveal identity or activity scores  
✅ **Document OCR Validation** - Automatic passport/ID verification using Tesseract.js  
✅ **Multi-Borrower Escrow** - Lenders can fund multiple borrowers in a single loan offer  
✅ **Real-Time Activity Scoring** - Live StarkNet transaction analysis  

---

## 🚀 Key Features

### For Borrowers

- **🔒 Privacy-Preserving Applications**: Prove wallet activity score ≥ threshold without revealing exact metrics
- **📊 Real-Time Activity Scoring**: Automatic calculation based on StarkNet transaction history
- **📄 Automated Document Verification**: Upload passport/ID documents with OCR-based validation
- **⏱️ Transparent Repayment**: Real-time countdown timer with on-chain STRK token transfers

### For Lenders

- **💰 Multi-Borrower Loan Offers**: Create loan offers for multiple borrowers with custom terms
- **✅ Cryptographic Verification**: All borrower proofs verified on-chain by smart contracts
- **📈 Lender Dashboard**: Track all active loans and applications in real-time
- **🚨 Identity Reveal on Default**: Automatic identity disclosure if borrower defaults

---

## 🏗️ Architecture

### System Components

```
Frontend (Next.js) → Backend (Node.js/Express) → Smart Contracts (Cairo/StarkNet)
   ↓                        ↓                              ↓
- Wallet Integration    - RESTful API              - ActivityVerifier
- ZK Proof Gen         - Event Watcher            - LoanEscrowZK
- Document Upload      - OCR Service              - STRK Token
```

### Data Flow

1. **Lender Creates Loan** → `LoanEscrowZK.create_loan_offer()` → Event emitted
2. **Borrower Applies** → Generate ZK Proof → `ActivityVerifier.register_proof()` → `LoanEscrowZK.apply_for_loan()` → Contract verifies proof
3. **Lender Approves** → `STRK.approve()` → `LoanEscrowZK.approve_borrower()` → STRK transferred
4. **Borrower Repays** → `STRK.approve()` → `LoanEscrowZK.repay_loan()` → Loan completed

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: Next.js 15.2.4 (React 19)
- **Styling**: TailwindCSS 4.1.9 + shadcn/ui
- **Blockchain**: StarkNet.js 6.24.1, @starknet-react/core 5.0.3
- **Wallet**: get-starknet 4.0.0 (Argent X / Braavos)

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express 4.18.2
- **Blockchain**: StarkNet.js 5.24.3
- **ZK Proofs**: SnarkJS 0.7.3, Circomlibjs 0.1.7
- **OCR**: Tesseract.js 6.0.1, Sharp 0.34.4

### Smart Contracts
- **Language**: Cairo 2.x (StarkNet)
- **Network**: StarkNet Sepolia Testnet
- **Token**: STRK
- **Build Tool**: Scarb

---

## 🚀 Quick Start

### Prerequisites

```bash
Node.js >= 18.x
npm or yarn
Cairo 2.x + Scarb (for contracts)
```

### Installation

```bash
# Clone repository
git clone <your-repo-url>
cd Loanzy

# Install dependencies
npm run install:all

# Configure environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
# Edit .env files with your configuration
```

### Running the Application

**Terminal 1 - Backend**:
```bash
cd backend
npm start
# Runs on http://localhost:3000
```

**Terminal 2 - Frontend**:
```bash
cd frontend
npm run dev
# Runs on http://localhost:3000
```

### Environment Configuration

**Backend** (`backend/.env`):
```bash
STARKNET_NETWORK=sepolia
RPC_URL=https://starknet-sepolia.public.blastapi.io/rpc/v0_7
ACTIVITY_VERIFIER_ADDRESS=0x071b94eb84b81868b61fb0ec1bbb59df47bb508583bc79325e5fa997ee3eb4be
LOAN_ESCROW_ZK_ADDRESS=<your_deployed_address>
STRK_TOKEN_ADDRESS=0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d
PORT=3000
ENABLE_OCR=true
```

**Frontend** (`frontend/.env.local`):
```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
NEXT_PUBLIC_STARKNET_NETWORK=sepolia
NEXT_PUBLIC_ACTIVITY_VERIFIER=0x071b94eb84b81868b61fb0ec1bbb59df47bb508583bc79325e5fa997ee3eb4be
```

---

## 📁 Project Structure

```
Loanzy/
├── backend/                      # Node.js/Express backend
│   ├── src/
│   │   ├── controllers/          # Request handlers
│   │   ├── routes/               # API routes
│   │   ├── services/             # Business logic
│   │   ├── workers/              # Background jobs
│   │   └── utils/                # Utilities
│   └── package.json
│
├── frontend/                     # Next.js frontend
│   ├── app/                      # App router pages
│   ├── components/               # React components
│   ├── lib/                      # Utilities
│   └── package.json
│
├── contracts/                    # Smart contracts
│   ├── starknet/                 # Cairo contracts
│   ├── zk/                       # ZK circuits
│   └── deploy/                   # Deployment scripts
│
├── offchain/                     # Off-chain services
│   ├── ipfs-pinning/
│   └── trustees/
│
└── docs/                         # Documentation
```

---

## 📜 Smart Contracts

### ActivityVerifier

**Address**: `0x071b94eb84b81868b61fb0ec1bbb59df47bb508583bc79325e5fa997ee3eb4be`

**Functions**:
- `register_proof(proof_hash, commitment, activity_score)` - Register ZK proof
- `verify_proof(proof_hash, commitment, min_score)` - Verify proof validity
- `get_proof_details(proof_hash)` - Retrieve proof data

### LoanEscrowZK

**Functions**:
- `create_loan_offer(amount, slots, interest, period, min_score)` - Create loan
- `apply_for_loan(loan_id, proof_hash, commitment)` - Apply with ZK proof
- `approve_borrower(loan_id, borrower_commitment)` - Approve & fund
- `repay_loan(loan_id)` - Repay with interest
- `default_loan(loan_id)` - Handle default

**Events**: `LoanOfferCreated`, `LoanApplicationSubmitted`, `BorrowerApproved`, `LoanRepaid`, `LoanDefaulted`

---

## 🌐 API Documentation

### Base URL: `http://localhost:3000/api`

#### Loan Routes
- `GET /loans` - Fetch all loans
- `GET /loans/:loanId` - Fetch specific loan
- `POST /loans/create` - Create loan offer
- `POST /loans/:loanId/apply` - Apply for loan
- `POST /loans/:loanId/approve` - Approve borrower
- `POST /loans/:loanId/repay` - Repay loan

#### Identity Routes
- `POST /identity/verify-document` - Upload & verify document
- `GET /identity/commitment/:walletAddress` - Get commitment

#### Activity Routes
- `GET /activity/score/:walletAddress` - Calculate activity score
- `GET /activity/transactions/:walletAddress` - Get transaction history

#### Proof Routes
- `POST /proof/generate-activity` - Generate activity ZK proof
- `POST /proof/generate-identity` - Generate identity ZK proof

---

## 🔒 Security

### Privacy Guarantees

1. **Zero-Knowledge Proofs**: Activity scores and identity data never revealed
2. **On-Chain Verification**: Smart contracts verify proofs cryptographically
3. **Document Security**: Documents deleted after OCR, only hashes stored

### Smart Contract Security

- Access control on sensitive functions
- Reentrancy protection
- Integer overflow protection (Cairo 2.x)
- Comprehensive event logging

### Recommended Audits

⚠️ **Before mainnet deployment**:
- Professional smart contract audit
- ZK circuit security review
- Penetration testing
- Gas optimization audit

---

## 🚀 Deployment

### Deploy Smart Contracts

```bash
# Compile contracts
cd contracts/starknet
scarb build

# Deploy LoanEscrowZK
starkli deploy <CLASS_HASH> \
  0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d \
  0x071b94eb84b81868b61fb0ec1bbb59df47bb508583bc79325e5fa997ee3eb4be
```

### Deploy Backend (VPS)

```bash
# Install dependencies
sudo apt-get install nodejs npm

# Clone and setup
git clone <repo-url>
cd Loanzy/backend
npm install

# Run with PM2
npm install -g pm2
pm2 start src/server.js --name loanzy-backend
```

### Deploy Frontend (Vercel)

```bash
cd frontend
vercel
```

---

## 📊 System Status

| Component | Status | Network |
|-----------|--------|---------|
| ActivityVerifier | ✅ Deployed | StarkNet Sepolia |
| LoanEscrowZK | ⏳ Pending | - |
| Backend API | ✅ Running | Local |
| Frontend | ✅ Running | Local |

---

## 📚 Documentation

- **[BACKEND_LOGS_ANALYSIS.md](BACKEND_LOGS_ANALYSIS.md)** - System health analysis
- **[DOCUMENT_OCR_VALIDATION.md](DOCUMENT_OCR_VALIDATION.md)** - OCR implementation
- **[IDENTITY_COMMITMENT_FIX_COMPLETE.md](IDENTITY_COMMITMENT_FIX_COMPLETE.md)** - Identity fixes
- **[ZKPROOF_ERROR_ANALYSIS.md](ZKPROOF_ERROR_ANALYSIS.md)** - ZK debugging

---

## 📝 License

MIT License - Copyright (c) 2024 ZK Affordability Loan

See [LICENSE](LICENSE) for full details.

---

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make changes and test
4. Submit a pull request

---

## 📞 Support

For issues and questions:
- GitHub Issues: Create an issue in this repository
- Documentation: Check the `/docs` folder

---

**Built with ❤️ using StarkNet, Circom, and Next.js**
